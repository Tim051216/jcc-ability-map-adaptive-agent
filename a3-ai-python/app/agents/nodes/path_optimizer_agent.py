"""
路径优化智能体
基于学习效果动态优化学习路径
"""
from typing import Dict, List, Any, Optional
from app.agents.state import LearningAgentState
from app.core.logging import logger
from app.integrations.llm.client import get_llm_client
import json


class _CompatLLM:
    def __init__(self) -> None:
        self._client = get_llm_client()

    async def ainvoke(self, prompt: str):
        return await self._client.chat_completion(messages=[{"role": "user", "content": prompt}])


def get_llm() -> _CompatLLM:
    return _CompatLLM()


async def path_optimizer_node(state: LearningAgentState) -> LearningAgentState:
    """
    路径优化智能体节点
    
    功能:
    1. 分析学习效果数据
    2. 识别薄弱知识点
    3. 生成路径调整建议
    4. 优化后续学习难度
    """
    user_id = state.get("user_id")
    learning_path = state.get("learning_path", {})
    learning_records = state.get("learning_records", [])
    assessment_results = state.get("assessment_results", [])
    
    if not user_id or not learning_path:
        state["path_optimization"] = {
            "needed": False,
            "reason": "缺少路径信息"
        }
        return state
    
    try:
        # 1. 分析学习效果
        effectiveness_analysis = await _analyze_learning_effectiveness(
            learning_records,
            assessment_results
        )
        
        # 2. 识别薄弱知识点
        weak_points = _identify_weak_knowledge_points(
            effectiveness_analysis,
            assessment_results
        )
        
        # 3. 生成调整策略
        adjustment_strategy = await _generate_adjustment_strategy(
            learning_path,
            effectiveness_analysis,
            weak_points
        )
        
        # 4. 生成调整建议
        optimization_result = {
            "needed": adjustment_strategy.get("needed", False),
            "effectiveness_analysis": effectiveness_analysis,
            "weak_points": weak_points,
            "adjustment_strategy": adjustment_strategy,
            "recommendations": adjustment_strategy.get("recommendations", [])
        }
        
        state["path_optimization"] = optimization_result
        
        # 记录执行轨迹
        trace = state.get("execution_trace", [])
        trace.append(f"path_optimizer:analyzed_{len(weak_points)}_weak_points")
        state["execution_trace"] = trace
        
        logger.info(f"路径优化分析完成: user_id={user_id}, needed={adjustment_strategy.get('needed')}")
        
    except Exception as e:
        logger.error(f"路径优化失败: {str(e)}")
        state["path_optimization"] = {
            "needed": False,
            "error": f"路径优化失败: {str(e)}"
        }
    
    return state


async def path_optimizer_node(state: LearningAgentState) -> LearningAgentState:
    """Runtime-logged override for monitoring."""
    from app.services.agent_runtime_logging_service import AgentRuntimeLoggingService

    user_id = state.get("user_id")
    learning_path = state.get("learning_path", {})
    learning_records = state.get("learning_records", [])
    assessment_results = state.get("assessment_results", [])
    runtime_logger = AgentRuntimeLoggingService()

    if not user_id or not learning_path:
        state["path_optimization"] = {
            "needed": False,
            "reason": "missing learning_path",
        }
        return state

    try:
        async with runtime_logger.track(
            agent_name="path_optimizer_agent",
            start_message="path_optimizer_agent started",
            success_message="path_optimizer_agent completed",
            start_payload={
                "user_id": user_id,
                "learning_record_count": len(learning_records),
                "assessment_result_count": len(assessment_results),
                "path_node_count": len(learning_path.get("nodes", [])),
            },
            success_payload_factory=lambda: {
                "needed": state.get("path_optimization", {}).get("needed"),
                "weak_point_count": len(state.get("path_optimization", {}).get("weak_points", [])),
            },
            error_message="path_optimizer_agent failed",
        ):
            effectiveness_analysis = await _analyze_learning_effectiveness(
                learning_records,
                assessment_results,
            )
            weak_points = _identify_weak_knowledge_points(
                effectiveness_analysis,
                assessment_results,
            )
            adjustment_strategy = await _generate_adjustment_strategy(
                learning_path,
                effectiveness_analysis,
                weak_points,
            )
            optimization_result = {
                "needed": adjustment_strategy.get("needed", False),
                "effectiveness_analysis": effectiveness_analysis,
                "weak_points": weak_points,
                "adjustment_strategy": adjustment_strategy,
                "recommendations": adjustment_strategy.get("recommendations", []),
            }
            state["path_optimization"] = optimization_result
            trace = state.get("execution_trace", [])
            trace.append(f"path_optimizer:analyzed_{len(weak_points)}_weak_points")
            state["execution_trace"] = trace
            logger.info(f"璺緞浼樺寲鍒嗘瀽瀹屾垚: user_id={user_id}, needed={adjustment_strategy.get('needed')}")

    except Exception as e:
        logger.error(f"璺緞浼樺寲澶辫触: {str(e)}")
        state["path_optimization"] = {
            "needed": False,
            "error": f"璺緞浼樺寲澶辫触: {str(e)}",
        }

    return state


