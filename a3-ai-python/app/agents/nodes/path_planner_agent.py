"""
路径规划智能体
基于学生画像生成个性化学习路径
"""
from typing import Dict, List, Any, Optional
from app.agents.state import LearningAgentState
from app.core.logging import logger
from app.integrations.llm.client import get_llm_client
from app.schemas.learning_path import PathPlanningRequest
import json


class _CompatLLM:
    def __init__(self) -> None:
        self._client = get_llm_client()

    async def ainvoke(self, prompt: str):
        return await self._client.chat_completion(messages=[{"role": "user", "content": prompt}])


def get_llm() -> _CompatLLM:
    return _CompatLLM()


async def path_planner_node(state: LearningAgentState) -> LearningAgentState:
    """
    路径规划智能体节点
    
    功能:
    1. 分析学生画像和目标知识点
    2. 构建知识点依赖关系
    3. 生成阶梯式学习路径
    4. 为每个节点匹配资源
    """
    user_id = state.get("user_id")
    profile = state.get("profile", {})
    course_code = state.get("course_code")
    target_knowledge_points = state.get("target_knowledge_points", [])
    
    if not user_id or not profile:
        state["learning_path"] = {
            "error": "缺少用户ID或学生画像信息",
            "nodes": []
        }
        return state
    
    try:
        # 1. 分析知识点依赖关系
        knowledge_graph = await _analyze_knowledge_dependencies(
            target_knowledge_points, 
            course_code
        )
        
        # 2. 根据学生画像生成路径
        path_structure = await _generate_path_structure(
            profile, 
            knowledge_graph,
            course_code
        )
        
        # 3. 为每个节点设置难度和资源
        enriched_nodes = await _enrich_path_nodes(
            path_structure["nodes"],
            profile,
            course_code
        )
        
        # 4. 组装完整路径
        learning_path = {
            "path_name": path_structure.get("path_name", "个性化学习路径"),
            "path_desc": path_structure.get("path_desc", ""),
            "nodes": enriched_nodes,
            "total_nodes": len(enriched_nodes),
            "estimated_duration": sum(node.get("estimated_duration", 0) for node in enriched_nodes),
            "difficulty_level": _calculate_overall_difficulty(enriched_nodes),
            "knowledge_graph": knowledge_graph
        }
        
        state["learning_path"] = learning_path
        
        # 记录执行轨迹
        trace = state.get("execution_trace", [])
        trace.append(f"path_planner:generated_{len(enriched_nodes)}_nodes")
        state["execution_trace"] = trace
        
        logger.info(f"路径规划完成: user_id={user_id}, nodes={len(enriched_nodes)}")
        
    except Exception as e:
        logger.error(f"路径规划失败: {str(e)}")
        state["learning_path"] = {
            "error": f"路径规划失败: {str(e)}",
            "nodes": []
        }
    
    return state


def _build_fallback_learning_path(
    target_knowledge_points: list[str],
    course_code: str | None,
) -> dict[str, Any]:
    nodes: list[dict[str, Any]] = []
    for index, point in enumerate(target_knowledge_points or ["core_topic"], start=1):
        nodes.append(
            {
                "node_id": f"fallback_{index}",
                "node_name": point,
                "node_desc": f"Fallback path node for {point}",
                "node_type": 1 if index == 1 else 2,
                "difficulty_level": min(5, max(1, index + 1)),
                "estimated_duration": 45,
                "prerequisites": [] if index == 1 else [f"fallback_{index - 1}"],
                "resources": [],
                "completion_criteria": {"type": "manual_completion"},
            }
        )
    return {
        "path_name": "Personalized Learning Path",
        "path_desc": f"Fallback path for {course_code or 'general_course'}",
        "nodes": nodes,
        "total_nodes": len(nodes),
        "estimated_duration": sum(node.get("estimated_duration", 0) for node in nodes),
        "difficulty_level": _calculate_overall_difficulty(nodes),
        "knowledge_graph": {
            "nodes": [
                {
                    "id": node["node_id"],
                    "name": node["node_name"],
                    "level": node["difficulty_level"],
                    "prerequisites": node["prerequisites"],
                }
                for node in nodes
            ],
            "learning_order": [node["node_id"] for node in nodes],
        },
    }


