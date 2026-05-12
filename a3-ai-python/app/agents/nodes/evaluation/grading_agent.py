"""
自动批改智能体
负责对学生答题进行自动批改
支持客观题自动批改和主观题智能批改
"""
import re
from typing import Any

from app.agents.state import LearningAgentState
from app.core.logging import logger
from app.integrations.llm.client import get_llm_client


class GradingAgent:
    """自动批改智能体"""

    def __init__(self):
        self.llm_client = get_llm_client()

    async def grade_answer(
        self,
        question: dict[str, Any],
        user_answer: str,
    ) -> dict[str, Any]:
        """
        批改单个答案
        
        Args:
            question: 题目信息
            user_answer: 学生答案
            
        Returns:
            批改结果 {is_correct, score, grading_type, feedback}
        """
        question_type = question.get("question_type", 1)
        correct_answer = question.get("correct_answer", "")
        full_score = question.get("score", 10)

        # 客观题自动批改
        if question_type in [1, 2, 3]:  # 单选、多选、判断
            return self._grade_objective_question(
                user_answer=user_answer,
                correct_answer=correct_answer,
                question_type=question_type,
                full_score=full_score,
            )

        # 主观题 AI 批改
        else:  # 填空、简答、编程
            return await self._grade_subjective_question(
                question=question,
                user_answer=user_answer,
                correct_answer=correct_answer,
                full_score=full_score,
            )

    def _grade_objective_question(
        self,
        user_answer: str,
        correct_answer: str,
        question_type: int,
        full_score: float,
    ) -> dict[str, Any]:
        """
        批改客观题 (单选、多选、判断)
        
        Returns:
            批改结果
        """
        # 标准化答案格式
        user_ans_normalized = self._normalize_answer(user_answer)
        correct_ans_normalized = self._normalize_answer(correct_answer)

        is_correct = user_ans_normalized == correct_ans_normalized

        if question_type == 2:  # 多选题
            # 多选题部分正确给部分分
            user_set = set(user_ans_normalized.split(","))
            correct_set = set(correct_ans_normalized.split(","))

            if user_set == correct_set:
                is_correct = True
                score = full_score
                feedback = "完全正确"
            else:
                correct_count = len(user_set & correct_set)
                wrong_count = len(user_set - correct_set)
                missing_count = len(correct_set - user_set)

                if wrong_count > 0:
                    # 有错选,不得分
                    is_correct = False
                    score = 0
                    feedback = f"答案错误,选错了 {wrong_count} 个选项"
                elif missing_count > 0:
                    # 漏选,部分得分
                    is_correct = False
                    score = full_score * correct_count / len(correct_set)
                    feedback = f"部分正确,漏选了 {missing_count} 个选项"
                else:
                    is_correct = True
                    score = full_score
                    feedback = "完全正确"
        else:
            # 单选题和判断题
            score = full_score if is_correct else 0
            feedback = "正确" if is_correct else "错误"

        return {
            "is_correct": 1 if is_correct else 0,
            "score": round(score, 2),
            "grading_type": 1,  # 自动批改
            "grading_feedback": feedback,
        }

    async def _grade_subjective_question(
        self,
        question: dict[str, Any],
        user_answer: str,
        correct_answer: str,
        full_score: float,
    ) -> dict[str, Any]:
        """
        批改主观题 (填空、简答、编程)
        使用 AI 进行智能批改
        
        Returns:
            批改结果
        """
        question_content = question.get("question_content", "")
        question_type = question.get("question_type", 4)
        knowledge_point = question.get("knowledge_point", "")
        answer_analysis = question.get("answer_analysis", "")

        prompt = self._build_grading_prompt(
            question_content=question_content,
            question_type=question_type,
            knowledge_point=knowledge_point,
            correct_answer=correct_answer,
            answer_analysis=answer_analysis,
            user_answer=user_answer,
            full_score=full_score,
        )

        try:
            response = await self.llm_client.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=500,
            )

            content = response.get("content", "")
            grading_result = self._parse_grading_result(content, full_score)

            grading_result["grading_type"] = 2  # AI 批改

            logger.info(
                f"AI 批改完成: 得分={grading_result['score']}/{full_score}, "
                f"正确性={grading_result['is_correct']}"
            )

            return grading_result

        except Exception as e:
            logger.error(f"AI 批改失败: {e}")
            error_text = str(e).strip() or e.__class__.__name__
            # 返回默认结果
            return {
                "is_correct": None,
                "score": None,
                "grading_type": 2,
                "grading_feedback": f"批改失败: {error_text}",
            }

    def _build_grading_prompt(
        self,
        question_content: str,
        question_type: int,
        knowledge_point: str,
        correct_answer: str,
        answer_analysis: str,
        user_answer: str,
        full_score: float,
    ) -> str:
        """构建批改提示词"""

        type_map = {4: "填空题", 5: "简答题", 6: "编程题"}
        type_desc = type_map.get(question_type, "主观题")

        prompt = f"""你是一位专业的教师,请对学生的答案进行批改和评分。

题目类型: {type_desc}
知识点: {knowledge_point}
满分: {full_score} 分

题目内容:
{question_content}

标准答案:
{correct_answer}

答案解析:
{answer_analysis}

学生答案:
{user_answer}

请根据以下标准进行批改:
1. 准确性: 答案是否正确,是否涵盖关键要点
2. 完整性: 答案是否完整,是否遗漏重要内容
3. 表达: 答案表达是否清晰,逻辑是否合理

请以以下格式返回批改结果:

得分: [0-{full_score}之间的数字]
正确性: [正确/部分正确/错误]
反馈: [详细的批改意见,指出答案的优点和不足]

要求:
- 评分要公正客观,严格按照标准答案
- 反馈要具体明确,帮助学生理解错误
- 对于部分正确的答案,要给予适当的分数
"""

        return prompt

    def _parse_grading_result(self, content: str, full_score: float) -> dict[str, Any]:
        """解析 AI 批改结果"""
        result = {
            "is_correct": None,
            "score": None,
            "grading_feedback": content,
        }

        try:
            # 提取得分
            score_match = re.search(r"得分[：:]\s*(\d+\.?\d*)", content)
            if score_match:
                score = float(score_match.group(1))
                result["score"] = min(score, full_score)  # 不超过满分

            # 提取正确性
            correctness_match = re.search(r"正确性[：:]\s*(正确|部分正确|错误)", content)
            if correctness_match:
                correctness = correctness_match.group(1)
                if correctness == "正确":
                    result["is_correct"] = 1
                elif correctness == "错误":
                    result["is_correct"] = 0
                else:
                    result["is_correct"] = None  # 部分正确

            # 提取反馈
            feedback_match = re.search(r"反馈[：:]\s*(.+)", content, re.DOTALL)
            if feedback_match:
                result["grading_feedback"] = feedback_match.group(1).strip()

        except Exception as e:
            logger.error(f"批改结果解析失败: {e}")

        return result

    def _normalize_answer(self, answer: str) -> str:
        """标准化答案格式"""
        if not answer:
            return ""

        # 转大写
        answer = answer.upper().strip()

        # 移除空格和特殊字符
        answer = re.sub(r"[\s,，、;；]", ",", answer)

        # 排序 (用于多选题)
        parts = answer.split(",")
        parts = [p.strip() for p in parts if p.strip()]
        parts.sort()

        return ",".join(parts)

    async def batch_grade(
        self,
        questions: list[dict[str, Any]],
        user_answers: dict[str, str],
    ) -> list[dict[str, Any]]:
        """
        批量批改
        
        Args:
            questions: 题目列表
            user_answers: 学生答案字典 {question_id: answer}
            
        Returns:
            批改结果列表
        """
        results = []

        for question in questions:
            question_id = question.get("id") or question.get("question_id")
            user_answer = user_answers.get(str(question_id), "")

            grading_result = await self.grade_answer(
                question=question,
                user_answer=user_answer,
            )

            grading_result["question_id"] = "" if question_id is None else str(question_id)
            grading_result["user_answer"] = user_answer

            results.append(grading_result)

        logger.info(f"批量批改完成: 共 {len(results)} 道题目")

        return results


async def grading_node(state: LearningAgentState) -> LearningAgentState:
    """
    批改节点
    从状态中读取题目和答案,调用智能体进行批改
    """
    agent = GradingAgent()

    questions = state.get("questions", [])
    user_answers = state.get("user_answers", {})

    try:
        grading_results = await agent.batch_grade(
            questions=questions,
            user_answers=user_answers,
        )

        state["grading_results"] = grading_results

        # 统计批改结果
        total = len(grading_results)
        correct = sum(1 for r in grading_results if r.get("is_correct") == 1)
        wrong = sum(1 for r in grading_results if r.get("is_correct") == 0)
        pending = total - correct - wrong

        state["grading_summary"] = {
            "total": total,
            "correct": correct,
            "wrong": wrong,
            "pending": pending,
            "accuracy_rate": round(correct / total * 100, 2) if total > 0 else 0,
        }

        # 更新执行轨迹
        trace = state.get("execution_trace", [])
        trace.append("grading")
        state["execution_trace"] = trace

    except Exception as e:
        logger.error(f"批改节点执行失败: {e}")
        state["error"] = str(e)

    return state
