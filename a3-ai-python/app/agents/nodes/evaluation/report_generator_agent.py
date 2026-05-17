"""
报告生成智能体
负责生成个性化学习评估报告
包括优势分析、薄弱点分析和改进建议
"""
from typing import Any

from app.agents.state import LearningAgentState
from app.core.logging import logger
from app.integrations.llm.client import get_llm_client


class ReportGeneratorAgent:
    """报告生成智能体"""

    def __init__(self):
        self.llm_client = get_llm_client()

    async def generate_report(
        self,
        assessment_result: dict[str, Any],
        grading_results: list[dict[str, Any]],
        questions: list[dict[str, Any]],
        user_profile: dict[str, Any] = None,
    ) -> dict[str, Any]:
        """
        生成个性化评估报告
        
        Args:
            assessment_result: 效果评估结果
            grading_results: 批改结果
            questions: 题目列表
            user_profile: 学生画像 (可选)
            
        Returns:
            评估报告
        """
        # 1. 提取关键数据
        overall_score = assessment_result.get("overall_score", 0)
        mastery_level = assessment_result.get("mastery_level", "未掌握")
        knowledge_mastery = assessment_result.get("knowledge_mastery", {})
        ability_analysis = assessment_result.get("ability_analysis", {})
        learning_efficiency = assessment_result.get("learning_efficiency", {})

        # 2. 分析优势和薄弱点
        strengths = self._analyze_strengths(
            knowledge_mastery=knowledge_mastery,
            ability_analysis=ability_analysis,
        )

        weaknesses = self._analyze_weaknesses(
            knowledge_mastery=knowledge_mastery,
            ability_analysis=ability_analysis,
        )

        # 3. 生成改进建议
        improvement_suggestions = await self._generate_suggestions(
            overall_score=overall_score,
            mastery_level=mastery_level,
            weaknesses=weaknesses,
            learning_efficiency=learning_efficiency,
            user_profile=user_profile,
        )

        # 4. 推荐学习资源
        recommended_resources = self._recommend_resources(
            weaknesses=weaknesses,
            knowledge_mastery=knowledge_mastery,
        )

        # 5. 生成报告摘要
        report_summary = self._generate_summary(
            overall_score=overall_score,
            mastery_level=mastery_level,
            strengths=strengths,
            weaknesses=weaknesses,
        )

        report = {
            "report_summary": report_summary,
            "overall_score": overall_score,
            "mastery_level": mastery_level,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "improvement_suggestions": improvement_suggestions,
            "recommended_resources": recommended_resources,
            "knowledge_mastery": knowledge_mastery,
            "ability_analysis": ability_analysis,
            "learning_efficiency": learning_efficiency,
        }

        logger.info(f"评估报告生成完成: 综合得分={overall_score}, 掌握等级={mastery_level}")

        return report

    def _analyze_strengths(
        self,
        knowledge_mastery: dict[str, Any],
        ability_analysis: dict[str, Any],
    ) -> list[str]:
        """分析优势"""
        strengths = []

        # 知识点优势
        strong_points = knowledge_mastery.get("strong_points", [])
        if strong_points:
            kp_names = [kp["knowledge_point"] for kp in strong_points[:3]]
            strengths.append(f"在 {', '.join(kp_names)} 等知识点上表现优秀")

        # 能力维度优势
        dimensions = ability_analysis.get("dimensions", [])
        for dim in dimensions:
            if dim.get("accuracy_rate", 0) >= 80:
                level_name = dim.get("level_name", "")
                accuracy = dim.get("accuracy_rate", 0)
                strengths.append(f"{level_name}题目掌握良好,正确率达到 {accuracy}%")

        # 学习效率优势
        # (可以根据需要添加)

        if not strengths:
            strengths.append("继续保持学习热情,稳步提升")

        return strengths

    def _analyze_weaknesses(
        self,
        knowledge_mastery: dict[str, Any],
        ability_analysis: dict[str, Any],
    ) -> list[str]:
        """分析薄弱点"""
        weaknesses = []

        # 知识点薄弱
        weak_points = knowledge_mastery.get("weak_points", [])
        if weak_points:
            kp_names = [kp["knowledge_point"] for kp in weak_points[:3]]
            weaknesses.append(f"{', '.join(kp_names)} 等知识点需要加强")

        # 能力维度薄弱
        dimensions = ability_analysis.get("dimensions", [])
        for dim in dimensions:
            if dim.get("accuracy_rate", 0) < 60:
                level_name = dim.get("level_name", "")
                accuracy = dim.get("accuracy_rate", 0)
                weaknesses.append(f"{level_name}题目正确率较低 ({accuracy}%),需要重点提升")

        if not weaknesses:
            weaknesses.append("整体表现良好,继续保持")

        return weaknesses

    async def _generate_suggestions(
        self,
        overall_score: float,
        mastery_level: str,
        weaknesses: list[str],
        learning_efficiency: dict[str, Any],
        user_profile: dict[str, Any] = None,
    ) -> list[str]:
        """生成改进建议"""
        suggestions = []

        # 基于分数的建议
        if overall_score < 60:
            suggestions.append("建议系统复习基础知识,打好基础")
        elif overall_score < 80:
            suggestions.append("基础掌握较好,可以尝试更多进阶练习")
        else:
            suggestions.append("掌握程度优秀,可以挑战更高难度的内容")

        # 基于薄弱点的建议
        if weaknesses:
            suggestions.append("针对薄弱知识点进行专项练习,查漏补缺")

        # 基于学习效率的建议
        efficiency_level = learning_efficiency.get("efficiency_level", "")
        if efficiency_level == "需提升":
            suggestions.append("建议合理安排学习时间,提高答题效率")

        # 使用 AI 生成个性化建议
        if user_profile:
            ai_suggestions = await self._generate_ai_suggestions(
                overall_score=overall_score,
                mastery_level=mastery_level,
                weaknesses=weaknesses,
                user_profile=user_profile,
            )
            if ai_suggestions:
                suggestions.extend(ai_suggestions)

        return suggestions[:5]  # 最多返回 5 条建议

    async def _generate_ai_suggestions(
        self,
        overall_score: float,
        mastery_level: str,
        weaknesses: list[str],
        user_profile: dict[str, Any],
    ) -> list[str]:
        """使用 AI 生成个性化建议"""
        try:
            learning_style = user_profile.get("cognitive_style", "")
            learning_habit = user_profile.get("learning_habit", "")

            prompt = f"""你是一位专业的学习顾问,请根据学生的学习情况和个人特点,提供个性化的学习建议。

学习情况:
- 综合得分: {overall_score} 分
- 掌握等级: {mastery_level}
- 薄弱点: {', '.join(weaknesses)}

学生特点:
- 认知风格: {learning_style}
- 学习习惯: {learning_habit}

请提供 2-3 条具体可行的学习建议,每条建议应该:
1. 针对学生的薄弱点
2. 符合学生的学习风格
3. 具体可操作

请直接列出建议,每条建议一行,不需要编号。
"""

            response = await self.llm_client.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=300,
            )

            content = response.get("content", "")
            suggestions = [
                line.strip()
                for line in content.split("\n")
                if line.strip() and not line.strip().startswith("#")
            ]

            return suggestions[:3]

        except Exception as e:
            logger.error(f"AI 建议生成失败: {e}")
            return []

    def _recommend_resources(
        self,
        weaknesses: list[str],
        knowledge_mastery: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """推荐学习资源"""
        resources = []

        # 基于薄弱知识点推荐资源
        weak_points = knowledge_mastery.get("weak_points", [])

        for kp in weak_points[:3]:
            knowledge_point = kp.get("knowledge_point", "")
            resources.append(
                {
                    "type": "practice",
                    "title": f"{knowledge_point} 专项练习",
                    "description": f"针对 {knowledge_point} 的强化练习题",
                    "knowledge_point": knowledge_point,
                    "difficulty_level": 1,  # 从基础开始
                }
            )

            resources.append(
                {
                    "type": "video",
                    "title": f"{knowledge_point} 知识讲解",
                    "description": f"{knowledge_point} 的详细讲解视频",
                    "knowledge_point": knowledge_point,
                }
            )

        return resources[:5]  # 最多推荐 5 个资源

    def _generate_summary(
        self,
        overall_score: float,
        mastery_level: str,
        strengths: list[str],
        weaknesses: list[str],
    ) -> str:
        """生成报告摘要"""
        summary_parts = [
            f"本次测评综合得分 {overall_score} 分,掌握等级为 {mastery_level}。"
        ]

        if strengths:
            summary_parts.append(f"优势: {strengths[0]}")

        if weaknesses:
            summary_parts.append(f"需要改进: {weaknesses[0]}")

        return " ".join(summary_parts)


async def report_generator_node(state: LearningAgentState) -> LearningAgentState:
    """
    报告生成节点
    从状态中读取评估结果,生成个性化学习报告
    """
    agent = ReportGeneratorAgent()

    assessment_result = state.get("assessment_result", {})
    grading_results = state.get("grading_results", [])
    questions = state.get("questions", [])
    user_profile = state.get("user_profile")

    try:
        report = await agent.generate_report(
            assessment_result=assessment_result,
            grading_results=grading_results,
            questions=questions,
            user_profile=user_profile,
        )

        state["evaluation_report"] = report

        # 更新执行轨迹
        trace = state.get("execution_trace", [])
        trace.append("report_generator")
        state["execution_trace"] = trace

    except Exception as e:
        logger.error(f"报告生成节点执行失败: {e}")
        state["error"] = str(e)

    return state


async def report_generator_node(state: LearningAgentState) -> LearningAgentState:
    """Runtime-logged override for monitoring."""
    from app.services.agent_runtime_logging_service import AgentRuntimeLoggingService

    agent = ReportGeneratorAgent()
    runtime_logger = AgentRuntimeLoggingService()

    assessment_result = state.get("assessment_result", {})
    grading_results = state.get("grading_results", [])
    questions = state.get("questions", [])
    user_profile = state.get("user_profile")

    try:
        async with runtime_logger.track(
            agent_name="report_generator_agent",
            start_message="report_generator_agent started",
            success_message="report_generator_agent completed",
            start_payload={
                "question_count": len(questions),
                "grading_count": len(grading_results),
                "has_user_profile": bool(user_profile),
                "assessment_keys": list(assessment_result.keys()),
            },
            success_payload_factory=lambda: {
                "report_keys": list(state.get("evaluation_report", {}).keys()),
                "trace_size": len(state.get("execution_trace", [])),
            },
            error_message="report_generator_agent failed",
        ):
            report = await agent.generate_report(
                assessment_result=assessment_result,
                grading_results=grading_results,
                questions=questions,
                user_profile=user_profile,
            )

            state["evaluation_report"] = report

            trace = state.get("execution_trace", [])
            trace.append("report_generator")
            state["execution_trace"] = trace

    except Exception as e:
        logger.error(f"鎶ュ憡鐢熸垚鑺傜偣鎵ц澶辫触: {e}")
        state["error"] = str(e)

    return state