async def path_planner_node(state: LearningAgentState) -> LearningAgentState:
    """Timeout-safe runtime-logged override for monitoring."""
    import asyncio

    from app.services.agent_runtime_logging_service import AgentRuntimeLoggingService

    user_id = state.get("user_id")
    profile = state.get("profile", {})
    course_code = state.get("course_code")
    target_knowledge_points = state.get("target_knowledge_points", [])
    runtime_logger = AgentRuntimeLoggingService()

    if not user_id or not profile:
        state["learning_path"] = {
            "error": "missing user_id or profile",
            "nodes": [],
        }
        return state

    try:
        async with runtime_logger.track(
            agent_name="path_planner_agent",
            start_message="path_planner_agent started",
            success_message="path_planner_agent completed",
            start_payload={
                "user_id": user_id,
                "course_code": course_code,
                "target_knowledge_points": target_knowledge_points,
            },
            success_payload_factory=lambda: {
                "node_count": len(state.get("learning_path", {}).get("nodes", [])),
                "estimated_duration": state.get("learning_path", {}).get("estimated_duration"),
            },
            error_message="path_planner_agent failed",
        ):
            try:
                knowledge_graph = await asyncio.wait_for(
                    _analyze_knowledge_dependencies(target_knowledge_points, course_code),
                    timeout=45,
                )
                path_structure = await asyncio.wait_for(
                    _generate_path_structure(profile, knowledge_graph, course_code),
                    timeout=45,
                )
                enriched_nodes = await asyncio.wait_for(
                    _enrich_path_nodes(path_structure["nodes"], profile, course_code),
                    timeout=30,
                )
                state["learning_path"] = {
                    "path_name": path_structure.get("path_name", "Personalized Learning Path"),
                    "path_desc": path_structure.get("path_desc", ""),
                    "nodes": enriched_nodes,
                    "total_nodes": len(enriched_nodes),
                    "estimated_duration": sum(node.get("estimated_duration", 0) for node in enriched_nodes),
                    "difficulty_level": _calculate_overall_difficulty(enriched_nodes),
                    "knowledge_graph": knowledge_graph,
                }
            except TimeoutError:
                state["learning_path"] = _build_fallback_learning_path(
                    target_knowledge_points=target_knowledge_points,
                    course_code=course_code,
                )
                state["learning_path"]["fallback_reason"] = "llm_timeout"

            trace = state.get("execution_trace", [])
            trace.append(f"path_planner:generated_{len(state['learning_path'].get('nodes', []))}_nodes")
            state["execution_trace"] = trace
            logger.info(
                "path planning completed",
                user_id=user_id,
                node_count=len(state["learning_path"].get("nodes", [])),
                fallback_reason=state["learning_path"].get("fallback_reason"),
            )
    except Exception as exc:
        logger.error("path planning failed", error=str(exc), user_id=user_id)
        state["learning_path"] = {
            "error": f"path planning failed: {str(exc)}",
            "nodes": [],
        }

    return state


def _build_fallback_learning_path(
    target_knowledge_points: list[str],
    course_code: str | None,
) -> dict[str, Any]:
    nodes: list[dict[str, Any]] = []
    for index, point in enumerate(target_knowledge_points or ["core_topic"], start=1):
        nodes.append(
            {
                "node_id": f"fallback_{index}",
                "node_name": point,
                "node_desc": f"Fallback path node for {point}",
                "node_type": 1 if index == 1 else 2,
                "difficulty_level": min(5, max(1, index + 1)),
                "estimated_duration": 45,
                "prerequisites": [] if index == 1 else [f"fallback_{index - 1}"],
                "resources": [],
                "completion_criteria": {"type": "manual_completion"},
            }
        )
    return {
        "path_name": "Personalized Learning Path",
        "path_desc": f"Fallback path for {course_code or 'general_course'}",
        "nodes": nodes,
        "total_nodes": len(nodes),
        "estimated_duration": sum(node.get("estimated_duration", 0) for node in nodes),
        "difficulty_level": _calculate_overall_difficulty(nodes),
        "knowledge_graph": {
            "nodes": [
                {
                    "id": node["node_id"],
                    "name": node["node_name"],
                    "level": node["difficulty_level"],
                    "prerequisites": node["prerequisites"],
                }
                for node in nodes
            ],
            "learning_order": [node["node_id"] for node in nodes],
        },
    }


