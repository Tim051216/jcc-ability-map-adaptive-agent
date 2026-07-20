import asyncio
import hashlib
import json
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import delete, func, or_, select

from app.db.models import EvaluationQuestion as EvaluationQuestionModel
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
    QuestionGenerateRequest,
    QuestionGenerateResponse,
    WrongQuestionItem,
    WrongQuestionListResponse,
)
from app.services.course_context_service import CourseContextService
from app.services.evaluation_agent_service import EvaluationAgentService


class EvaluationService:
    PAPER_AGENT_TIMEOUT_SECONDS = 60
    QUESTION_BANK_USE_AGENT = True
    QUESTION_BANK_SINGLE_TIMEOUT_SECONDS = 18
    QUESTION_BANK_MAX_CONCURRENCY = 3
    QUESTION_BANK_SINGLE_RETRY_COUNT = 1
    QUESTION_BANK_CACHE_PREFIX = "question_bank_cache:v2:"
    FALLBACK_SINGLE_CHOICE_VARIANTS = [
        {
            "keywords": ["需求分析", "需求工程", "需求获取", "需求建模"],
            "prompt": "在软件工程中，关于需求分析阶段的目标，下列说法哪一项最准确？",
            "options": [
                "A. 直接确定数据库表结构和索引方案",
                "B. 明确用户需求、业务规则以及系统边界",
                "C. 只编写最终测试报告，不关心业务流程",
                "D. 主要完成代码重构和性能调优",
            ],
            "correct_answer": "B",
            "explanation": "需求分析的核心是明确系统目标、用户需求和业务约束，而不是直接进入设计实现。",
        },
        {
            "keywords": ["概要设计", "总体设计", "高层设计", "架构设计"],
            "prompt": "在概要设计阶段，最应该优先完成的工作是哪一项？",
            "options": [
                "A. 确定系统模块划分及模块间接口关系",
                "B. 为每个函数逐行编写源代码",
                "C. 只整理用户培训手册",
                "D. 只修复已经上线的历史缺陷",
            ],
            "correct_answer": "A",
            "explanation": "概要设计的重点是建立系统整体结构、模块边界和接口关系。",
        },
        {
            "keywords": ["详细设计", "低层设计", "模块设计"],
            "prompt": "下列哪一项更属于详细设计阶段的产出？",
            "options": [
                "A. 项目立项申请书",
                "B. 模块内部算法、数据结构与处理流程说明",
                "C. 用户市场推广海报",
                "D. 软件验收后的总结表彰方案",
            ],
            "correct_answer": "B",
            "explanation": "详细设计关注模块内部实现，包括算法、数据结构和处理流程。",
        },
        {
            "keywords": ["软件测试", "测试", "单元测试", "集成测试", "系统测试"],
            "prompt": "关于软件测试的目的，下列说法哪一项更合理？",
            "options": [
                "A. 证明程序绝对没有任何缺陷",
                "B. 通过执行程序发现缺陷并评估软件质量",
                "C. 用测试完全代替需求评审与设计评审",
                "D. 只在项目结束后象征性运行一次程序",
            ],
            "correct_answer": "B",
            "explanation": "测试的目标是发现缺陷并评估质量，而不是证明软件绝对无错。",
        },
        {
            "keywords": ["可行性分析", "可行性研究"],
            "prompt": "可行性分析通常不重点评估下列哪一项？",
            "options": [
                "A. 技术可行性",
                "B. 经济可行性",
                "C. 操作可行性",
                "D. 源代码命名风格是否统一",
            ],
            "correct_answer": "D",
            "explanation": "可行性分析关注技术、经济、操作等宏观层面，不会先讨论具体编码风格。",
        },
        {
            "keywords": ["维护", "软件维护"],
            "prompt": "下列哪一种维护活动属于适应性维护？",
            "options": [
                "A. 修复线上已发现的程序错误",
                "B. 为适配新操作系统版本而修改软件",
                "C. 优化变量命名但不改变任何行为",
                "D. 删除废弃项目的全部历史文档",
            ],
            "correct_answer": "B",
            "explanation": "适应性维护是为适应外部环境变化而做的修改，例如系统平台变化。",
        },
    ]

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
        reusable_questions = await self._load_reusable_question_bank(
            test_id=course_context.course_id,
            knowledge_points=request.knowledge_points or [request.target or request.course_code],
            difficulty_level=self._paper_type_to_difficulty(request.paper_type),
            question_type=1,
            count=request.question_count,
        )
        questions = reusable_questions[: request.question_count]
        if len(questions) < request.question_count:
            missing_request = request.model_copy(update={"question_count": request.question_count - len(questions)})
            questions.extend(await self._build_paper_questions(missing_request))
        questions = [
            item.model_copy(update={"question_id": f"q{index}"})
            for index, item in enumerate(questions[: request.question_count], start=1)
        ]
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
        await self._save_question_pool_entries(
            test_id=course_context.course_id,
            questions=questions,
            generation_prompt=f"paper:{paper_id}:{request.course_code}",
        )
        return EvaluationPaperResponse(
            paper_id=paper_id,
            user_id=request.user_id,
            course_code=request.course_code,
            paper_type=request.paper_type,
            status="generated",
            source="fallback" if any(item.source == "fallback" for item in questions) else "ai",
            questions=questions,
        )

    async def generate_question_bank(self, request: QuestionGenerateRequest) -> QuestionGenerateResponse:
        course_context = (request.course_context or "").strip()
        provided_points = [item.strip() for item in (request.knowledge_points or []) if item and item.strip()]
        course_context_hint = course_context or (provided_points[0] if provided_points else "当前课程")
        count = max(int(request.count or 1), 1)
        resolved_points = provided_points[:] if provided_points else [course_context_hint]
        point_batches = [resolved_points[index % len(resolved_points)] for index in range(count)]
        paper_type = "stage" if request.difficulty_level >= 2 else "diagnostic"
        cache_key = self._build_question_bank_cache_key(
            request=request,
            resolved_points=resolved_points,
            course_context_hint=course_context_hint,
        )
        cached_questions = await self._load_cached_question_bank(cache_key=cache_key, count=count)
        if len(cached_questions) >= count:
            return self._build_question_generate_response(
                test_id=request.test_id,
                questions=cached_questions[:count],
                response_source="cache",
            )
        reusable_questions = await self._load_reusable_question_bank(
            test_id=request.test_id,
            knowledge_points=resolved_points,
            difficulty_level=request.difficulty_level,
            question_type=request.question_type,
            count=count,
        )
        if len(reusable_questions) >= count:
            return self._build_question_generate_response(
                test_id=request.test_id,
                questions=reusable_questions[:count],
                response_source="cache",
            )
        fallback_request = EvaluationPaperGenerateRequest(
            user_id=1,
            course_id=request.test_id or None,
            target=course_context_hint,
            knowledge_points=resolved_points,
            paper_type=paper_type,
            question_count=count,
        )

        generated_questions: list[EvaluationQuestion] = reusable_questions[:]
        missing_count = max(count - len(generated_questions), 0)
        if self.QUESTION_BANK_USE_AGENT:
            async def _build_indexed_question(index: int, point: str) -> EvaluationQuestion | None:
                agent_question = await self._build_single_question_with_retries(
                    point=point,
                    course_id=request.test_id or None,
                    target=course_context_hint,
                    paper_type=paper_type,
                )
                if not agent_question:
                    return None
                return agent_question.model_copy(
                    update={
                        "question_id": f"q{index}",
                        "knowledge_point": point,
                    }
                )

            semaphore = asyncio.Semaphore(self.QUESTION_BANK_MAX_CONCURRENCY)

            async def _run_limited(index: int, point: str) -> EvaluationQuestion | None:
                async with semaphore:
                    return await _build_indexed_question(index, point)

            generated_candidates = await asyncio.gather(
                *(
                    _run_limited(index, point)
                    for index, point in enumerate(point_batches[len(reusable_questions):len(reusable_questions) + missing_count], start=len(reusable_questions) + 1)
                )
            )
            generated_questions.extend([item for item in generated_candidates if item])

        if len(generated_questions) < count:
            fallback_questions = [
                item.model_copy(update={"source": "fallback", "question_id": f"q{len(generated_questions) + idx + 1}"})
                for idx, item in enumerate(self._build_questions(fallback_request))
            ]
            generated_questions.extend(fallback_questions[: count - len(generated_questions)])

        await self._save_cached_question_bank(
            cache_key=cache_key,
            test_id=request.test_id,
            questions=generated_questions,
        )
        return self._build_question_generate_response(
            test_id=request.test_id,
            questions=generated_questions,
        )

    async def _build_single_question_with_retries(
        self,
        *,
        point: str,
        course_id: int | None,
        target: str,
        paper_type: str,
    ) -> EvaluationQuestion | None:
        last_question: EvaluationQuestion | None = None
        for _ in range(self.QUESTION_BANK_SINGLE_RETRY_COUNT):
            try:
                agent_questions = await asyncio.wait_for(
                    self._build_questions_with_agent(
                        EvaluationPaperGenerateRequest(
                            user_id=1,
                            course_id=course_id,
                            target=target,
                            knowledge_points=[point],
                            paper_type=paper_type,
                            question_count=1,
                        )
                    ),
                    timeout=self.QUESTION_BANK_SINGLE_TIMEOUT_SECONDS,
                )
            except asyncio.TimeoutError:
                continue
            if not agent_questions:
                continue
            last_question = agent_questions[0]
            if last_question.source == "ai":
                return last_question
        return last_question

    def _build_question_generate_response(
        self,
        *,
        test_id: int,
        questions: list[EvaluationQuestion],
        response_source: str | None = None,
    ) -> QuestionGenerateResponse:
        fallback_points = [item.knowledge_point for item in questions if item.source == "fallback"]
        source = response_source or ("fallback" if fallback_points else "ai")
        return QuestionGenerateResponse(
            test_id=test_id,
            questions=[
                {
                    "question_content": item.prompt,
                    "question_options": [
                        {"key": option.split(".", 1)[0].strip(), "value": option.split(".", 1)[1].strip() if "." in option else option}
                        for option in item.options
                    ],
                    "correct_answer": item.correct_answer,
                    "answer_analysis": item.explanation,
                    "knowledge_point": item.knowledge_point,
                    "difficulty_level": 2 if item.difficulty == "advanced" else 1,
                    "question_type": 1 if item.question_type == "single_choice" else 2,
                    "quality_score": 1.0 if item.source == "ai" else 0.6,
                }
                for item in questions
            ],
            layered_questions=None,
            total_count=len(questions),
            fallback_count=len(fallback_points),
            fallback_knowledge_points=fallback_points,
            safety_review=None,
            hallucination_review=None,
            source=source,
        )

    def _build_question_bank_cache_key(
        self,
        *,
        request: QuestionGenerateRequest,
        resolved_points: list[str],
        course_context_hint: str,
    ) -> str:
        payload = {
            "test_id": request.test_id,
            "difficulty_level": request.difficulty_level,
            "question_type": request.question_type,
            "generate_layered": request.generate_layered,
            "knowledge_points": resolved_points,
            "course_context_hint": course_context_hint,
            "course_context": (request.course_context or "").strip()[:1800],
        }
        digest = hashlib.sha1(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
        return f"{self.QUESTION_BANK_CACHE_PREFIX}{digest}"

    async def _load_cached_question_bank(self, *, cache_key: str, count: int) -> list[EvaluationQuestion]:
        async with async_session_factory() as session:
            result = await session.execute(
                select(EvaluationQuestionModel)
                .where(
                    EvaluationQuestionModel.generation_prompt == cache_key,
                    EvaluationQuestionModel.status == 1,
                )
                .order_by(EvaluationQuestionModel.order_num.asc(), EvaluationQuestionModel.id.asc())
                .limit(count)
            )
            rows = result.scalars().all()
        questions = [self._db_question_to_schema(item) for item in rows]
        if self.QUESTION_BANK_USE_AGENT and questions and all(item.source == "fallback" for item in questions):
            return []
        return questions

    async def _load_reusable_question_bank(
        self,
        *,
        test_id: int,
        knowledge_points: list[str],
        difficulty_level: int,
        question_type: int,
        count: int,
    ) -> list[EvaluationQuestion]:
        normalized_points = [item.strip() for item in knowledge_points if item and item.strip()]
        point_filters = []
        for point in normalized_points:
            point_filters.append(EvaluationQuestionModel.knowledge_point == point[:255])
            if len(point) >= 4:
                point_filters.append(EvaluationQuestionModel.knowledge_point.like(f"%{point[:24]}%"))

        async with async_session_factory() as session:
            stmt = (
                select(EvaluationQuestionModel)
                .where(
                    EvaluationQuestionModel.test_id == test_id,
                    EvaluationQuestionModel.status == 1,
                    EvaluationQuestionModel.question_type == question_type,
                    EvaluationQuestionModel.difficulty_level <= max(difficulty_level, 1),
                )
                .order_by(
                    func.coalesce(EvaluationQuestionModel.quality_score, 0).desc(),
                    EvaluationQuestionModel.id.desc(),
                )
                .limit(max(count * 3, count))
            )
            if point_filters:
                stmt = stmt.where(or_(*point_filters))
            result = await session.execute(stmt)
            rows = result.scalars().all()

        questions: list[EvaluationQuestion] = []
        seen_prompts: set[str] = set()
        for row in rows:
            prompt_key = (row.question_content or "").strip()
            if not prompt_key or prompt_key in seen_prompts:
                continue
            seen_prompts.add(prompt_key)
            questions.append(self._db_question_to_schema(row))
            if len(questions) >= count:
                break
        if self.QUESTION_BANK_USE_AGENT and questions and all(item.source == "fallback" for item in questions):
            return []
        return questions

    async def _save_cached_question_bank(
        self,
        *,
        cache_key: str,
        test_id: int,
        questions: list[EvaluationQuestion],
    ) -> None:
        await self._save_question_pool_entries(
            test_id=test_id,
            questions=questions,
            generation_prompt=cache_key,
            delete_generation_prompt=cache_key,
        )

    async def _save_question_pool_entries(
        self,
        *,
        test_id: int,
        questions: list[EvaluationQuestion],
        generation_prompt: str,
        delete_generation_prompt: str | None = None,
    ) -> None:
        async with async_session_factory() as session:
            if delete_generation_prompt:
                await session.execute(
                    delete(EvaluationQuestionModel).where(
                        EvaluationQuestionModel.generation_prompt == delete_generation_prompt
                    )
                )
            existing_result = await session.execute(
                select(EvaluationQuestionModel.question_content).where(
                    EvaluationQuestionModel.test_id == test_id,
                    EvaluationQuestionModel.status == 1,
                )
            )
            existing_prompts = {
                str(item).strip()
                for item in existing_result.scalars().all()
                if str(item).strip()
            }
            next_id = await self._get_next_cached_question_id(session)
            for index, item in enumerate(questions, start=1):
                prompt_key = item.prompt.strip()
                if prompt_key in existing_prompts:
                    continue
                existing_prompts.add(prompt_key)
                session.add(
                    EvaluationQuestionModel(
                        id=next_id,
                        test_id=test_id,
                        question_type=1 if item.question_type == "single_choice" else 2,
                        difficulty_level=2 if item.difficulty == "advanced" else 1,
                        knowledge_point=item.knowledge_point,
                        question_content=item.prompt,
                        question_options=self._schema_options_to_db_options(item.options),
                        correct_answer=item.correct_answer,
                        answer_analysis=item.explanation,
                        score=10.0,
                        order_num=index,
                        generation_prompt=generation_prompt,
                        generation_model=f"cached_{item.source}",
                        quality_score=1.0 if item.source == "ai" else 0.6,
                        status=1,
                    )
                )
                next_id += 1
            await session.commit()

    async def _get_next_cached_question_id(self, session) -> int:
        result = await session.execute(select(func.coalesce(func.max(EvaluationQuestionModel.id), 0)))
        current_max = result.scalar_one()
        return int(current_max or 0) + 1

    @staticmethod
    def _schema_options_to_db_options(options: list[str]) -> list[dict[str, str]]:
        normalized: list[dict[str, str]] = []
        for index, option in enumerate(options):
            if "." in option:
                key, value = option.split(".", 1)
                normalized.append({"key": key.strip(), "value": value.strip()})
            else:
                normalized.append({"key": chr(ord("A") + index), "value": option.strip()})
        return normalized

    def _db_question_to_schema(self, item: EvaluationQuestionModel) -> EvaluationQuestion:
        db_options = item.question_options or []
        options = []
        for index, option in enumerate(db_options):
            if isinstance(option, dict):
                key = str(option.get("key") or chr(ord("A") + index)).strip()
                value = str(option.get("value") or "").strip()
                options.append(f"{key}. {value}" if value else key)
            else:
                options.append(str(option))
        return EvaluationQuestion(
            question_id=f"q{item.order_num or item.id}",
            question_type="single_choice" if item.question_type == 1 else "multiple_choice",
            prompt=item.question_content,
            options=options,
            correct_answer=item.correct_answer,
            explanation=item.answer_analysis or "",
            knowledge_point=item.knowledge_point,
            difficulty="advanced" if item.difficulty_level >= 2 else "basic",
            source="fallback" if (item.generation_model or "").endswith("fallback") else "ai",
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
                source="fallback"
                if any((item.get("source") == "fallback") for item in (paper.questions_data or []))
                else "ai",
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
                await paper_repo._realign_answer_sequence(session)
                response = self._build_submission_response(
                    paper_id=paper.id,
                    course_code=paper.course_code,
                    questions=[EvaluationQuestion.model_validate(item) for item in paper.questions_data or []],
                    request=request,
                )
                next_answer_id = await paper_repo.get_next_answer_id(session)
                for answer in request.answers:
                    question = next((item for item in response["questions"] if item.question_id == answer.question_id), None)
                    if question is None:
                        continue
                    await paper_repo.create_answer(
                        session,
                        answer_id=next_answer_id,
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
                    next_answer_id += 1

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
        answer_knowledge_points = [
            str(item.get("knowledge_point") or "").strip()
            for item in request.answers
            if str(item.get("knowledge_point") or "").strip()
        ]
        unique_knowledge_points = list(dict.fromkeys(answer_knowledge_points))
        incorrect_knowledge_points = list(
            dict.fromkeys(
                str(item.get("knowledge_point") or "").strip()
                for item in request.answers
                if not item.get("is_correct") and str(item.get("knowledge_point") or "").strip()
            )
        )
        profile_weak_points = [
            str(item).strip()
            for item in dimensions.get("weak_point_preference", {}).get("evidence", [])
            if str(item).strip()
        ]
        weak_points = incorrect_knowledge_points or unique_knowledge_points or profile_weak_points or [request.course_code]
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
            knowledge_points=(unique_knowledge_points or weak_points)[:3],
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
        try:
            generated = await asyncio.wait_for(
                self._build_questions_with_agent(request),
                timeout=self.PAPER_AGENT_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            generated = []
        if generated:
            return generated[: request.question_count]
        fallback_questions = self._build_questions(request)
        return [
            item.model_copy(update={"source": "fallback"})
            for item in fallback_questions
        ]

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
            course_context = "\n".join(
                [
                    f"课程代码: {request.course_code}",
                    f"测评目标: {request.target or request.course_code}",
                    "请严格围绕课程知识点出题，题目要符合常见刷题/面试软件的单题模式，优先单选题，少量多选题，避免空泛和模板化表述。",
                    "每道题都要有明确题干、4 个选项、唯一或明确正确答案、简短解析。",
                    f"重点知识点: {', '.join(knowledge_points)}",
                ]
            )
            result = await EvaluationAgentService().generate_questions(
                QuestionGenerateRequest(
                    test_id=0,
                    knowledge_points=knowledge_points,
                    difficulty_level=self._paper_type_to_difficulty(request.paper_type),
                    question_type=1,
                    count=request.question_count,
                    generate_layered=False,
                    course_context=course_context,
                    persist_to_db=False,
                )
            )
        except Exception:
            return []

        questions: list[EvaluationQuestion] = []
        is_fallback_result = bool(getattr(result, "fallback_count", 0))
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
                    source="fallback" if is_fallback_result else "ai",
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
            variant = next(
                (
                    item
                    for item in self.FALLBACK_SINGLE_CHOICE_VARIANTS
                    if any(keyword in point for keyword in item.get("keywords", []))
                ),
                self.FALLBACK_SINGLE_CHOICE_VARIANTS[index % len(self.FALLBACK_SINGLE_CHOICE_VARIANTS)],
            )
            questions.append(
                EvaluationQuestion(
                    question_id=f"q{question_no}",
                    question_type="single_choice",
                    prompt=variant["prompt"],
                    options=variant["options"],
                    correct_answer=variant["correct_answer"],
                    explanation=variant["explanation"],
                    knowledge_point=point,
                    difficulty="basic" if index < 2 else "advanced",
                    source="fallback",
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