async def _analyze_learning_effectiveness(
    learning_records: List[Dict[str, Any]],
    assessment_results: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    分析学习效果
    
    Args:
        learning_records: 学习记录列表
        assessment_results: 测评结果列表
        
    Returns:
        效果分析结果
    """
    llm = get_llm()
    
    # 计算基础指标
    total_duration = sum(record.get("duration", 0) for record in learning_records)
    completed_nodes = len([r for r in learning_records if r.get("completed", False)])
    
    # 计算测评指标
    test_scores = [result.get("score", 0) for result in assessment_results]
    avg_score = sum(test_scores) / len(test_scores) if test_scores else 0
    
    # 计算正确率
    total_questions = sum(result.get("total_questions", 0) for result in assessment_results)
    correct_questions = sum(result.get("correct_questions", 0) for result in assessment_results)
    accuracy_rate = correct_questions / total_questions if total_questions > 0 else 0
    
    prompt = f"""你是一个学习效果分析专家,请分析以下学习数据。

学习记录:
- 总学习时长: {total_duration} 分钟
- 完成节点数: {completed_nodes}

测评结果:
- 平均分数: {avg_score:.1f}
- 正确率: {accuracy_rate:.2%}
- 测评次数: {len(assessment_results)}

详细测评结果:
{json.dumps(assessment_results, ensure_ascii=False, indent=2)}

请分析学习效果,返回以下格式的JSON:

{{
    "overall_effectiveness": "整体效果评价(优秀/良好/一般/较差)",
    "learning_efficiency": "学习效率评价(高/中/低)",
    "knowledge_mastery": "知识掌握度评价(优秀/良好/一般/较差)",
    "problem_areas": ["存在的问题列表"],
    "strengths": ["优势方面列表"],
    "suggestions": ["改进建议列表"]
}}

请直接返回JSON格式,不要添加其他说明文字。"""

    try:
        response = await llm.ainvoke(prompt)
        content = response.content if hasattr(response, 'content') else str(response)
        
        # 提取JSON内容
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        analysis = json.loads(content)
        
        # 添加数值指标
        analysis["metrics"] = {
            "total_duration": total_duration,
            "completed_nodes": completed_nodes,
            "avg_score": avg_score,
            "accuracy_rate": accuracy_rate
        }
        
        return analysis
        
    except Exception as e:
        logger.error(f"学习效果分析失败: {str(e)}")
        return {
            "overall_effectiveness": "一般",
            "learning_efficiency": "中",
            "knowledge_mastery": "一般",
            "problem_areas": [],
            "strengths": [],
            "suggestions": [],
            "metrics": {
                "total_duration": total_duration,
                "completed_nodes": completed_nodes,
                "avg_score": avg_score,
                "accuracy_rate": accuracy_rate
            }
        }


def _identify_weak_knowledge_points(
    effectiveness_analysis: Dict[str, Any],
    assessment_results: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    识别薄弱知识点
    
    Args:
        effectiveness_analysis: 效果分析结果
        assessment_results: 测评结果列表
        
    Returns:
        薄弱知识点列表
    """
    weak_points = []
    
    # 从测评结果中提取错误的知识点
    for result in assessment_results:
        wrong_questions = result.get("wrong_questions", [])
        for question in wrong_questions:
            knowledge_point = question.get("knowledge_point")
            if knowledge_point:
                # 检查是否已存在
                existing = next((wp for wp in weak_points if wp["name"] == knowledge_point), None)
                if existing:
                    existing["error_count"] += 1
                else:
                    weak_points.append({
                        "name": knowledge_point,
                        "error_count": 1,
                        "difficulty": question.get("difficulty", 3)
                    })
    
    # 按错误次数排序
    weak_points.sort(key=lambda x: x["error_count"], reverse=True)
    
    return weak_points


async def _generate_adjustment_strategy(
    learning_path: Dict[str, Any],
    effectiveness_analysis: Dict[str, Any],
    weak_points: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    生成路径调整策略
    
    Args:
        learning_path: 当前学习路径
        effectiveness_analysis: 效果分析结果
        weak_points: 薄弱知识点列表
        
    Returns:
        调整策略
    """
    llm = get_llm()
    
    # 判断是否需要调整
    metrics = effectiveness_analysis.get("metrics", {})
    accuracy_rate = metrics.get("accuracy_rate", 1.0)
    avg_score = metrics.get("avg_score", 100)
    
    # 如果正确率低于70%或平均分低于60分,需要调整
    needs_adjustment = accuracy_rate < 0.7 or avg_score < 60 or len(weak_points) > 3
    
    if not needs_adjustment:
        return {
            "needed": False,
            "reason": "学习效果良好,暂不需要调整",
            "recommendations": ["继续保持当前学习节奏"]
        }
    
    prompt = f"""你是一个学习路径优化专家,请根据学习效果分析生成调整策略。

当前学习路径:
{json.dumps(learning_path, ensure_ascii=False, indent=2)}

学习效果分析:
{json.dumps(effectiveness_analysis, ensure_ascii=False, indent=2)}

薄弱知识点:
{json.dumps(weak_points, ensure_ascii=False, indent=2)}

请生成路径调整策略,返回以下格式的JSON:

{{
    "needed": true,
    "adjustment_type": "调整类型(1-自动优化, 2-手动调整, 3-难度调整, 4-节点增删)",
    "trigger_reason": "触发原因说明",
    "adjustments": [
        {{
            "action": "操作类型(add_node/remove_node/adjust_difficulty/reorder)",
            "target": "目标节点或知识点",
            "details": "详细说明",
            "priority": "优先级(high/medium/low)"
        }}
    ],
    "recommendations": ["给学生的建议列表"],
    "expected_improvements": ["预期改进效果列表"]
}}

调整原则:
1. 对于薄弱知识点,增加针对性的练习节点
2. 如果整体难度过高,降低后续节点难度
3. 如果学习效率低,调整节点顺序或减少节点数量
4. 保持路径的连贯性和逻辑性

请直接返回JSON格式,不要添加其他说明文字。"""

    try:
        response = await llm.ainvoke(prompt)
        content = response.content if hasattr(response, 'content') else str(response)
        
        # 提取JSON内容
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        strategy = json.loads(content)
        return strategy
        
    except Exception as e:
        logger.error(f"调整策略生成失败: {str(e)}")
        return {
            "needed": True,
            "adjustment_type": 1,
            "trigger_reason": "学习效果需要改进",
            "adjustments": [
                {
                    "action": "add_node",
                    "target": wp["name"],
                    "details": f"增加{wp['name']}的练习节点",
                    "priority": "high"
                }
                for wp in weak_points[:3]  # 只处理前3个薄弱点
            ],
            "recommendations": [
                "建议加强薄弱知识点的练习",
                "可以适当降低学习节奏",
                "遇到困难及时寻求帮助"
            ],
            "expected_improvements": [
                "提高薄弱知识点的掌握度",
                "提升整体学习效果"
            ]
        }


async def apply_path_adjustment(
    path_id: int,
    adjustment_strategy: Dict[str, Any]
) -> Dict[str, Any]:
    """
    应用路径调整
    
    Args:
        path_id: 路径ID
        adjustment_strategy: 调整策略
        
    Returns:
        调整结果
    """
    # 这个函数将在Service层实现
    # 这里只是定义接口
    pass


async def path_optimizer_node(state: LearningAgentState) -> LearningAgentState:
    """ASCII-safe runtime-logged override for monitoring."""
    from app.services.agent_runtime_logging_service import AgentRuntimeLoggingService

    user_id = state.get("user_id")
    learning_path = state.get("learning_path", {})
    learning_records = state.get("learning_records", [])
    assessment_results = state.get("assessment_results", [])
    runtime_logger = AgentRuntimeLoggingService()

    if not user_id or not learning_path:
        state["path_optimization"] = {
            "needed": False,
            "reason": "missing learning_path",
        }
        return state

    try:
        async with runtime_logger.track(
            agent_name="path_optimizer_agent",
            start_message="path_optimizer_agent started",
            success_message="path_optimizer_agent completed",
            start_payload={
                "user_id": user_id,
                "learning_record_count": len(learning_records),
                "assessment_result_count": len(assessment_results),
                "path_node_count": len(learning_path.get("nodes", [])),
            },
            success_payload_factory=lambda: {
                "needed": state.get("path_optimization", {}).get("needed"),
                "weak_point_count": len(state.get("path_optimization", {}).get("weak_points", [])),
            },
            error_message="path_optimizer_agent failed",
        ):
            effectiveness_analysis = await _analyze_learning_effectiveness(
                learning_records,
                assessment_results,
            )
            weak_points = _identify_weak_knowledge_points(
                effectiveness_analysis,
                assessment_results,
            )
            adjustment_strategy = await _generate_adjustment_strategy(
                learning_path,
                effectiveness_analysis,
                weak_points,
            )
            state["path_optimization"] = {
                "needed": adjustment_strategy.get("needed", False),
                "effectiveness_analysis": effectiveness_analysis,
                "weak_points": weak_points,
                "adjustment_strategy": adjustment_strategy,
                "recommendations": adjustment_strategy.get("recommendations", []),
            }
            trace = state.get("execution_trace", [])
            trace.append(f"path_optimizer:analyzed_{len(weak_points)}_weak_points")
            state["execution_trace"] = trace
            logger.info(
                "path optimization completed",
                user_id=user_id,
                needed=adjustment_strategy.get("needed"),
            )
    except Exception as exc:
        logger.error("path optimization failed", error=str(exc), user_id=user_id)
        state["path_optimization"] = {
            "needed": False,
            "error": f"path optimization failed: {str(exc)}",
        }

    return state