async def path_planner_node(state: LearningAgentState) -> LearningAgentState:
    """Timeout-safe runtime-logged override for monitoring."""
    import asyncio

    from app.services.agent_runtime_logging_service import AgentRuntimeLoggingService

    user_id = state.get("user_id")
    profile = state.get("profile", {})
    course_code = state.get("course_code")
    target_knowledge_points = state.get("target_knowledge_points", [])
    runtime_logger = AgentRuntimeLoggingService()

    if not user_id or not profile:
        state["learning_path"] = {
            "error": "missing user_id or profile",
            "nodes": [],
        }
        return state

    try:
        async with runtime_logger.track(
            agent_name="path_planner_agent",
            start_message="path_planner_agent started",
            success_message="path_planner_agent completed",
            start_payload={
                "user_id": user_id,
                "course_code": course_code,
                "target_knowledge_points": target_knowledge_points,
            },
            success_payload_factory=lambda: {
                "node_count": len(state.get("learning_path", {}).get("nodes", [])),
                "estimated_duration": state.get("learning_path", {}).get("estimated_duration"),
            },
            error_message="path_planner_agent failed",
        ):
            try:
                knowledge_graph = await asyncio.wait_for(
                    _analyze_knowledge_dependencies(target_knowledge_points, course_code),
                    timeout=45,
                )
                path_structure = await asyncio.wait_for(
                    _generate_path_structure(profile, knowledge_graph, course_code),
                    timeout=45,
                )
                enriched_nodes = await asyncio.wait_for(
                    _enrich_path_nodes(path_structure["nodes"], profile, course_code),
                    timeout=30,
                )
                state["learning_path"] = {
                    "path_name": path_structure.get("path_name", "Personalized Learning Path"),
                    "path_desc": path_structure.get("path_desc", ""),
                    "nodes": enriched_nodes,
                    "total_nodes": len(enriched_nodes),
                    "estimated_duration": sum(node.get("estimated_duration", 0) for node in enriched_nodes),
                    "difficulty_level": _calculate_overall_difficulty(enriched_nodes),
                    "knowledge_graph": knowledge_graph,
                }
            except TimeoutError:
                state["learning_path"] = _build_fallback_learning_path(
                    target_knowledge_points=target_knowledge_points,
                    course_code=course_code,
                )
                state["learning_path"]["fallback_reason"] = "llm_timeout"

            trace = state.get("execution_trace", [])
            trace.append(f"path_planner:generated_{len(state['learning_path'].get('nodes', []))}_nodes")
            state["execution_trace"] = trace
            logger.info(
                "path planning completed",
                user_id=user_id,
                node_count=len(state["learning_path"].get("nodes", [])),
                fallback_reason=state["learning_path"].get("fallback_reason"),
            )
    except Exception as exc:
        logger.error("path planning failed", error=str(exc), user_id=user_id)
        state["learning_path"] = {
            "error": f"path planning failed: {str(exc)}",
            "nodes": [],
        }

    return state


