"""
评估智能体服务
整合题目生成、自动批改、效果评估和报告生成等智能体功能
"""
from datetime import datetime
from typing import Any

from app.agents.nodes.evaluation import (
    assessment_node,
    grading_node,
    question_generator_node,
    report_generator_node,
)
from app.agents.state import LearningAgentState
from app.core.logging import logger
from app.services.guardrail_service import GuardrailContext, GuardrailService, GuardrailViolationError
from app.db.models import (
    EvaluationAnswerRecord,
    EvaluationKnowledgeMastery,
    EvaluationQuestion,
    EvaluationReport,
    EvaluationTest,
    EvaluationTestRecord,
    EvaluationWrongQuestion,
)
from app.db.session import get_db
from app.schemas.evaluation import (
    AnswerGradingRequest,
    AnswerGradingResponse,
    AssessmentRequest,
    AssessmentResponse,
    GeneratedQuestion,
    GradingResult,
    QuestionGenerateRequest,
    QuestionGenerateResponse,
    ReportGenerateRequest,
    ReportGenerateResponse,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class EvaluationAgentService:
    """评估智能体服务"""

    def __init__(self) -> None:
        self.guardrail_service = GuardrailService()

    async def generate_questions(
        self, request: QuestionGenerateRequest
    ) -> QuestionGenerateResponse:
        """
        生成题目
        调用题目生成智能体
        """
        try:
            guardrail_context = GuardrailContext(
                scene="evaluation_question_generation",
                course_id=request.test_id,
            )
            input_review = await self.guardrail_service.assert_safe_input(
                "\n".join([request.course_context or "", *request.knowledge_points]),
                context=guardrail_context,
            )

            # 构建智能体状态
            state: LearningAgentState = {
                "knowledge_points": request.knowledge_points,
                "difficulty_level": request.difficulty_level,
                "question_type": request.question_type,
                "question_count": request.count,
                "course_context": request.course_context,
                "generate_layered": request.generate_layered,
                "execution_trace": [],
            }

            # 调用题目生成节点
            result_state = await question_generator_node(state)

            # 提取生成的题目
            generated_questions = result_state.get("generated_questions", [])
            layered_questions = result_state.get("layered_questions")
            fallback_count = int(result_state.get("fallback_count", 0) or 0)
            fallback_knowledge_points = [
                str(item).strip()
                for item in (result_state.get("fallback_knowledge_points", []) or [])
                if str(item).strip()
            ]

            # 转换为响应格式
            questions = [
                GeneratedQuestion(**q) for q in generated_questions
            ]

            layered_response = None
            if layered_questions:
                layered_response = {
                    level: [GeneratedQuestion(**q) for q in qs]
                    for level, qs in layered_questions.items()
                }

            review = await self.guardrail_service.review_output(
                "\n".join(
                    [
                        q.get("question_content", "")
                        + " "
                        + q.get("answer_analysis", "")
                        + " "
                        + q.get("knowledge_point", "")
                        for q in generated_questions
                    ]
                ),
                context=guardrail_context,
                citations=request.knowledge_points,
            )

            if review.output_review and review.output_review.blocked:
                generated_questions = []
                questions = []
                layered_response = None

            if request.persist_to_db:
                async with get_db() as db:
                    await self._save_questions_to_db(
                        db=db,
                        test_id=request.test_id,
                        questions=generated_questions,
                    )

            logger.info(
                f"题目生成完成: test_id={request.test_id}, count={len(questions)}"
            )

            return QuestionGenerateResponse(
                test_id=request.test_id,
                questions=questions,
                layered_questions=layered_response,
                total_count=len(questions),
                fallback_count=fallback_count,
                fallback_knowledge_points=fallback_knowledge_points,
                safety_review={
                    "input_review": input_review.model_dump(mode="json"),
                    "output_review": review.output_review.model_dump(mode="json") if review.output_review else None,
                },
                hallucination_review=review.hallucination_review.model_dump(mode="json")
                if review.hallucination_review
                else None,
            )

        except GuardrailViolationError as exc:
            logger.warning("question_generation_blocked", detail=str(exc))
            return QuestionGenerateResponse(
                test_id=request.test_id,
                questions=[],
                layered_questions=None,
                total_count=0,
                fallback_count=0,
                fallback_knowledge_points=[],
                safety_review={"input_review": exc.review.model_dump(mode="json")},
                hallucination_review=None,
            )
        except Exception as e:
            logger.error(f"题目生成失败: {e}")
            raise

    async def grade_answers(
        self, request: AnswerGradingRequest
    ) -> AnswerGradingResponse:
        """
        批改答案
        调用自动批改智能体
        """
        try:
            if request.questions is not None:
                questions = request.questions
            else:
                async with get_db() as db:
                    questions = await self._get_test_questions(db, request.test_id)

            # 构建智能体状态
            state: LearningAgentState = {
                "questions": questions,
                "user_answers": request.answers,
                "execution_trace": [],
            }

            # 调用批改节点
            result_state = await grading_node(state)

            # 提取批改结果
            grading_results = result_state.get("grading_results", [])
            grading_summary = result_state.get("grading_summary", {})

            # 转换为响应格式
            results = [GradingResult(**r) for r in grading_results]

            if request.persist_results:
                async with get_db() as db:
                    await self._save_grading_results_to_db(
                        db=db,
                        test_id=request.test_id,
                        user_id=request.user_id,
                        grading_results=grading_results,
                    )

            logger.info(
                f"答案批改完成: test_id={request.test_id}, user_id={request.user_id}"
            )

            return AnswerGradingResponse(
                test_id=request.test_id,
                user_id=request.user_id,
                grading_results=results,
                summary=grading_summary,
            )

        except Exception as e:
            logger.error(f"答案批改失败: {e}")
            raise

    async def assess_learning_effectiveness(
        self, request: AssessmentRequest
    ) -> AssessmentResponse:
        """
        评估学习效果
        调用效果评估智能体
        """
        try:
            if request.questions is not None and request.grading_results is not None:
                questions = request.questions
                grading_results = request.grading_results
                test_record = dict(request.test_record or {})
                course_id = int(test_record.get("course_id") or 0)
            else:
                async with get_db() as db:
                    questions = await self._get_test_questions(db, request.test_id)
                    grading_results = await self._get_grading_results(
                        db, request.test_id, request.user_id
                    )
                    test_record = await self._get_test_record(
                        db, request.test_id, request.user_id
                    )
                    course_id = await self._get_test_course_id(db, request.test_id)

            # 构建智能体状态
            state: LearningAgentState = {
                "questions": questions,
                "grading_results": grading_results,
                "test_record": test_record,
                "execution_trace": [],
            }

            # 调用评估节点
            result_state = await assessment_node(state)

            # 提取评估结果
            assessment_result = result_state.get("assessment_result", {})

            # 本地联调时允许 Python 侧画像表缺失，不阻断 Java 主链路的评估结果返回。
            try:
                async with get_db() as db:
                    await self._persist_knowledge_mastery_to_db(
                        db=db,
                        user_id=request.user_id,
                        course_id=course_id,
                        assessment_result=assessment_result,
                    )
            except Exception as exc:
                logger.warning(
                    "知识点掌握度持久化失败，已跳过",
                    error=str(exc),
                    user_id=request.user_id,
                    course_id=course_id,
                    test_id=request.test_id,
                )

            logger.info(
                f"学习效果评估完成: test_id={request.test_id}, user_id={request.user_id}"
            )

            return AssessmentResponse(
                test_id=request.test_id,
                user_id=request.user_id,
                overall_score=assessment_result.get("overall_score", 0),
                mastery_level=assessment_result.get("mastery_level", "未掌握"),
                knowledge_mastery=assessment_result.get("knowledge_mastery", {}),
                ability_analysis=assessment_result.get("ability_analysis", {}),
                learning_efficiency=assessment_result.get("learning_efficiency", {}),
            )

        except Exception as e:
            logger.error(f"学习效果评估失败: {e}")
            raise

    async def generate_report(
        self, request: ReportGenerateRequest
    ) -> ReportGenerateResponse:
        """
        生成评估报告
        调用报告生成智能体
        """
        try:
            user_profile = None
            if (
                request.assessment_result is not None
                and request.questions is not None
                and request.grading_results is not None
            ):
                questions = request.questions
                grading_results = request.grading_results
                assessment_result = dict(request.assessment_result)
            else:
                async with get_db() as db:
                    if request.test_id:
                        questions = await self._get_test_questions(db, request.test_id)
                        grading_results = await self._get_grading_results(
                            db, request.test_id, request.user_id
                        )
                    else:
                        questions = []
                        grading_results = []

                    assessment_result = {}

            # 构建智能体状态
            state: LearningAgentState = {
                "assessment_result": assessment_result,
                "grading_results": grading_results,
                "questions": questions,
                "user_profile": user_profile,
                "execution_trace": [],
            }

            # 调用报告生成节点
            result_state = await report_generator_node(state)

            # 提取报告
            report = result_state.get("evaluation_report", {})

            report_id: int | None = None
            if request.persist_report:
                async with get_db() as db:
                    report_id = await self._save_report_to_db(
                        db=db,
                        user_id=request.user_id,
                        course_id=request.course_id,
                        report_type=request.report_type,
                        report=report,
                    )

            logger.info(
                f"评估报告生成完成: report_id={report_id}, user_id={request.user_id}"
            )

            return ReportGenerateResponse(
                report_id=report_id,
                user_id=request.user_id,
                course_id=request.course_id,
                report_type=request.report_type,
                overall_score=report.get("overall_score", 0),
                mastery_level=report.get("mastery_level", "未掌握"),
                report_summary=report.get("report_summary", ""),
                strengths=report.get("strengths", []),
                weaknesses=report.get("weaknesses", []),
                improvement_suggestions=report.get("improvement_suggestions", []),
                recommended_resources=report.get("recommended_resources", []),
                knowledge_mastery=report.get("knowledge_mastery", {}),
                ability_analysis=report.get("ability_analysis", {}),
                learning_efficiency=report.get("learning_efficiency", {}),
            )

        except Exception as e:
            logger.error(f"评估报告生成失败: {e}")
            raise

    # ==================== 数据库操作辅助方法 ====================

    async def _save_questions_to_db(
        self, db: AsyncSession, test_id: int, questions: list[dict[str, Any]]
    ) -> None:
        """保存题目到数据库"""
        for idx, q in enumerate(questions):
            question = EvaluationQuestion(
                test_id=test_id,
                question_type=q.get("question_type", 1),
                difficulty_level=q.get("difficulty_level", 1),
                knowledge_point=q.get("knowledge_point", ""),
                question_content=q.get("question_content", ""),
                question_options=q.get("question_options"),
                correct_answer=q.get("correct_answer", ""),
                answer_analysis=q.get("answer_analysis", ""),
                score=10.0,  # 默认每题10分
                order_num=idx + 1,
                quality_score=q.get("quality_score"),
                status=1,
            )
            db.add(question)

        await db.commit()

    async def _get_test_questions(
        self, db: AsyncSession, test_id: int
    ) -> list[dict[str, Any]]:
        """获取测评题目"""
        result = await db.execute(
            select(EvaluationQuestion).where(EvaluationQuestion.test_id == test_id)
        )
        questions = result.scalars().all()

        return [
            {
                "id": str(q.id),
                "question_id": str(q.id),
                "question_type": q.question_type,
                "difficulty_level": q.difficulty_level,
                "knowledge_point": q.knowledge_point,
                "question_content": q.question_content,
                "question_options": q.question_options,
                "correct_answer": q.correct_answer,
                "answer_analysis": q.answer_analysis,
                "score": float(q.score),
            }
            for q in questions
        ]

    async def _save_grading_results_to_db(
        self,
        db: AsyncSession,
        test_id: int,
        user_id: int,
        grading_results: list[dict[str, Any]],
    ) -> None:
        """保存批改结果到数据库"""
        for result in grading_results:
            record = EvaluationAnswerRecord(
                test_id=test_id,
                question_id=result.get("question_id"),
                user_id=user_id,
                user_answer=result.get("user_answer"),
                is_correct=result.get("is_correct"),
                score=result.get("score"),
                grading_type=result.get("grading_type"),
                grading_feedback=result.get("grading_feedback"),
            )
            db.add(record)

        await db.commit()

    async def _get_grading_results(
        self, db: AsyncSession, test_id: int, user_id: int
    ) -> list[dict[str, Any]]:
        """获取批改结果"""
        result = await db.execute(
            select(EvaluationAnswerRecord).where(
                EvaluationAnswerRecord.test_id == test_id,
                EvaluationAnswerRecord.user_id == user_id,
            )
        )
        records = result.scalars().all()

        return [
            {
                "question_id": str(r.question_id),
                "user_answer": r.user_answer,
                "is_correct": r.is_correct,
                "score": float(r.score) if r.score else None,
                "grading_type": r.grading_type,
                "grading_feedback": r.grading_feedback,
            }
            for r in records
        ]

    async def _get_test_record(
        self, db: AsyncSession, test_id: int, user_id: int
    ) -> dict[str, Any]:
        """获取测评记录"""
        result = await db.execute(
            select(EvaluationTestRecord).where(
                EvaluationTestRecord.test_id == test_id,
                EvaluationTestRecord.user_id == user_id,
            )
        )
        record = result.scalar_one_or_none()

        if not record:
            return {}

        return {
            "time_spent": record.time_spent or 0,
            "total_questions": record.total_questions,
            "accuracy_rate": float(record.accuracy_rate) if record.accuracy_rate else 0,
        }

    async def _save_knowledge_mastery_to_db(
        self, db: AsyncSession, user_id: int, assessment_result: dict[str, Any]
    ) -> None:
        """兼容旧调用路径，委托到统一的知识点掌握度持久化实现。"""
        await self._persist_knowledge_mastery_to_db(
            db=db,
            user_id=user_id,
            course_id=int(assessment_result.get("course_id") or 0),
            assessment_result=assessment_result,
        )

    async def _get_test_course_id(
        self, db: AsyncSession, test_id: int
    ) -> int:
        result = await db.execute(
            select(EvaluationTest).where(EvaluationTest.id == test_id)
        )
        test = result.scalar_one_or_none()
        if not test:
            return 0
        return int(test.course_id or 0)

    async def _persist_knowledge_mastery_to_db(
        self,
        db: AsyncSession,
        user_id: int,
        course_id: int,
        assessment_result: dict[str, Any],
    ) -> None:
        knowledge_mastery = assessment_result.get("knowledge_mastery", {})
        knowledge_points = knowledge_mastery.get("knowledge_points", [])

        for kp in knowledge_points:
            knowledge_point = str(kp.get("knowledge_point") or "").strip()
            if not knowledge_point:
                continue

            mastery_course_id = int(kp.get("course_id") or course_id or 0)
            result = await db.execute(
                select(EvaluationKnowledgeMastery).where(
                    EvaluationKnowledgeMastery.user_id == user_id,
                    EvaluationKnowledgeMastery.course_id == mastery_course_id,
                    EvaluationKnowledgeMastery.knowledge_point == knowledge_point,
                )
            )
            entity = result.scalar_one_or_none()

            mastery_score = kp.get("mastery_score")
            if mastery_score is None:
                mastery_score = kp.get("accuracy_rate")
            payload = {
                "mastery_level": int(kp.get("mastery_level") or 0),
                "mastery_score": mastery_score,
                "practice_count": int(kp.get("total_questions") or kp.get("practice_count") or 0),
                "correct_count": int(kp.get("correct_count") or 0),
                "accuracy_rate": kp.get("accuracy_rate"),
                "last_practice_time": datetime.now(),
            }

            if entity is None:
                entity = EvaluationKnowledgeMastery(
                    id=int(datetime.now().timestamp() * 1000000),
                    user_id=user_id,
                    course_id=mastery_course_id,
                    knowledge_point=knowledge_point,
                    **payload,
                )
                db.add(entity)
            else:
                entity.mastery_level = payload["mastery_level"]
                entity.mastery_score = payload["mastery_score"]
                entity.practice_count = payload["practice_count"]
                entity.correct_count = payload["correct_count"]
                entity.accuracy_rate = payload["accuracy_rate"]
                entity.last_practice_time = payload["last_practice_time"]

        await db.commit()

    async def _save_report_to_db(
        self,
        db: AsyncSession,
        user_id: int,
        course_id: int,
        report_type: int,
        report: dict[str, Any],
    ) -> int:
        """保存报告到数据库"""
        report_entity = EvaluationReport(
            user_id=user_id,
            course_id=course_id,
            report_type=report_type,
            overall_score=report.get("overall_score"),
            knowledge_mastery=report.get("knowledge_mastery"),
            ability_analysis=report.get("ability_analysis"),
            learning_efficiency=report.get("learning_efficiency"),
            strengths="\n".join(report.get("strengths", [])),
            weaknesses="\n".join(report.get("weaknesses", [])),
            improvement_suggestions="\n".join(report.get("improvement_suggestions", [])),
            recommended_resources=report.get("recommended_resources"),
            status=1,
        )

        db.add(report_entity)
        await db.commit()
        await db.refresh(report_entity)

        return report_entity.id
