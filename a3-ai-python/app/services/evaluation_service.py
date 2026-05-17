from datetime import datetime, timezone

from fastapi import HTTPException

from app.db.repositories.evaluation_paper_repository import EvaluationPaperRepository
from app.db.repositories.evaluation_repository import EvaluationRepository
from app.db.session import async_session_factory
from app.schemas.evaluation import (
    EvaluationAnswerItem,
    EvaluationLayerResult,
    EvaluationMetric,
    EvaluationPaperGenerateRequest,
    EvaluationPaperResponse,
    EvaluationQuestion,
    QuestionGenerateRequest,
    EvaluationPaperSubmitRequest,
    EvaluationRequest,
    EvaluationResponse,
    WrongQuestionItem,
    WrongQuestionListResponse,
)
from app.services.course_context_service import CourseContextService
from app.services.evaluation_agent_service import EvaluationAgentService


class EvaluationService:
    async def generate_paper(self, request: EvaluationPaperGenerateRequest) -> EvaluationPaperResponse:
        course_context = await CourseContextService().resolve(
            course_id=request.course_id,
            course_code=request.course_code,
        )
        request = request.model_copy(
            update={
                "course_id": course_context.course_id,
                "course_code": course_context.course_code,
            }
        )
        questions = await self._build_paper_questions(request)
        now = datetime.now(timezone.utc).isoformat()
        async with async_session_factory() as session:
            paper = await EvaluationPaperRepository().create_paper(
                session,
                user_id=request.user_id,
                course_code=request.course_code,
                paper_type=request.paper_type,
                status="generated",
                questions_data=[item.model_dump(mode="json") for item in questions],
                created_at=now,
                updated_at=now,
            )
            await session.commit()
        paper_id = paper.id
        return EvaluationPaperResponse(
            paper_id=paper_id,
            user_id=request.user_id,
            course_code=request.course_code,
            paper_type=request.paper_type,
            status="generated",
            questions=questions,
        )

    async def get_paper(self, paper_id: int) -> EvaluationPaperResponse | None:
        async with async_session_factory() as session:
            paper = await EvaluationPaperRepository().get_paper(session, paper_id)
            if paper is None:
                return None
            return EvaluationPaperResponse(
                paper_id=paper.id,
                user_id=paper.user_id,
                course_code=paper.course_code,
                paper_type=paper.paper_type,
                status=paper.status,
                questions=[EvaluationQuestion.model_validate(item) for item in paper.questions_data or []],
            )

    async def submit_paper(
        self,
        *,
        paper_id: int,
        request: EvaluationPaperSubmitRequest,
    ) -> EvaluationResponse:
        now = datetime.now(timezone.utc).isoformat()
        try:
            async with async_session_factory() as session:
                paper_repo = EvaluationPaperRepository()
                paper = await paper_repo.get_paper(session, paper_id)
                if paper is None or paper.user_id != request.user_id:
                    raise HTTPException(status_code=404, detail="evaluation paper not found")
                response = self._build_submission_response(
                    paper_id=paper.id,
                    course_code=paper.course_code,
                    questions=[EvaluationQuestion.model_validate(item) for item in paper.questions_data or []],
                    request=request,
                )
                for answer in request.answers:
                    question = next((item for item in response["questions"] if item.question_id == answer.question_id), None)
                    if question is None:
                        continue
                    await paper_repo.create_answer(
                        session,
                        paper_id=paper.id,
                        user_id=request.user_id,
                        question_id=question.question_id,
                        question_type=question.question_type,
                        prompt=question.prompt,
                        knowledge_point=question.knowledge_point,
                        user_answer=answer.answer,
                        correct_answer=question.correct_answer,
                        is_correct=self._is_correct_answer(question.correct_answer, answer.answer),
                        explanation=question.explanation,
                        created_at=now,
                        updated_at=now,
                    )

                paper.status = "submitted"
                paper.updated_at = now
                record = await EvaluationRepository().create_record(
                    session,
                    user_id=request.user_id,
                    course_code=paper.course_code,
                    evaluation_type=response["result"].evaluation_type,
                    result_data=response["result"].model_dump(mode="json"),
                    created_at=now,
                    updated_at=now,
                )
                await session.commit()
            return response["result"].model_copy(update={"record_id": record.id})
        except HTTPException:
            raise

    async def get_result(self, record_id: int) -> EvaluationResponse | None:
        async with async_session_factory() as session:
            record = await EvaluationRepository().get_by_id(session, record_id)
            if record is None or not record.result_data:
                return None
            return EvaluationResponse.model_validate({**record.result_data, "record_id": record.id})

    async def get_latest_evaluation(self, user_id: int, course_code: str) -> EvaluationResponse | None:
        async with async_session_factory() as session:
            latest = await EvaluationRepository().latest_by_user_course(session, user_id, course_code)
            if latest is None or not latest.result_data:
                return None
            return EvaluationResponse.model_validate({**latest.result_data, "record_id": latest.id})

    async def evaluate(self, request: EvaluationRequest) -> EvaluationResponse:
        course_context = await CourseContextService().resolve(
            course_id=request.course_id,
            course_code=request.course_code,
        )
        request = request.model_copy(
            update={
                "course_id": course_context.course_id,
                "course_code": course_context.course_code,
            }
        )
        response = self._build_evaluation_response(request)
        await self._persist_record(request, response)
        return response

    async def get_wrong_questions(self, record_id: int) -> WrongQuestionListResponse:
        async with async_session_factory() as session:
            record = await EvaluationRepository().get_by_id(session, record_id)
            if record is None or not record.result_data:
                raise HTTPException(status_code=404, detail="evaluation result not found")
            result = EvaluationResponse.model_validate({**record.result_data, "record_id": record.id})
            if result.paper_id is None:
                return WrongQuestionListResponse(items=[], total=0)
            wrong_answers = await EvaluationPaperRepository().list_wrong_answers_by_paper(
                session,
                paper_id=result.paper_id,
                user_id=record.user_id,
            )

        items = [
            WrongQuestionItem(
                question_id=item.question_id,
                prompt=item.prompt,
                knowledge_point=item.knowledge_point,
                user_answer=item.user_answer,
                correct_answer=item.correct_answer,
                explanation=item.explanation,
            )
            for item in wrong_answers
        ]
        return WrongQuestionListResponse(items=items, total=len(items))

    def _build_evaluation_response(
        self,
        request: EvaluationRequest,
        *,
        paper_id: int | None = None,
    ) -> EvaluationResponse:
        profile = request.profile or {}
        plan = request.plan or {}
        resources = request.resources or []
        dimensions = profile.get("dimensions", {})
        weak_points = dimensions.get("weak_point_preference", {}).get("evidence", []) or [request.course_code]
        plan_steps = plan.get("steps", [])

        answer_count = len(request.answers)
        correct_count = sum(1 for item in request.answers if item.get("is_correct"))
        accuracy = correct_count / answer_count if answer_count else 0.0
        learning_duration = request.learning_duration_minutes or max(len(plan_steps) * 35, 45)
        resource_usage_count = request.resource_usage_count if request.resource_usage_count is not None else len(resources)

        overall_score = 55.0
        overall_score += min(correct_count * 8.0, 32.0)
        overall_score += min(accuracy * 20.0, 20.0)
        overall_score += min(len(plan_steps) * 1.2, 10.0)
        overall_score += min(resource_usage_count * 1.5, 6.0)
        overall_score = min(round(overall_score, 1), 95.0)

        mastery_level = self._resolve_mastery_level(overall_score)
        layered_results = self._build_layered_results(overall_score)
        metrics = self._build_metrics(overall_score, learning_duration, resource_usage_count, weak_points)

        return EvaluationResponse(
            paper_id=paper_id,
            overall_score=overall_score,
            evaluation_type="paper_submission",
            mastery_level=mastery_level,
            report_summary=f"已完成 {request.course_code} 的阶段测评，可用于回流画像与路径优化。",
            strengths=[
                "已具备围绕目标知识点组织学习任务的能力。",
                "能够结合计划节点与资源推送形成较完整的学习闭环。",
            ],
            weak_points=[
                f"当前仍需重点攻克“{weak_points[0]}”相关错误模式。",
                "综合应用与迁移输出能力仍需通过阶段测评持续验证。",
            ],
            suggestions=[
                "建议在每个路径节点结束后补充一次 5 分钟自评，便于后续动态调优。",
                "建议把错题按概念不清、步骤遗漏、迁移困难三类归档，作为后续画像更新依据。",
                "建议将薄弱知识点与资源收藏夹联动，形成可回溯强化清单。",
            ],
            layered_results=layered_results,
            metrics=metrics,
            knowledge_points=weak_points[:3],
            recommended_actions=[
                "追加一轮薄弱点专项练习。",
                "保留当前阶段任务节奏，并在综合巩固阶段增加输出型任务。",
                "将本次评估结果同步到画像与路径规划模块。",
            ],
            path_feedback={
                "user_id": request.user_id,
                "should_adjust_path": overall_score < 80,
                "next_focus": weak_points[0],
                "recommended_changes": [
                    "提升薄弱点节点权重",
                    "若后续正确率提升，则恢复综合训练节点比例",
                ],
            },
            profile_feedback={
                "should_update_profile": True,
                "affected_dimensions": ["learning_progress", "weak_point_preference", "learning_habit"],
                "summary": "建议依据本次评估结果更新学习进度、薄弱点偏好与学习习惯维度。",
            },
        )

    async def _persist_record(self, request: EvaluationRequest, response: EvaluationResponse) -> None:
        now = datetime.now(timezone.utc).isoformat()
        async with async_session_factory() as session:
            await EvaluationRepository().create_record(
                session,
                user_id=request.user_id,
                course_code=request.course_code,
                evaluation_type=response.evaluation_type,
                result_data=response.model_dump(mode="json"),
                created_at=now,
                updated_at=now,
            )
            await session.commit()

    def _build_submission_response(
        self,
        *,
        paper_id: int,
        course_code: str,
        questions: list[EvaluationQuestion],
        request: EvaluationPaperSubmitRequest,
    ) -> dict[str, object]:
        question_map = {item.question_id: item for item in questions}
        normalized_answers: list[dict] = []
        for answer in request.answers:
            question = question_map.get(answer.question_id)
            if question is None:
                continue
            normalized_answers.append(
                {
                    "question_id": question.question_id,
                    "knowledge_point": question.knowledge_point,
                    "is_correct": self._is_correct_answer(question.correct_answer, answer.answer),
                    "user_answer": answer.answer,
                    "correct_answer": question.correct_answer,
                }
            )
        evaluation_request = EvaluationRequest(
            user_id=request.user_id,
            course_code=course_code,
            answers=normalized_answers,
            scene=request.scene,
            profile=request.profile,
            plan=request.plan,
            resources=request.resources,
            learning_duration_minutes=request.learning_duration_minutes,
            resource_usage_count=request.resource_usage_count,
        )
        return {
            "questions": questions,
            "result": self._build_evaluation_response(evaluation_request, paper_id=paper_id),
        }

    async def _build_paper_questions(
        self,
        request: EvaluationPaperGenerateRequest,
    ) -> list[EvaluationQuestion]:
        generated = await self._build_questions_with_agent(request)
        if generated:
            return generated[: request.question_count]
        return self._build_questions(request)

    async def _build_questions_with_agent(
        self,
        request: EvaluationPaperGenerateRequest,
    ) -> list[EvaluationQuestion]:
        knowledge_points = request.knowledge_points or [
            request.target or request.course_code,
            f"{request.course_code} 核心概念",
            f"{request.course_code} 典型错因",
        ]
        try:
            result = await EvaluationAgentService().generate_questions(
                QuestionGenerateRequest(
                    test_id=0,
                    knowledge_points=knowledge_points,
                    difficulty_level=self._paper_type_to_difficulty(request.paper_type),
                    question_type=1,
                    count=request.question_count,
                    generate_layered=False,
                    course_context=request.course_code,
                    persist_to_db=False,
                )
            )
        except Exception:
            return []

        questions: list[EvaluationQuestion] = []
        for index, item in enumerate(result.questions, start=1):
            options = item.question_options or []
            normalized_options = [
                self._normalize_question_option(option, option_index)
                for option_index, option in enumerate(options)
            ]
            questions.append(
                EvaluationQuestion(
                    question_id=f"q{index}",
                    question_type=self._map_question_type_value(item.question_type),
                    prompt=item.question_content,
                    options=normalized_options,
                    correct_answer=item.correct_answer,
                    explanation=item.answer_analysis,
                    knowledge_point=item.knowledge_point or knowledge_points[(index - 1) % len(knowledge_points)],
                    difficulty=self._map_difficulty_value(item.difficulty_level),
                )
            )
        return questions

    def _build_questions(self, request: EvaluationPaperGenerateRequest) -> list[EvaluationQuestion]:
        points = request.knowledge_points[: request.question_count] or [
            request.target or request.course_code,
            f"{request.course_code} 核心概念",
            f"{request.course_code} 典型错因",
        ]
        questions: list[EvaluationQuestion] = []
        for index in range(request.question_count):
            point = points[index % len(points)]
            question_no = index + 1
            questions.append(
                EvaluationQuestion(
                    question_id=f"q{question_no}",
                    question_type="single_choice",
                    prompt=f"关于“{point}”的下列表述中，哪一项最符合课程要求？",
                    options=[
                        f"A. 仅关注记忆定义，不需要理解应用场景",
                        f"B. 将概念、常见误区和应用场景一起理解",
                        f"C. 只做练习题，不需要回顾知识结构",
                        f"D. 完全依赖资源生成，不做主动总结",
                    ],
                    correct_answer="B",
                    explanation="题目重点考查对知识点理解方式的把握，正确做法应兼顾概念、误区和应用场景。",
                    knowledge_point=point,
                    difficulty="basic" if index < 2 else "advanced",
                )
            )
        return questions

    @staticmethod
    def _is_correct_answer(correct_answer: str, user_answer: str) -> bool:
        return correct_answer.strip().upper() == user_answer.strip().upper()

    @staticmethod
    def _resolve_mastery_level(score: float) -> str:
        if score >= 88:
            return "proficient"
        if score >= 78:
            return "stable"
        return "developing"

    @staticmethod
    def _build_layered_results(score: float) -> list[EvaluationLayerResult]:
        base_score = min(score + 4, 96)
        advanced_score = max(min(score - 2, 92), 60)
        challenge_score = max(min(score - 6, 88), 55)
        return [
            EvaluationLayerResult(
                level="基础层",
                score=round(base_score, 1),
                status="good" if base_score >= 80 else "watch",
                comment="基础概念理解与常规题型处理能力整体可用。",
            ),
            EvaluationLayerResult(
                level="进阶层",
                score=round(advanced_score, 1),
                status="good" if advanced_score >= 78 else "watch",
                comment="进阶分析能力受薄弱点稳定性影响，仍需专项巩固。",
            ),
            EvaluationLayerResult(
                level="挑战层",
                score=round(challenge_score, 1),
                status="good" if challenge_score >= 75 else "watch",
                comment="综合迁移与开放场景输出能力需要更多高阶训练支撑。",
            ),
        ]

    @staticmethod
    def _paper_type_to_difficulty(paper_type: str) -> int:
        mapping = {
            "diagnostic": 1,
            "stage": 2,
            "summative": 3,
            "final": 3,
        }
        return mapping.get(paper_type, 1)

    @staticmethod
    def _normalize_question_option(option: dict | str, option_index: int) -> str:
        label = chr(ord("A") + option_index)
        if isinstance(option, dict):
            raw_label = str(option.get("key") or option.get("label") or label).strip() or label
            content = str(option.get("value") or option.get("content") or option.get("text") or "").strip()
            return f"{raw_label}. {content}".strip()
        return f"{label}. {str(option).strip()}".strip()

    @staticmethod
    def _map_question_type_value(question_type: int) -> str:
        return {
            1: "single_choice",
            2: "multiple_choice",
            3: "true_false",
            4: "fill_blank",
            5: "short_answer",
            6: "programming",
        }.get(int(question_type or 1), "single_choice")

    @staticmethod
    def _map_difficulty_value(difficulty_level: int) -> str:
        return {
            1: "basic",
            2: "advanced",
            3: "challenge",
        }.get(int(difficulty_level or 1), "basic")

    @staticmethod
    def _build_metrics(
        score: float,
        learning_duration: int,
        resource_usage_count: int,
        weak_points: list[str],
    ) -> list[EvaluationMetric]:
        return [
            EvaluationMetric(
                metric_name="知识掌握度",
                score=min(round(score + 2, 1), 96.0),
                comment="结合测评结果与学习阶段判断当前知识点掌握情况。",
            ),
            EvaluationMetric(
                metric_name="学习投入度",
                score=min(round(60 + learning_duration / 2.5, 1), 95.0),
                comment=f"依据预估学习投入时长 {learning_duration} 分钟进行量化。",
            ),
            EvaluationMetric(
                metric_name="资源使用效率",
                score=min(round(68 + resource_usage_count * 6, 1), 94.0),
                comment="根据资源调用数量与学习链路完整度评估资源利用效率。",
            ),
            EvaluationMetric(
                metric_name="薄弱点修复度",
                score=max(round(score - 5, 1), 58.0),
                comment=f"当前重点关注“{weak_points[0]}”的掌握改善情况。",
            ),
        ]