async def path_planner_node(state: LearningAgentState) -> LearningAgentState:
    """Runtime-logged override for monitoring."""
    from app.services.agent_runtime_logging_service import AgentRuntimeLoggingService

    user_id = state.get("user_id")
    profile = state.get("profile", {})
    course_code = state.get("course_code")
    target_knowledge_points = state.get("target_knowledge_points", [])
    runtime_logger = AgentRuntimeLoggingService()

    if not user_id or not profile:
        state["learning_path"] = {
            "error": "missing user_id or profile",
            "nodes": [],
        }
        return state

    try:
        async with runtime_logger.track(
            agent_name="path_planner_agent",
            start_message="path_planner_agent started",
            success_message="path_planner_agent completed",
            start_payload={
                "user_id": user_id,
                "course_code": course_code,
                "target_knowledge_points": target_knowledge_points,
            },
            success_payload_factory=lambda: {
                "node_count": len(state.get("learning_path", {}).get("nodes", [])),
                "estimated_duration": state.get("learning_path", {}).get("estimated_duration"),
            },
            error_message="path_planner_agent failed",
        ):
            knowledge_graph = await _analyze_knowledge_dependencies(
                target_knowledge_points,
                course_code,
            )
            path_structure = await _generate_path_structure(
                profile,
                knowledge_graph,
                course_code,
            )
            enriched_nodes = await _enrich_path_nodes(
                path_structure["nodes"],
                profile,
                course_code,
            )
            learning_path = {
                "path_name": path_structure.get("path_name", "涓€у寲瀛︿範璺緞"),
                "path_desc": path_structure.get("path_desc", ""),
                "nodes": enriched_nodes,
                "total_nodes": len(enriched_nodes),
                "estimated_duration": sum(node.get("estimated_duration", 0) for node in enriched_nodes),
                "difficulty_level": _calculate_overall_difficulty(enriched_nodes),
                "knowledge_graph": knowledge_graph,
            }
            state["learning_path"] = learning_path
            trace = state.get("execution_trace", [])
            trace.append(f"path_planner:generated_{len(enriched_nodes)}_nodes")
            state["execution_trace"] = trace
            logger.info(f"璺緞瑙勫垝瀹屾垚: user_id={user_id}, nodes={len(enriched_nodes)}")

    except Exception as e:
        logger.error(f"璺緞瑙勫垝澶辫触: {str(e)}")
        state["learning_path"] = {
            "error": f"璺緞瑙勫垝澶辫触: {str(e)}",
            "nodes": [],
        }

    return state


def _build_fallback_learning_path(
    target_knowledge_points: list[str],
    course_code: str | None,
) -> dict[str, Any]:
    nodes = []
    for index, point in enumerate(target_knowledge_points or ["core_topic"], start=1):
        nodes.append(
            {
                "node_id": f"fallback_{index}",
                "node_name": point,
                "node_desc": f"Fallback path node for {point}",
                "node_type": 1 if index == 1 else 2,
                "difficulty_level": min(5, max(1, index + 1)),
                "estimated_duration": 45,
                "prerequisites": [] if index == 1 else [f"fallback_{index - 1}"],
                "resources": [],
                "completion_criteria": {"type": "manual_completion"},
            }
        )
    return {
        "path_name": "Personalized Learning Path",
        "path_desc": f"Fallback path for {course_code or 'general_course'}",
        "nodes": nodes,
        "total_nodes": len(nodes),
        "estimated_duration": sum(node.get("estimated_duration", 0) for node in nodes),
        "difficulty_level": _calculate_overall_difficulty(nodes),
        "knowledge_graph": {
            "nodes": [
                {
                    "id": node["node_id"],
                    "name": node["node_name"],
                    "level": node["difficulty_level"],
                    "prerequisites": node["prerequisites"],
                }
                for node in nodes
            ],
            "learning_order": [node["node_id"] for node in nodes],
        },
    }


