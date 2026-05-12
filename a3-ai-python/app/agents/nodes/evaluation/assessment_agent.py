"""
效果评估智能体
负责多维度分析学习效果
包括知识点掌握度计算、学习效率评估等
"""
from collections import defaultdict
from typing import Any

from app.agents.state import LearningAgentState
from app.core.logging import logger


class AssessmentAgent:
    """效果评估智能体"""

    def __init__(self):
        pass

    def assess_learning_effectiveness(
        self,
        grading_results: list[dict[str, Any]],
        questions: list[dict[str, Any]],
        test_record: dict[str, Any],
    ) -> dict[str, Any]:
        """
        评估学习效果
        
        Args:
            grading_results: 批改结果列表
            questions: 题目列表
            test_record: 测评记录
            
        Returns:
            评估结果
        """
        # 1. 知识点掌握度分析
        knowledge_mastery = self._analyze_knowledge_mastery(
            grading_results=grading_results,
            questions=questions,
        )

        # 2. 能力维度分析
        ability_analysis = self._analyze_ability_dimensions(
            grading_results=grading_results,
            questions=questions,
        )

        # 3. 学习效率分析
        learning_efficiency = self._analyze_learning_efficiency(
            test_record=test_record,
            grading_results=grading_results,
        )

        # 4. 综合评分
        overall_score = self._calculate_overall_score(grading_results)

        # 5. 掌握等级
        mastery_level = self._determine_mastery_level(overall_score)

        assessment_result = {
            "overall_score": overall_score,
            "mastery_level": mastery_level,
            "knowledge_mastery": knowledge_mastery,
            "ability_analysis": ability_analysis,
            "learning_efficiency": learning_efficiency,
        }

        logger.info(
            f"学习效果评估完成: 综合得分={overall_score}, 掌握等级={mastery_level}"
        )

        return assessment_result

    def _analyze_knowledge_mastery(
        self,
        grading_results: list[dict[str, Any]],
        questions: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        分析知识点掌握度
        
        Returns:
            知识点掌握度数据
        """
        # 按知识点分组统计
        kp_stats = defaultdict(lambda: {"total": 0, "correct": 0, "scores": []})

        question_map = {q.get("id") or q.get("question_id"): q for q in questions}

        for result in grading_results:
            question_id = result.get("question_id")
            question = question_map.get(question_id)

            if not question:
                continue

            kp = question.get("knowledge_point", "未分类")
            is_correct = result.get("is_correct")
            score = result.get("score", 0)

            kp_stats[kp]["total"] += 1
            if is_correct == 1:
                kp_stats[kp]["correct"] += 1
            if score is not None:
                kp_stats[kp]["scores"].append(score)

        # 计算每个知识点的掌握度
        knowledge_points = []
        for kp, stats in kp_stats.items():
            total = stats["total"]
            correct = stats["correct"]
            accuracy = round(correct / total * 100, 2) if total > 0 else 0

            # 计算平均得分率
            scores = stats["scores"]
            avg_score_rate = 0
            if scores:
                # 假设每题满分相同,计算平均得分率
                avg_score_rate = round(sum(scores) / len(scores) / 10 * 100, 2)

            # 确定掌握等级
            mastery_level = self._determine_kp_mastery_level(accuracy)

            knowledge_points.append(
                {
                    "knowledge_point": kp,
                    "total_questions": total,
                    "correct_count": correct,
                    "accuracy_rate": accuracy,
                    "avg_score_rate": avg_score_rate,
                    "mastery_level": mastery_level,
                }
            )

        # 按准确率排序
        knowledge_points.sort(key=lambda x: x["accuracy_rate"])

        return {
            "knowledge_points": knowledge_points,
            "weak_points": [kp for kp in knowledge_points if kp["accuracy_rate"] < 60],
            "strong_points": [
                kp for kp in knowledge_points if kp["accuracy_rate"] >= 80
            ],
        }

    def _analyze_ability_dimensions(
        self,
        grading_results: list[dict[str, Any]],
        questions: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        分析能力维度
        按难度层级统计表现
        
        Returns:
            能力维度分析数据
        """
        difficulty_stats = defaultdict(lambda: {"total": 0, "correct": 0, "scores": []})

        question_map = {q.get("id") or q.get("question_id"): q for q in questions}

        for result in grading_results:
            question_id = result.get("question_id")
            question = question_map.get(question_id)

            if not question:
                continue

            difficulty = question.get("difficulty_level", 1)
            is_correct = result.get("is_correct")
            score = result.get("score", 0)

            difficulty_stats[difficulty]["total"] += 1
            if is_correct == 1:
                difficulty_stats[difficulty]["correct"] += 1
            if score is not None:
                difficulty_stats[difficulty]["scores"].append(score)

        difficulty_map = {1: "基础", 2: "进阶", 3: "拔高"}

        dimensions = []
        for level in [1, 2, 3]:
            stats = difficulty_stats[level]
            total = stats["total"]
            correct = stats["correct"]

            if total == 0:
                continue

            accuracy = round(correct / total * 100, 2)

            dimensions.append(
                {
                    "level": level,
                    "level_name": difficulty_map[level],
                    "total_questions": total,
                    "correct_count": correct,
                    "accuracy_rate": accuracy,
                    "status": "优秀" if accuracy >= 80 else "良好" if accuracy >= 60 else "需提升",
                }
            )

        return {
            "dimensions": dimensions,
            "basic_ability": next(
                (d["accuracy_rate"] for d in dimensions if d["level"] == 1), 0
            ),
            "intermediate_ability": next(
                (d["accuracy_rate"] for d in dimensions if d["level"] == 2), 0
            ),
            "advanced_ability": next(
                (d["accuracy_rate"] for d in dimensions if d["level"] == 3), 0
            ),
        }

    def _analyze_learning_efficiency(
        self,
        test_record: dict[str, Any],
        grading_results: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        分析学习效率
        
        Returns:
            学习效率分析数据
        """
        time_spent = test_record.get("time_spent", 0)  # 秒
        total_questions = test_record.get("total_questions", 0)
        accuracy_rate = test_record.get("accuracy_rate", 0)

        # 平均答题时间
        avg_time_per_question = (
            round(time_spent / total_questions, 2) if total_questions > 0 else 0
        )

        # 效率评分 (综合时间和准确率)
        # 时间效率: 假设理想时间为每题 60 秒
        ideal_time = 60
        time_efficiency = min(ideal_time / avg_time_per_question, 1.0) if avg_time_per_question > 0 else 0
        time_efficiency = round(time_efficiency * 100, 2)

        # 综合效率 = 时间效率 * 0.3 + 准确率 * 0.7
        overall_efficiency = round(time_efficiency * 0.3 + accuracy_rate * 0.7, 2)

        return {
            "time_spent_seconds": time_spent,
            "time_spent_minutes": round(time_spent / 60, 2),
            "avg_time_per_question": avg_time_per_question,
            "time_efficiency": time_efficiency,
            "accuracy_rate": accuracy_rate,
            "overall_efficiency": overall_efficiency,
            "efficiency_level": self._determine_efficiency_level(overall_efficiency),
        }

    def _calculate_overall_score(
        self, grading_results: list[dict[str, Any]]
    ) -> float:
        """计算综合得分"""
        total_score = 0
        full_score = 0

        for result in grading_results:
            score = result.get("score")
            if score is not None:
                total_score += score
                # 假设每题满分 10 分
                full_score += 10

        if full_score == 0:
            return 0

        return round(total_score / full_score * 100, 2)

    def _determine_mastery_level(self, overall_score: float) -> str:
        """确定掌握等级"""
        if overall_score >= 90:
            return "精通"
        elif overall_score >= 80:
            return "熟练掌握"
        elif overall_score >= 70:
            return "基本掌握"
        elif overall_score >= 60:
            return "初步了解"
        else:
            return "未掌握"

    def _determine_kp_mastery_level(self, accuracy: float) -> int:
        """确定知识点掌握等级"""
        if accuracy >= 90:
            return 4  # 精通
        elif accuracy >= 75:
            return 3  # 熟练掌握
        elif accuracy >= 60:
            return 2  # 基本掌握
        elif accuracy >= 40:
            return 1  # 初步了解
        else:
            return 0  # 未掌握

    def _determine_efficiency_level(self, efficiency: float) -> str:
        """确定效率等级"""
        if efficiency >= 80:
            return "高效"
        elif efficiency >= 60:
            return "良好"
        elif efficiency >= 40:
            return "一般"
        else:
            return "需提升"


async def assessment_node(state: LearningAgentState) -> LearningAgentState:
    """
    效果评估节点
    从状态中读取批改结果,进行多维度效果评估
    """
    agent = AssessmentAgent()

    grading_results = state.get("grading_results", [])
    questions = state.get("questions", [])
    test_record = state.get("test_record", {})

    try:
        assessment_result = agent.assess_learning_effectiveness(
            grading_results=grading_results,
            questions=questions,
            test_record=test_record,
        )

        state["assessment_result"] = assessment_result

        # 更新执行轨迹
        trace = state.get("execution_trace", [])
        trace.append("assessment")
        state["execution_trace"] = trace

    except Exception as e:
        logger.error(f"效果评估节点执行失败: {e}")
        state["error"] = str(e)

    return state
