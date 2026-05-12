"""
资源生成协调器

功能:
1. 协调多个资源生成智能体
2. 并行生成控制
3. 任务分发和优先级管理
4. 结果聚合和质量评估
"""

from typing import TYPE_CHECKING, Dict, Any, List, Optional
import asyncio
from datetime import datetime

from app.agents.state import LearningAgentState

if TYPE_CHECKING:
    from .document_agent import DocumentGenerationAgent
    from .mindmap_agent import MindmapGenerationAgent
    from .question_bank_agent import QuestionBankGenerationAgent
    from .video_agent import VideoRecommendationAgent
    from .code_example_agent import CodeExampleGenerationAgent


class ResourceGenerationCoordinator:
    """资源生成协调器"""
    
    def __init__(self):
        self.document_agent = None
        self.mindmap_agent = None
        self.question_bank_agent = None
        self.video_agent = None
        self.code_example_agent = None
        self._agent_import_error: Optional[str] = None

        try:
            from .code_example_agent import CodeExampleGenerationAgent
            from .document_agent import DocumentGenerationAgent
            from .mindmap_agent import MindmapGenerationAgent
            from .question_bank_agent import QuestionBankGenerationAgent
            from .video_agent import VideoRecommendationAgent
        except ModuleNotFoundError as exc:
            self._agent_import_error = (
                "资源生成依赖未安装，暂时无法执行多智能体生成"
                f"（缺少模块: {exc.name}）"
            )
            return

        self.document_agent = DocumentGenerationAgent()
        self.mindmap_agent = MindmapGenerationAgent()
        self.question_bank_agent = QuestionBankGenerationAgent()
        self.video_agent = VideoRecommendationAgent()
        self.code_example_agent = CodeExampleGenerationAgent()

    def _require_agent(self, agent: Any, agent_name: str) -> Any:
        if agent is None:
            raise RuntimeError(
                self._agent_import_error
                or f"{agent_name} 未初始化，无法执行资源生成"
            )
        return agent
    
    async def coordinate_generation(
        self,
        knowledge_point: str,
        resource_types: List[int],
        student_profile: Optional[Dict[str, Any]] = None,
        course_context: Optional[str] = None,
        related_knowledge: Optional[List[str]] = None,
        programming_language: str = "Python"
    ) -> Dict[str, Any]:
        """
        协调多个智能体生成资源
        
        Args:
            knowledge_point: 知识点名称
            resource_types: 资源类型列表 [1-文档, 2-导图, 3-题库, 4-视频, 5-代码]
            student_profile: 学生画像
            course_context: 课程上下文
            related_knowledge: 相关知识点
            programming_language: 编程语言(用于代码案例)
            
        Returns:
            包含所有生成结果的字典
        """
        start_time = datetime.now()
        
        # 创建任务列表
        tasks = []
        task_names = []
        
        # 1-文档生成
        if 1 in resource_types:
            tasks.append(self._generate_document(
                knowledge_point, student_profile, course_context, related_knowledge
            ))
            task_names.append("document")
        
        # 2-思维导图生成
        if 2 in resource_types:
            tasks.append(self._generate_mindmap(
                knowledge_point, course_context, related_knowledge
            ))
            task_names.append("mindmap")
        
        # 3-题库生成
        if 3 in resource_types:
            tasks.append(self._generate_question_bank(knowledge_point))
            task_names.append("question_bank")
        
        # 4-视频推荐
        if 4 in resource_types:
            tasks.append(self._recommend_videos(knowledge_point, student_profile))
            task_names.append("video")
        
        # 5-代码案例生成
        if 5 in resource_types:
            difficulty_level = student_profile.get("difficulty_level", 1) if student_profile else 1
            tasks.append(self._generate_code_example(
                knowledge_point, programming_language, difficulty_level
            ))
            task_names.append("code_example")
        
        # 并行执行所有任务
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 聚合结果
        aggregated_results = {}
        success_count = 0
        failed_count = 0
        
        for i, (task_name, result) in enumerate(zip(task_names, results)):
            if isinstance(result, Exception):
                aggregated_results[task_name] = {
                    "success": False,
                    "error": str(result)
                }
                failed_count += 1
            else:
                aggregated_results[task_name] = {
                    "success": True,
                    "data": result
                }
                success_count += 1
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        # 计算整体质量评分
        overall_quality = self._calculate_overall_quality(aggregated_results)
        
        return {
            "results": aggregated_results,
            "summary": {
                "total_tasks": len(tasks),
                "success_count": success_count,
                "failed_count": failed_count,
                "duration_seconds": duration,
                "overall_quality_score": overall_quality
            }
        }
    
    async def _generate_document(
        self,
        knowledge_point: str,
        student_profile: Optional[Dict[str, Any]],
        course_context: Optional[str],
        related_knowledge: Optional[List[str]]
    ) -> Dict[str, Any]:
        """生成文档"""
        agent = self._require_agent(self.document_agent, "document_agent")
        return await agent.generate_document(
            knowledge_point=knowledge_point,
            student_profile=student_profile,
            course_context=course_context,
            related_knowledge=related_knowledge
        )
    
    async def _generate_mindmap(
        self,
        knowledge_point: str,
        course_context: Optional[str],
        related_knowledge: Optional[List[str]]
    ) -> Dict[str, Any]:
        """生成思维导图"""
        agent = self._require_agent(self.mindmap_agent, "mindmap_agent")
        return await agent.generate_mindmap(
            knowledge_point=knowledge_point,
            course_context=course_context,
            related_knowledge=related_knowledge
        )
    
    async def _generate_question_bank(self, knowledge_point: str) -> Dict[str, Any]:
        """生成题库"""
        agent = self._require_agent(self.question_bank_agent, "question_bank_agent")
        return await agent.generate_question_bank(
            knowledge_point=knowledge_point
        )
    
    async def _recommend_videos(
        self,
        knowledge_point: str,
        student_profile: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """推荐视频"""
        agent = self._require_agent(self.video_agent, "video_agent")
        return await agent.recommend_videos(
            knowledge_point=knowledge_point,
            student_profile=student_profile
        )
    
    async def _generate_code_example(
        self,
        knowledge_point: str,
        programming_language: str,
        difficulty_level: int
    ) -> Dict[str, Any]:
        """生成代码案例"""
        agent = self._require_agent(self.code_example_agent, "code_example_agent")
        return await agent.generate_code_example(
            knowledge_point=knowledge_point,
            programming_language=programming_language,
            difficulty_level=difficulty_level
        )
    
    def _calculate_overall_quality(self, results: Dict[str, Any]) -> float:
        """
        计算整体质量评分
        
        综合考虑:
        1. 成功率
        2. 各资源的质量分数
        """
        total_score = 0.0
        valid_count = 0
        
        for resource_type, result in results.items():
            if result.get("success"):
                data = result.get("data", {})
                
                # 提取质量分数
                if resource_type == "document":
                    quality = data.get("quality_score", 0.5)
                    total_score += quality
                    valid_count += 1
                elif resource_type == "mindmap":
                    # 根据节点数和深度评估
                    node_count = data.get("node_count", 0)
                    max_depth = data.get("max_depth", 0)
                    quality = min(1.0, (node_count / 30 + max_depth / 4) / 2)
                    total_score += quality
                    valid_count += 1
                elif resource_type == "question_bank":
                    # 根据题目数量评估
                    total_questions = data.get("total_questions", 0)
                    quality = min(1.0, total_questions / 10)
                    total_score += quality
                    valid_count += 1
                elif resource_type == "video":
                    # 根据推荐数量评估
                    recommended_count = data.get("recommended_count", 0)
                    quality = min(1.0, recommended_count / 5)
                    total_score += quality
                    valid_count += 1
                elif resource_type == "code_example":
                    # 根据代码结构评估
                    code_structure = data.get("code_structure", {})
                    line_count = code_structure.get("line_count", 0)
                    quality = min(1.0, line_count / 100)
                    total_score += quality
                    valid_count += 1
        
        if valid_count == 0:
            return 0.0
        
        return round(total_score / valid_count, 2)


async def resource_coordinator_node(state: LearningAgentState) -> LearningAgentState:
    """
    资源生成协调器节点
    
    协调多个智能体并行生成资源
    """
    # 获取必要参数
    knowledge_point = state.get("knowledge_point", "")
    resource_types = state.get("resource_types", [1, 2, 3, 4, 5])  # 默认生成所有类型
    student_profile = state.get("student_profile", {})
    course_context = state.get("course_context", "")
    related_knowledge = state.get("related_knowledge", [])
    programming_language = state.get("programming_language", "Python")
    
    if not knowledge_point:
        state["coordination_result"] = {
            "success": False,
            "error": "缺少知识点信息"
        }
        return state
    
    # 创建协调器并执行
    coordinator = ResourceGenerationCoordinator()
    
    try:
        result = await coordinator.coordinate_generation(
            knowledge_point=knowledge_point,
            resource_types=resource_types,
            student_profile=student_profile,
            course_context=course_context,
            related_knowledge=related_knowledge,
            programming_language=programming_language
        )
        
        state["coordination_result"] = {
            "success": True,
            "data": result
        }
        
        # 将各个资源结果也保存到状态中
        results = result.get("results", {})
        if "document" in results:
            state["document_result"] = results["document"]
        if "mindmap" in results:
            state["mindmap_result"] = results["mindmap"]
        if "question_bank" in results:
            state["question_bank_result"] = results["question_bank"]
        if "video" in results:
            state["video_result"] = results["video"]
        if "code_example" in results:
            state["code_example_result"] = results["code_example"]
        
        # 记录执行轨迹
        summary = result.get("summary", {})
        trace = state.get("execution_trace", [])
        trace.append(
            f"resource_coordination:success:"
            f"total={summary.get('total_tasks')},"
            f"success={summary.get('success_count')},"
            f"failed={summary.get('failed_count')},"
            f"quality={summary.get('overall_quality_score')}"
        )
        state["execution_trace"] = trace
        
    except Exception as e:
        state["coordination_result"] = {
            "success": False,
            "error": str(e)
        }
        
        # 记录错误
        trace = state.get("execution_trace", [])
        trace.append(f"resource_coordination:failed:{str(e)}")
        state["execution_trace"] = trace
    
    return state