async def path_planner_node(state: LearningAgentState) -> LearningAgentState:
    """Timeout-safe runtime-logged override for monitoring."""
    import asyncio

    from app.services.agent_runtime_logging_service import AgentRuntimeLoggingService

    user_id = state.get("user_id")
    profile = state.get("profile", {})
    course_code = state.get("course_code")
    target_knowledge_points = state.get("target_knowledge_points", [])
    runtime_logger = AgentRuntimeLoggingService()

    if not user_id or not profile:
        state["learning_path"] = {
            "error": "missing user_id or profile",
            "nodes": [],
        }
        return state

    try:
        async with runtime_logger.track(
            agent_name="path_planner_agent",
            start_message="path_planner_agent started",
            success_message="path_planner_agent completed",
            start_payload={
                "user_id": user_id,
                "course_code": course_code,
                "target_knowledge_points": target_knowledge_points,
            },
            success_payload_factory=lambda: {
                "node_count": len(state.get("learning_path", {}).get("nodes", [])),
                "estimated_duration": state.get("learning_path", {}).get("estimated_duration"),
            },
            error_message="path_planner_agent failed",
        ):
            try:
                knowledge_graph = await asyncio.wait_for(
                    _analyze_knowledge_dependencies(target_knowledge_points, course_code),
                    timeout=45,
                )
                path_structure = await asyncio.wait_for(
                    _generate_path_structure(profile, knowledge_graph, course_code),
                    timeout=45,
                )
                enriched_nodes = await asyncio.wait_for(
                    _enrich_path_nodes(path_structure["nodes"], profile, course_code),
                    timeout=30,
                )
                state["learning_path"] = {
                    "path_name": path_structure.get("path_name", "Personalized Learning Path"),
                    "path_desc": path_structure.get("path_desc", ""),
                    "nodes": enriched_nodes,
                    "total_nodes": len(enriched_nodes),
                    "estimated_duration": sum(node.get("estimated_duration", 0) for node in enriched_nodes),
                    "difficulty_level": _calculate_overall_difficulty(enriched_nodes),
                    "knowledge_graph": knowledge_graph,
                }
            except TimeoutError:
                state["learning_path"] = _build_fallback_learning_path(
                    target_knowledge_points=target_knowledge_points,
                    course_code=course_code,
                )
                state["learning_path"]["fallback_reason"] = "llm_timeout"

            trace = state.get("execution_trace", [])
            trace.append(f"path_planner:generated_{len(state['learning_path'].get('nodes', []))}_nodes")
            state["execution_trace"] = trace
            logger.info(
                "path planning completed",
                user_id=user_id,
                node_count=len(state["learning_path"].get("nodes", [])),
                fallback_reason=state["learning_path"].get("fallback_reason"),
            )
    except Exception as exc:
        logger.error("path planning failed", error=str(exc), user_id=user_id)
        state["learning_path"] = {
            "error": f"path planning failed: {str(exc)}",
            "nodes": [],
        }

    return state


async def _analyze_knowledge_dependencies(
    target_points: List[str],
    course_code: Optional[str]
) -> Dict[str, Any]:
    """
    分析知识点依赖关系,构建知识图谱
    
    Args:
        target_points: 目标知识点列表
        course_code: 课程代码
        
    Returns:
        知识图谱结构
    """
    llm = get_llm()
    
    prompt = f"""你是一个教育专家,请分析以下知识点的依赖关系。

课程: {course_code or '通用课程'}
目标知识点: {', '.join(target_points)}

请按照以下格式输出知识点依赖关系:

{{
    "nodes": [
        {{
            "id": "知识点ID",
            "name": "知识点名称",
            "level": "难度等级(1-5)",
            "prerequisites": ["前置知识点ID列表"]
        }}
    ],
    "learning_order": ["按学习顺序排列的知识点ID列表"]
}}

要求:
1. 识别知识点之间的前置依赖关系
2. 确保学习顺序符合认知规律
3. 难度等级要合理递增
4. 如果没有明确的前置关系,prerequisites可以为空数组

请直接返回JSON格式,不要添加其他说明文字。"""

    try:
        response = await llm.ainvoke(prompt)
        content = response.content if hasattr(response, 'content') else str(response)
        
        # 提取JSON内容
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        knowledge_graph = json.loads(content)
        return knowledge_graph
        
    except Exception as e:
        logger.error(f"知识点依赖分析失败: {str(e)}")
        # 返回默认结构
        return {
            "nodes": [
                {
                    "id": f"kp_{i}",
                    "name": point,
                    "level": 3,
                    "prerequisites": []
                }
                for i, point in enumerate(target_points)
            ],
            "learning_order": [f"kp_{i}" for i in range(len(target_points))]
        }


async def _generate_path_structure(
    profile: Dict[str, Any],
    knowledge_graph: Dict[str, Any],
    course_code: Optional[str]
) -> Dict[str, Any]:
    """
    根据学生画像和知识图谱生成路径结构
    
    Args:
        profile: 学生画像
        knowledge_graph: 知识图谱
        course_code: 课程代码
        
    Returns:
        路径结构
    """
    llm = get_llm()
    
    # 提取画像关键信息
    knowledge_base = profile.get("knowledge_base", {})
    cognitive_style = profile.get("cognitive_style", {})
    learning_progress = profile.get("learning_progress", {})
    interest_direction = profile.get("interest_direction", {})
    
    prompt = f"""你是一个个性化学习路径规划专家,请根据学生画像和知识图谱生成学习路径。

学生画像:
- 知识基础: {json.dumps(knowledge_base, ensure_ascii=False)}
- 认知风格: {json.dumps(cognitive_style, ensure_ascii=False)}
- 学习进度: {json.dumps(learning_progress, ensure_ascii=False)}
- 兴趣方向: {json.dumps(interest_direction, ensure_ascii=False)}

知识图谱:
{json.dumps(knowledge_graph, ensure_ascii=False, indent=2)}

课程: {course_code or '通用课程'}

请生成一个阶梯式学习路径,包含以下内容:

{{
    "path_name": "路径名称",
    "path_desc": "路径描述",
    "nodes": [
        {{
            "node_name": "节点名称",
            "node_desc": "节点描述",
            "node_order": 1,
            "node_type": 1,
            "stage_type": 1,
            "knowledge_points": ["知识点列表"],
            "prerequisite_nodes": [],
            "difficulty_level": 3,
            "estimated_duration": 60
        }}
    ]
}}

节点类型说明:
- node_type: 1-学习节点, 2-练习节点, 3-测评节点, 4-复习节点
- stage_type: 1-基础阶段, 2-进阶阶段, 3-高级阶段, 4-综合阶段
- difficulty_level: 1-入门, 2-初级, 3-中级, 4-高级, 5-专家

要求:
1. 根据学生的知识基础调整起点难度
2. 根据认知风格安排节点类型(如偏好实践则多安排练习节点)
3. 根据学习进度设置合理的节点数量和时长
4. 确保难度阶梯式递增
5. 在关键节点后安排测评节点
6. 每3-4个学习节点后安排一个练习或测评节点

请直接返回JSON格式,不要添加其他说明文字。"""

    try:
        response = await llm.ainvoke(prompt)
        content = response.content if hasattr(response, 'content') else str(response)
        
        # 提取JSON内容
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        path_structure = json.loads(content)
        return path_structure
        
    except Exception as e:
        logger.error(f"路径结构生成失败: {str(e)}")
        # 返回默认结构
        return {
            "path_name": "个性化学习路径",
            "path_desc": "根据您的学习情况定制的学习路径",
            "nodes": []
        }


async def _enrich_path_nodes(
    nodes: List[Dict[str, Any]],
    profile: Dict[str, Any],
    course_code: Optional[str]
) -> List[Dict[str, Any]]:
    """
    为路径节点匹配资源和设置完成条件
    
    Args:
        nodes: 节点列表
        profile: 学生画像
        course_code: 课程代码
        
    Returns:
        丰富后的节点列表
    """
    llm = get_llm()
    
    enriched_nodes = []
    
    for node in nodes:
        try:
            # 为每个节点匹配资源
            resources = await _match_resources_for_node(
                node,
                profile,
                course_code
            )
            
            # 设置完成条件
            completion_criteria = _generate_completion_criteria(node)
            
            enriched_node = {
                **node,
                "resources": resources,
                "completion_criteria": completion_criteria,
                "is_locked": node.get("node_order", 1) > 1  # 第一个节点解锁,其他锁定
            }
            
            enriched_nodes.append(enriched_node)
            
        except Exception as e:
            logger.error(f"节点丰富失败: {str(e)}")
            enriched_nodes.append(node)
    
    return enriched_nodes


async def _match_resources_for_node(
    node: Dict[str, Any],
    profile: Dict[str, Any],
    course_code: Optional[str]
) -> List[Dict[str, Any]]:
    """
    为节点匹配学习资源
    
    Args:
        node: 节点信息
        profile: 学生画像
        course_code: 课程代码
        
    Returns:
        资源列表
    """
    # 根据节点类型和学生偏好匹配资源
    node_type = node.get("node_type", 1)
    cognitive_style = profile.get("cognitive_style", {})
    learning_preference = cognitive_style.get("learning_preference", "视频")
    
    resources = []
    
    if node_type == 1:  # 学习节点
        # 根据学习偏好推荐资源类型
        if "视频" in learning_preference:
            resources.append({
                "resource_type": "video",
                "resource_name": f"{node.get('node_name', '')} - 视频讲解",
                "is_required": True,
                "resource_order": 1,
                "estimated_duration": int(node.get("estimated_duration", 60) * 0.6)
            })
        
        resources.append({
            "resource_type": "document",
            "resource_name": f"{node.get('node_name', '')} - 学习资料",
            "is_required": True,
            "resource_order": 2,
            "estimated_duration": int(node.get("estimated_duration", 60) * 0.4)
        })
        
    elif node_type == 2:  # 练习节点
        resources.append({
            "resource_type": "exercise",
            "resource_name": f"{node.get('node_name', '')} - 练习题",
            "is_required": True,
            "resource_order": 1,
            "estimated_duration": node.get("estimated_duration", 30)
        })
        
    elif node_type == 3:  # 测评节点
        resources.append({
            "resource_type": "test",
            "resource_name": f"{node.get('node_name', '')} - 测评",
            "is_required": True,
            "resource_order": 1,
            "estimated_duration": node.get("estimated_duration", 45)
        })
    
    return resources


def _generate_completion_criteria(node: Dict[str, Any]) -> Dict[str, Any]:
    """
    生成节点完成条件
    
    Args:
        node: 节点信息
        
    Returns:
        完成条件配置
    """
    node_type = node.get("node_type", 1)
    
    if node_type == 1:  # 学习节点
        return {
            "type": "resource_completion",
            "required_resources": "all",
            "min_duration_minutes": int(node.get("estimated_duration", 60) * 0.8)
        }
    elif node_type == 2:  # 练习节点
        return {
            "type": "exercise_completion",
            "min_correct_rate": 0.7,
            "min_questions": 5
        }
    elif node_type == 3:  # 测评节点
        return {
            "type": "test_completion",
            "min_score": 60,
            "pass_required": True
        }
    else:
        return {
            "type": "manual_completion"
        }


def _calculate_overall_difficulty(nodes: List[Dict[str, Any]]) -> int:
    """
    计算路径整体难度
    
    Args:
        nodes: 节点列表
        
    Returns:
        整体难度等级(1-5)
    """
    if not nodes:
        return 3
    
    difficulties = [node.get("difficulty_level", 3) for node in nodes]
    avg_difficulty = sum(difficulties) / len(difficulties)
    
    return round(avg_difficulty)


def _build_fallback_learning_path(
    target_knowledge_points: list[str],
    course_code: str | None,
) -> dict[str, Any]:
    nodes: list[dict[str, Any]] = []
    for index, point in enumerate(target_knowledge_points or ["core_topic"], start=1):
        nodes.append(
            {
                "node_id": f"fallback_{index}",
                "node_name": point,
                "node_desc": f"Fallback path node for {point}",
                "node_type": 1 if index == 1 else 2,
                "difficulty_level": min(5, max(1, index + 1)),
                "estimated_duration": 45,
                "prerequisites": [] if index == 1 else [f"fallback_{index - 1}"],
                "resources": [],
                "completion_criteria": {"type": "manual_completion"},
            }
        )
    return {
        "path_name": "Personalized Learning Path",
        "path_desc": f"Fallback path for {course_code or 'general_course'}",
        "nodes": nodes,
        "total_nodes": len(nodes),
        "estimated_duration": sum(node.get("estimated_duration", 0) for node in nodes),
        "difficulty_level": _calculate_overall_difficulty(nodes),
        "knowledge_graph": {
            "nodes": [
                {
                    "id": node["node_id"],
                    "name": node["node_name"],
                    "level": node["difficulty_level"],
                    "prerequisites": node["prerequisites"],
                }
                for node in nodes
            ],
            "learning_order": [node["node_id"] for node in nodes],
        },
    }


async def path_planner_node(state: LearningAgentState) -> LearningAgentState:
    """Timeout-safe runtime-logged override for monitoring."""
    import asyncio

    from app.services.agent_runtime_logging_service import AgentRuntimeLoggingService

    user_id = state.get("user_id")
    profile = state.get("profile", {})
    course_code = state.get("course_code")
    target_knowledge_points = state.get("target_knowledge_points", [])
    runtime_logger = AgentRuntimeLoggingService()

    if not user_id or not profile:
        state["learning_path"] = {
            "error": "missing user_id or profile",
            "nodes": [],
        }
        return state

    try:
        async with runtime_logger.track(
            agent_name="path_planner_agent",
            start_message="path_planner_agent started",
            success_message="path_planner_agent completed",
            start_payload={
                "user_id": user_id,
                "course_code": course_code,
                "target_knowledge_points": target_knowledge_points,
            },
            success_payload_factory=lambda: {
                "node_count": len(state.get("learning_path", {}).get("nodes", [])),
                "estimated_duration": state.get("learning_path", {}).get("estimated_duration"),
            },
            error_message="path_planner_agent failed",
        ):
            try:
                knowledge_graph = await asyncio.wait_for(
                    _analyze_knowledge_dependencies(target_knowledge_points, course_code),
                    timeout=45,
                )
                path_structure = await asyncio.wait_for(
                    _generate_path_structure(profile, knowledge_graph, course_code),
                    timeout=45,
                )
                enriched_nodes = await asyncio.wait_for(
                    _enrich_path_nodes(path_structure["nodes"], profile, course_code),
                    timeout=30,
                )
                state["learning_path"] = {
                    "path_name": path_structure.get("path_name", "Personalized Learning Path"),
                    "path_desc": path_structure.get("path_desc", ""),
                    "nodes": enriched_nodes,
                    "total_nodes": len(enriched_nodes),
                    "estimated_duration": sum(node.get("estimated_duration", 0) for node in enriched_nodes),
                    "difficulty_level": _calculate_overall_difficulty(enriched_nodes),
                    "knowledge_graph": knowledge_graph,
                }
            except TimeoutError:
                state["learning_path"] = _build_fallback_learning_path(
                    target_knowledge_points=target_knowledge_points,
                    course_code=course_code,
                )
                state["learning_path"]["fallback_reason"] = "llm_timeout"

            trace = state.get("execution_trace", [])
            trace.append(f"path_planner:generated_{len(state['learning_path'].get('nodes', []))}_nodes")
            state["execution_trace"] = trace
            logger.info(
                "path planning completed",
                user_id=user_id,
                node_count=len(state["learning_path"].get("nodes", [])),
                fallback_reason=state["learning_path"].get("fallback_reason"),
            )
    except Exception as exc:
        logger.error("path planning failed", error=str(exc), user_id=user_id)
        state["learning_path"] = {
            "error": f"path planning failed: {str(exc)}",
            "nodes": [],
        }

    return state
