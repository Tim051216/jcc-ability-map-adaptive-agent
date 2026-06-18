from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from itertools import count

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.agents.review_reminder_workflow import build_review_reminder_workflow
from app.db.models.learning_interaction import LearningNote, LearningQuestion, LearningReply
from app.db.models.user_profile import UserProfileSnapshot
from app.db.repositories.personalized_learning_state_repository import PersonalizedLearningStateRepository
from app.db.session import async_session_factory
from app.schemas.learning import (
    GoalPathResponse,
    GrowthMapResponse,
    LearningExamGenerateRequest,
    LearningExamSubmitRequest,
    LearningLikeRequest,
    LearningNoteCreateRequest,
    LearningNoteUpdateRequest,
    LearningPageResponse,
    LearningQuestionCreateRequest,
    LearningQuestionUpdateRequest,
    LearningReplyCreateRequest,
    LearningSessionEventRequest,
    LearningSessionEventResponse,
    LevelRecommendationResponse,
    PersonalizedNextStepResponse,
    ReviewPlanResponse,
)
from app.services.evaluation_history_service import EvaluationHistoryService
from app.services.review_reminder_delivery_service import ReviewReminderDeliveryService
from app.services.resource_favorite_summary_service import ResourceFavoriteSummaryService


class LearningService:
    _exam_id_seq = count(9001)
    _exams: dict[int, dict] = {}
    _learning_session_state: dict[tuple[int, int], dict] = {}
    _personalized_course_data: dict[int, dict] = {
        201: {
            "current_video": "Vue 3 工程化与前端架构实战",
            "target_goal": "7 天完成 Vue 3 工程化能力强化",
            "estimated_minutes": 40,
            "reason": "你当前已经具备基础页面开发能力，下一步更适合把组件组织、状态管理、接口联调和性能优化串成完整工程能力。",
            "recommended_resources": ["课程讲义", "项目案例", "随堂练习"],
            "goal_title": "7 天 Vue 3 工程化进阶路径",
            "goal_subtitle": "不是泛泛推荐，而是围绕你当前画像、课程进度和薄弱点生成的具体学习安排。",
            "suitable_for": "适合已经完成 Vue 基础语法学习，准备进入组件协作、项目结构与工程优化阶段的学习者。",
            "goal_items": [
                {
                    "day": 1,
                    "title": "梳理项目骨架",
                    "focus": "目录结构与模块边界",
                    "task": "对照当前课程，把页面、组件、状态、接口和工具函数的职责分层梳理清楚。",
                    "deliverable": "一张项目结构草图",
                },
                {
                    "day": 2,
                    "title": "重做组件拆分",
                    "focus": "组件复用与职责划分",
                    "task": "挑一个真实页面，拆分出容器组件、展示组件和通用业务组件。",
                    "deliverable": "组件拆分说明与目录调整记录",
                },
                {
                    "day": 3,
                    "title": "补强状态流",
                    "focus": "Pinia 状态设计",
                    "task": "围绕一个核心业务流程，整理状态来源、更新动作、持久化方式和错误处理。",
                    "deliverable": "状态流转图",
                },
                {
                    "day": 4,
                    "title": "跑通接口联调",
                    "focus": "请求封装与容错处理",
                    "task": "完成一次接口请求、加载态、失败重试和空态兜底的完整联调。",
                    "deliverable": "一段可复用的接口封装方案",
                },
                {
                    "day": 5,
                    "title": "处理页面性能",
                    "focus": "列表渲染与异步加载优化",
                    "task": "定位一个页面的性能瓶颈，优化加载时机、渲染频率或资源体积。",
                    "deliverable": "性能对比记录",
                },
                {
                    "day": 6,
                    "title": "整理可复用方案",
                    "focus": "工程规范沉淀",
                    "task": "把本周学到的目录规范、组件模式、状态方案和接口约定整理成团队可复用笔记。",
                    "deliverable": "工程化实践清单",
                },
                {
                    "day": 7,
                    "title": "做一次阶段复盘",
                    "focus": "前端工程化迁移应用",
                    "task": "总结这 7 天的核心收获、仍然薄弱的点，以及下一轮应该继续强化的主题。",
                    "deliverable": "阶段复盘总结",
                },
            ],
            "review_cards": [
                {
                    "id": "vue-card-1",
                    "prompt": "什么时候应该把状态提升到 Pinia，而不是继续放在组件内部？",
                    "answer": "当多个页面或多个组件需要共享、复用或持久化同一份状态时，就应该把状态提升到全局 store 管理。",
                    "review_stage": "首次回顾",
                    "next_review_in_hours": 12,
                    "source_video": "Vue 3 工程化与前端架构实战",
                },
                {
                    "id": "vue-card-2",
                    "prompt": "组件拆分时最先看什么？",
                    "answer": "先看职责边界，再看复用机会，最后才看视觉区域，避免只按页面块状结构机械拆分。",
                    "review_stage": "巩固回顾",
                    "next_review_in_hours": 24,
                    "source_video": "组件复用与职责边界",
                },
                {
                    "id": "vue-card-3",
                    "prompt": "接口封装除了发请求，还应该统一哪些内容？",
                    "answer": "还应统一错误处理、鉴权头、重试策略、空态兜底和业务状态码转换。",
                    "review_stage": "迁移回顾",
                    "next_review_in_hours": 48,
                    "source_video": "接口联调与容错设计",
                },
            ],
            "levels": [
                {
                    "level": "beginner",
                    "label": "小白版",
                    "fit_score": 64,
                    "description": "先建立 Vue 工程化全景认知，重点看目录结构、组件通信和基础状态管理。",
                    "recommended_topics": ["项目目录怎么分", "父子组件通信", "Pinia 入门"],
                },
                {
                    "level": "intermediate",
                    "label": "进阶版",
                    "fit_score": 92,
                    "description": "你当前更适合进入真实项目阶段，重点做组件拆分、状态设计、接口联调和页面优化。",
                    "recommended_topics": ["组件职责划分", "业务状态流设计", "接口封装与异常处理", "渲染性能优化"],
                },
                {
                    "level": "expert",
                    "label": "专家版",
                    "fit_score": 76,
                    "description": "可以继续往团队协作和工程规范沉淀推进，例如可复用方案、发布策略和监控排障。",
                    "recommended_topics": ["工程规范沉淀", "构建与发布策略", "线上问题排查"],
                },
            ],
            "growth_title": "前端工程能力成长地图",
            "growth_summary": "这张成长地图展示的不只是你看过什么，而是你已经形成了哪些可迁移的工程能力，例如拆分能力、协作能力和落地能力。",
            "next_milestone": "再完成一次真实页面的组件重构和接口联调闭环，就可以进入更稳定的独立交付阶段。",
            "dimensions": [
                {"key": "planning", "label": "结构规划", "score": 81, "trend": "up", "evidence": "已经开始按模块而不是按页面碎片思考项目结构。"},
                {"key": "execution", "label": "工程执行", "score": 86, "trend": "up", "evidence": "能把课程内容落实到组件、状态和接口实现。"},
                {"key": "review", "label": "复盘沉淀", "score": 73, "trend": "steady", "evidence": "已经有回顾动作，但方法论沉淀还不够系统。"},
                {"key": "transfer", "label": "迁移应用", "score": 78, "trend": "up", "evidence": "开始把课程里的工程模式迁移到真实页面与真实业务。"},
            ],
        },
        401: {
            "current_video": "软件工程与实践（第4版）",
            "target_goal": "7 天完成软件工程核心能力强化",
            "estimated_minutes": 35,
            "reason": "你当前已经进入课程主线推进阶段，更适合把需求分析、系统设计、实现测试和项目推进串成一条完整的软件工程学习闭环。",
            "recommended_resources": ["教材讲义", "案例讲解", "阶段练习"],
            "goal_title": "7 天软件工程进阶路径",
            "goal_subtitle": "不是泛泛推荐，而是围绕你当前画像、课程进度和薄弱点生成的具体学习安排。",
            "suitable_for": "适合已经完成课程基础导入，准备进入需求、设计、实现与测试主线强化阶段的学习者。",
            "goal_items": [
                {"day": 1, "title": "梳理课程主线", "focus": "软件生命周期与核心阶段", "task": "把课程当前章节放进软件工程全流程里，明确它前后衔接的阶段关系。", "deliverable": "一张软件工程主线图"},
                {"day": 2, "title": "强化需求分析", "focus": "需求获取与规格说明", "task": "围绕一个案例整理功能需求、非功能需求和核心用例。", "deliverable": "一份需求要点清单"},
                {"day": 3, "title": "拆解系统设计", "focus": "总体设计与模块划分", "task": "根据课程内容画出系统模块关系，并说明每个模块负责什么。", "deliverable": "一张模块结构图"},
                {"day": 4, "title": "推进实现思路", "focus": "详细设计与实现衔接", "task": "把一个模块从设计描述推进到实现层面，梳理数据流、接口和关键步骤。", "deliverable": "一份实现说明"},
                {"day": 5, "title": "补强测试意识", "focus": "测试计划与质量保证", "task": "围绕当前案例补出测试目标、测试方法和常见风险点。", "deliverable": "一份测试检查表"},
                {"day": 6, "title": "回看项目推进", "focus": "进度安排与协作治理", "task": "结合项目场景整理任务拆分、里程碑和沟通协作的关键控制点。", "deliverable": "一份阶段推进表"},
                {"day": 7, "title": "完成阶段复盘", "focus": "软件工程综合迁移应用", "task": "总结这一轮最关键的知识收获、当前薄弱点，以及下一轮最该继续补的部分。", "deliverable": "一份阶段复盘总结"},
            ],
            "review_cards": [
                {"id": "se-card-1", "prompt": "需求分析最核心的产出是什么？", "answer": "是能被团队共同理解和执行的需求规格，它需要把功能边界、约束条件和用户目标表达清楚。", "review_stage": "首次回顾", "next_review_in_hours": 12, "source_video": "软件需求分析与总体设计"},
                {"id": "se-card-2", "prompt": "总体设计和详细设计的区别是什么？", "answer": "总体设计解决系统怎么分、模块怎么协作；详细设计进一步说明模块内部怎么实现。", "review_stage": "巩固回顾", "next_review_in_hours": 24, "source_video": "系统设计与模块划分"},
                {"id": "se-card-3", "prompt": "测试计划为什么不能等开发做完再想？", "answer": "因为测试目标、覆盖范围和验收标准会反过来影响设计与实现，越晚补越容易返工。", "review_stage": "迁移回顾", "next_review_in_hours": 48, "source_video": "测试计划与质量保证"},
            ],
            "levels": [
                {"level": "beginner", "label": "小白版", "fit_score": 66, "description": "先建立软件工程全景认知，重点看懂生命周期、需求、设计和测试分别在做什么。", "recommended_topics": ["软件生命周期", "过程模型基础", "需求分析入门"]},
                {"level": "intermediate", "label": "进阶版", "fit_score": 93, "description": "你当前更适合做系统设计、需求拆解、实现衔接和测试计划这些主线强化。", "recommended_topics": ["需求规格说明", "模块划分", "详细设计与实现衔接", "测试计划设计"]},
                {"level": "expert", "label": "专家版", "fit_score": 78, "description": "可以继续往项目治理、质量保障、团队协作和阶段交付表达推进。", "recommended_topics": ["项目治理", "质量保证体系", "进度控制与协作"]},
            ],
            "growth_title": "成长型学习画像",
            "growth_summary": "画像不再只记录你看过什么，而是展示你是否已经形成了需求理解、结构拆解、方案表达和项目推进这些可迁移能力。",
            "next_milestone": "再完成一次从需求到设计再到测试的完整小闭环，你就会进入更稳定的综合应用阶段。",
            "dimensions": [
                {"key": "planning", "label": "主线规划", "score": 82, "trend": "up", "evidence": "已经开始按课程主线而不是零散知识点推进学习。"},
                {"key": "execution", "label": "方案执行", "score": 87, "trend": "up", "evidence": "能把课堂内容衔接到资料、练习和阶段任务里。"},
                {"key": "review", "label": "复盘巩固", "score": 75, "trend": "steady", "evidence": "已经有回看动作，但方法论沉淀还可以更系统。"},
                {"key": "transfer", "label": "迁移应用", "score": 80, "trend": "up", "evidence": "开始把课程里的分析和设计思路迁回真实项目与案例。"},
            ],
        }
    }

    async def list_questions(
        self,
        *,
        user_id: int,
        course_id: int | None = None,
        section_id: int | None = None,
        only_mine: bool = False,
        page_no: int = 1,
        page_size: int = 10,
    ) -> LearningPageResponse:
        async with async_session_factory() as session:
            stmt = select(LearningQuestion).where(LearningQuestion.status == "active")
            if course_id is not None:
                stmt = stmt.where(LearningQuestion.course_id == course_id)
            if section_id is not None:
                stmt = stmt.where(LearningQuestion.section_id == section_id)
            if only_mine:
                stmt = stmt.where(LearningQuestion.user_id == user_id)
            stmt = stmt.order_by(LearningQuestion.id.desc())
            rows = list((await session.execute(stmt)).scalars().all())
            replies = await self._load_replies_map(session, question_ids=[item.id for item in rows])
            users = await self._load_user_meta_map(session, user_ids=self._collect_question_user_ids(rows, replies))
            enriched = [self._build_question_view(item, replies.get(item.id, []), users, viewer_id=user_id) for item in rows]
        return self._page(enriched, page_no=page_no, page_size=page_size)

    async def create_question(self, request: LearningQuestionCreateRequest, *, user_id: int) -> dict:
        async with async_session_factory() as session:
            question = LearningQuestion(
                id=self._next_question_id(),
                user_id=user_id,
                course_id=request.course_id,
                chapter_id=request.chapter_id,
                section_id=request.section_id,
                title=request.title.strip(),
                description=request.description.strip(),
                anonymity=request.anonymity,
                status="active",
            )
            session.add(question)
            await session.commit()
            await session.refresh(question)
            users = await self._load_user_meta_map(session, user_ids=[user_id])
        return self._build_question_view(question, [], users, viewer_id=user_id)

    async def get_question(self, question_id: int, *, user_id: int) -> dict:
        async with async_session_factory() as session:
            question = await self._get_question_or_404(session, question_id)
            replies = await self._load_replies_map(session, question_ids=[question_id])
            users = await self._load_user_meta_map(session, user_ids=self._collect_question_user_ids([question], replies))
        return self._build_question_view(question, replies.get(question_id, []), users, viewer_id=user_id)

    async def update_question(self, question_id: int, request: LearningQuestionUpdateRequest, *, user_id: int) -> dict:
        async with async_session_factory() as session:
            question = await self._get_question_or_404(session, question_id)
            self._ensure_owner(question.user_id, user_id)
            question.course_id = request.course_id
            question.chapter_id = request.chapter_id
            question.section_id = request.section_id
            question.title = request.title.strip()
            question.description = request.description.strip()
            question.anonymity = request.anonymity
            question.updated_at = self._now_iso()
            await session.commit()
            replies = await self._load_replies_map(session, question_ids=[question.id])
            users = await self._load_user_meta_map(session, user_ids=self._collect_question_user_ids([question], replies))
        return self._build_question_view(question, replies.get(question.id, []), users, viewer_id=user_id)

    async def delete_question(self, question_id: int, *, user_id: int) -> dict:
        async with async_session_factory() as session:
            question = await self._get_question_or_404(session, question_id)
            self._ensure_owner(question.user_id, user_id)
            question.status = "deleted"
            question.updated_at = self._now_iso()
            reply_stmt = select(LearningReply).where(LearningReply.question_id == question_id, LearningReply.status == "active")
            for reply in (await session.execute(reply_stmt)).scalars().all():
                reply.status = "deleted"
                reply.updated_at = self._now_iso()
            await session.commit()
        return {"deleted": True, "id": question_id}

    async def list_replies(
        self,
        *,
        user_id: int,
        question_id: int | None = None,
        answer_id: int | None = None,
        page_no: int = 1,
        page_size: int = 10,
    ) -> LearningPageResponse:
        async with async_session_factory() as session:
            stmt = select(LearningReply).where(LearningReply.status == "active")
            if answer_id is not None:
                stmt = stmt.where(LearningReply.answer_id == answer_id)
            else:
                stmt = stmt.where(LearningReply.question_id == question_id, LearningReply.answer_id.is_(None))
            stmt = stmt.order_by(LearningReply.id.asc())
            rows = list((await session.execute(stmt)).scalars().all())
            sibling_stmt = select(LearningReply).where(LearningReply.status == "active")
            if question_id is not None:
                sibling_stmt = sibling_stmt.where(LearningReply.question_id == question_id)
            siblings = list((await session.execute(sibling_stmt)).scalars().all())
            users = await self._load_user_meta_map(session, user_ids=self._collect_reply_user_ids(siblings))
            enriched = [self._build_reply_view(item, siblings, users, viewer_id=user_id) for item in rows]
        return self._page(enriched, page_no=page_no, page_size=page_size)

    async def create_reply(self, request: LearningReplyCreateRequest, *, user_id: int) -> dict:
        async with async_session_factory() as session:
            await self._get_question_or_404(session, request.question_id)
            reply = LearningReply(
                id=self._next_reply_id(),
                question_id=request.question_id,
                user_id=user_id,
                answer_id=request.answer_id,
                target_reply_id=request.target_reply_id,
                target_user_id=request.target_user_id,
                content=request.content.strip(),
                anonymity=request.anonymity,
                liked_times=0,
                liked_user_ids=[],
                status="active",
            )
            session.add(reply)
            await session.commit()
            sibling_stmt = select(LearningReply).where(
                LearningReply.question_id == request.question_id,
                LearningReply.status == "active",
            )
            siblings = list((await session.execute(sibling_stmt)).scalars().all())
            users = await self._load_user_meta_map(session, user_ids=self._collect_reply_user_ids(siblings))
        return self._build_reply_view(reply, siblings, users, viewer_id=user_id)

    async def toggle_like(self, request: LearningLikeRequest, *, user_id: int) -> dict:
        if request.biz_type != "QA":
            raise HTTPException(status_code=400, detail="unsupported biz type")
        async with async_session_factory() as session:
            reply = await self._get_reply_or_404(session, request.biz_id)
            liked_user_ids = list(reply.liked_user_ids or [])
            if request.liked:
                if user_id not in liked_user_ids:
                    liked_user_ids.append(user_id)
            else:
                liked_user_ids = [item for item in liked_user_ids if item != user_id]
            reply.liked_user_ids = liked_user_ids
            reply.liked_times = len(liked_user_ids)
            reply.updated_at = self._now_iso()
            await session.commit()
        return {"liked": request.liked, "liked_times": reply.liked_times}

    async def list_notes(
        self,
        *,
        user_id: int,
        course_id: int | None = None,
        section_id: int | None = None,
        only_mine: bool = True,
        page_no: int = 1,
        page_size: int = 1000,
    ) -> LearningPageResponse:
        async with async_session_factory() as session:
            stmt = select(LearningNote).where(LearningNote.status == "active")
            if course_id is not None:
                stmt = stmt.where(LearningNote.course_id == course_id)
            if section_id is not None:
                stmt = stmt.where(LearningNote.section_id == section_id)
            if only_mine:
                stmt = stmt.where(LearningNote.user_id == user_id)
            stmt = stmt.order_by(LearningNote.id.desc())
            rows = list((await session.execute(stmt)).scalars().all())
            users = await self._load_user_meta_map(session, user_ids=[item.user_id for item in rows])
            enriched = [self._build_note_view(item, users, viewer_id=user_id) for item in rows]
        return self._page(enriched, page_no=page_no, page_size=page_size)

    async def create_note(self, request: LearningNoteCreateRequest, *, user_id: int) -> dict:
        async with async_session_factory() as session:
            note = LearningNote(
                id=self._next_note_id(),
                user_id=user_id,
                course_id=request.course_id,
                chapter_id=request.chapter_id,
                section_id=request.section_id,
                content=request.content.strip(),
                note_moment=request.note_moment,
                is_private=request.is_private,
                is_gathered=False,
                status="active",
            )
            session.add(note)
            await session.commit()
            users = await self._load_user_meta_map(session, user_ids=[user_id])
        return self._build_note_view(note, users, viewer_id=user_id)

    async def update_note(self, note_id: int, request: LearningNoteUpdateRequest, *, user_id: int) -> dict:
        async with async_session_factory() as session:
            note = await self._get_note_or_404(session, note_id)
            self._ensure_owner(note.user_id, user_id)
            note.content = request.content.strip()
            note.is_private = request.is_private
            note.updated_at = self._now_iso()
            await session.commit()
            users = await self._load_user_meta_map(session, user_ids=[note.user_id])
        return self._build_note_view(note, users, viewer_id=user_id)

    async def delete_note(self, note_id: int, *, user_id: int) -> dict:
        async with async_session_factory() as session:
            note = await self._get_note_or_404(session, note_id)
            self._ensure_owner(note.user_id, user_id)
            note.status = "deleted"
            note.updated_at = self._now_iso()
            await session.commit()
        return {"deleted": True, "id": note_id}

    async def gather_note(self, note_id: int, gathered: bool, *, user_id: int) -> dict:
        async with async_session_factory() as session:
            note = await self._get_note_or_404(session, note_id)
            self._ensure_owner(note.user_id, user_id)
            note.is_gathered = gathered
            note.updated_at = self._now_iso()
            await session.commit()
            users = await self._load_user_meta_map(session, user_ids=[note.user_id])
        return self._build_note_view(note, users, viewer_id=user_id)

    async def generate_exam(self, request: LearningExamGenerateRequest) -> dict:
        exam_id = next(self._exam_id_seq)
        questions = [
            {
                "id": exam_id * 10 + 1,
                "type": 1,
                "name": "哪种讲法更适合课堂演示主线？",
                "options": ["先讲技术栈", "先讲业务目标，再串课堂与资源闭环", "直接展示数据库表结构"],
                "answers": "",
            },
            {
                "id": exam_id * 10 + 2,
                "type": 5,
                "name": "请用一句话解释为什么个性化资源推荐值得信任。",
                "options": [],
                "answers": "",
            },
        ]
        self._exams[exam_id] = {"id": exam_id, "request": request.model_dump(), "questions": deepcopy(questions)}
        return {"id": exam_id, "questions": questions}

    async def submit_exam(self, request: LearningExamSubmitRequest) -> list[dict]:
        exam = self._exams.get(request.id)
        if exam is None:
            raise HTTPException(status_code=404, detail="exam not found")
        answer_map = {item.question_id: item.answer for item in request.exam_details}
        result = []
        for item in deepcopy(exam["questions"]):
            item["answers"] = answer_map.get(item["id"], "")
            result.append(item)
        return result

    async def get_personalized_next_step(self, *, user_id: int, course_id: int, section_index: int = 0) -> PersonalizedNextStepResponse:
        data = self._resolve_personalized_data(course_id)
        session_state = await self._get_learning_session_state(user_id=user_id, course_id=course_id)
        completed_sections = session_state["completed_sections"]
        watched_seconds = session_state["total_watched_seconds"]
        resolved_section_index = max(section_index, max(completed_sections, default=-1) + 1 if completed_sections else section_index)
        personalization_context = await self._build_personalization_context(user_id=user_id, course_id=course_id)
        next_topic = data["goal_items"][min(resolved_section_index, len(data["goal_items"]) - 1)]["focus"]
        if personalization_context["focus_knowledge_points"]:
            next_topic = f"{next_topic} + {personalization_context['focus_knowledge_points'][0]}"
        next_action = "建议先继续当前课堂，再用 AI 导师生成一份讲义或 PPT。"
        if watched_seconds >= 1800:
            next_action = "建议先做一轮随堂测评，再让 AI 导师帮你总结错因。"
        if personalization_context["latest_score"] is not None and personalization_context["latest_score"] < 75:
            next_action = "建议先回看薄弱知识点 10 分钟，再进入下一节。"
        reason_parts = [data["reason"], f"当前已累计学习 {watched_seconds // 60} 分钟，完成 {len(completed_sections)} 个片段。"]
        if personalization_context["improvement"] is not None:
            reason_parts.append(f"最近测评分提升 {personalization_context['improvement']} 分。")
        if personalization_context["favorite_resource_type"]:
            reason_parts.append(f"你最近更偏好 {personalization_context['favorite_resource_type']} 类资料。")
        return PersonalizedNextStepResponse(
            course_id=course_id,
            section_index=resolved_section_index,
            current_video=f"第 {resolved_section_index + 1} 节学习片段",
            next_topic=next_topic,
            next_action=next_action,
            target_goal=data["target_goal"],
            estimated_minutes=data["estimated_minutes"],
            difficulty_level=self._resolve_recommended_level(session_state, personalization_context["latest_score"]),
            reason=" ".join(reason_parts),
            recommended_resources=self._personalize_resources(data["recommended_resources"], personalization_context),
        )

    async def get_goal_path(self, *, user_id: int, course_id: int) -> GoalPathResponse:
        data = self._resolve_personalized_data(course_id)
        personalization_context = await self._build_personalization_context(user_id=user_id, course_id=course_id)
        items = deepcopy(data["goal_items"])
        if personalization_context["focus_knowledge_points"]:
            items[0]["focus"] = f"{items[0]['focus']} / 优先补齐：{personalization_context['focus_knowledge_points'][0]}"
        return GoalPathResponse(
            course_id=course_id,
            goal_title=data["goal_title"],
            goal_subtitle=data["goal_subtitle"],
            suitable_for=data["suitable_for"],
            items=items,
        )

    async def get_review_plan(self, *, user_id: int, course_id: int, section_index: int = 0) -> ReviewPlanResponse:
        data = self._resolve_personalized_data(course_id)
        session_state = await self._get_learning_session_state(user_id=user_id, course_id=course_id)
        personalization_context = await self._build_personalization_context(user_id=user_id, course_id=course_id)
        workflow_state = await build_review_reminder_workflow().ainvoke(
            {
                "user_id": user_id,
                "course_id": course_id,
                "section_index": section_index,
                "total_watched_seconds": session_state["total_watched_seconds"],
                "completed_sections": session_state["completed_sections"],
                "latest_score": personalization_context["latest_score"],
                "improvement": personalization_context["improvement"],
                "focus_knowledge_points": personalization_context["focus_knowledge_points"],
                "favorite_resource_type": personalization_context["favorite_resource_type"],
                "base_summary": f"已根据第 {section_index + 1} 节内容生成回顾卡片与复习节奏。",
                "review_cards": deepcopy(data["review_cards"]),
                "execution_trace": [],
            }
        )
        summary = str(workflow_state.get("summary") or f"已根据第 {section_index + 1} 节内容生成回顾卡片与复习节奏。")
        cards = list(workflow_state.get("cards") or [])
        await ReviewReminderDeliveryService().upsert_review_plan_reminder(
            user_id=user_id,
            course_id=course_id,
            section_index=section_index,
            summary=summary,
            cards=cards,
        )
        return ReviewPlanResponse(course_id=course_id, summary=summary, cards=cards)

    async def get_level_recommendation(self, *, user_id: int, course_id: int) -> LevelRecommendationResponse:
        data = self._resolve_personalized_data(course_id)
        session_state = await self._get_learning_session_state(user_id=user_id, course_id=course_id)
        personalization_context = await self._build_personalization_context(user_id=user_id, course_id=course_id)
        active_level = self._resolve_recommended_level(session_state, personalization_context["latest_score"])
        items = deepcopy(data["levels"])
        for item in items:
            if item["level"] == active_level:
                item["fit_score"] = min(99, item["fit_score"] + 4)
            if personalization_context["focus_knowledge_points"] and item["level"] != "beginner":
                item["recommended_topics"] = item["recommended_topics"] + personalization_context["focus_knowledge_points"][:1]
        return LevelRecommendationResponse(course_id=course_id, active_level=active_level, items=items)

    async def get_growth_map(self, *, course_id: int, user_id: int) -> GrowthMapResponse:
        data = self._resolve_personalized_data(course_id)
        session_state = await self._get_learning_session_state(user_id=user_id, course_id=course_id)
        personalization_context = await self._build_personalization_context(user_id=user_id, course_id=course_id)
        dimensions = deepcopy(data["dimensions"])
        completed_count = len(session_state["completed_sections"])
        watched_bonus = min(12, session_state["total_watched_seconds"] // 300)
        for item in dimensions:
            if item["key"] == "execution":
                item["score"] = min(99, item["score"] + watched_bonus)
                item["evidence"] = f"累计观看 {session_state['total_watched_seconds'] // 60} 分钟，完成 {completed_count} 个课堂片段。"
            elif item["key"] == "review":
                item["score"] = min(99, item["score"] + completed_count * 2)
            elif item["key"] == "planning":
                item["score"] = min(99, item["score"] + completed_count)
            elif item["key"] == "transfer" and personalization_context["favorite_resource_type"]:
                item["score"] = min(99, item["score"] + 3)
                item["evidence"] = f"最近偏好 {personalization_context['favorite_resource_type']} 资料，说明已开始主动挑选合适材料。"
        summary = data["growth_summary"]
        if personalization_context["latest_score"] is not None:
            summary = f"{summary} 最近一次测评分数 {personalization_context['latest_score']}，更能反映真实掌握情况。"
        return GrowthMapResponse(
            course_id=course_id,
            user_id=user_id,
            title=data["growth_title"],
            summary=summary,
            next_milestone=data["next_milestone"],
            dimensions=dimensions,
        )

    async def record_learning_session_event(self, request: LearningSessionEventRequest) -> LearningSessionEventResponse:
        state = await self._get_learning_session_state(user_id=request.user_id, course_id=request.course_id)
        state["total_watched_seconds"] = max(state["total_watched_seconds"], request.watched_seconds)
        if request.completed and request.section_index not in state["completed_sections"]:
            state["completed_sections"].append(request.section_index)
            state["completed_sections"].sort()
        state["last_event_type"] = request.event_type
        await self._save_learning_session_state(user_id=request.user_id, course_id=request.course_id, state=state)
        return LearningSessionEventResponse(
            user_id=request.user_id,
            course_id=request.course_id,
            section_index=request.section_index,
            total_watched_seconds=state["total_watched_seconds"],
            completed_sections=state["completed_sections"],
            recommended_level=self._resolve_recommended_level(state),
        )

    async def _load_replies_map(self, session, *, question_ids: list[int]) -> dict[int, list[LearningReply]]:
        if not question_ids:
            return {}
        stmt = select(LearningReply).where(LearningReply.question_id.in_(question_ids), LearningReply.status == "active").order_by(LearningReply.id.asc())
        rows = list((await session.execute(stmt)).scalars().all())
        result: dict[int, list[LearningReply]] = {}
        for row in rows:
            result.setdefault(row.question_id, []).append(row)
        return result

    async def _load_user_meta_map(self, session, *, user_ids: list[int]) -> dict[int, dict]:
        unique_ids = sorted({int(item) for item in user_ids if item is not None})
        if not unique_ids:
            return {}
        stmt = select(UserProfileSnapshot).where(UserProfileSnapshot.user_id.in_(unique_ids))
        snapshots = list((await session.execute(stmt)).scalars().all())
        latest_by_user: dict[int, UserProfileSnapshot] = {}
        for snapshot in snapshots:
            current = latest_by_user.get(snapshot.user_id)
            if current is None or int(snapshot.version or 0) >= int(current.version or 0):
                latest_by_user[snapshot.user_id] = snapshot
        result: dict[int, dict] = {}
        for user_id in unique_ids:
            snapshot = latest_by_user.get(user_id)
            profile_data = snapshot.profile_data if snapshot else {}
            result[user_id] = {
                "name": str(profile_data.get("name") or f"用户 {user_id}"),
                "icon": "/src/assets/icon.jpeg",
            }
        return result

    def _build_question_view(self, item: LearningQuestion, replies: list[LearningReply], users: dict[int, dict], *, viewer_id: int) -> dict:
        latest = replies[-1] if replies else None
        top_level_count = len([reply for reply in replies if reply.answer_id is None])
        user_name, user_icon = self._resolve_identity(item.user_id, item.anonymity, users)
        latest_name, _ = self._resolve_identity(latest.user_id, latest.anonymity, users) if latest else ("", "")
        return {
            "id": item.id,
            "courseId": item.course_id,
            "chapterId": item.chapter_id,
            "sectionId": item.section_id,
            "title": item.title,
            "description": item.description,
            "anonymity": item.anonymity,
            "userId": item.user_id,
            "userName": user_name,
            "userIcon": user_icon,
            "createTime": item.created_at or item.updated_at or "",
            "answerTimes": top_level_count,
            "latestAnswer": self._build_latest_answer(latest, users),
            "latestReplyContent": latest.content if latest else "",
            "latestReplyUser": latest_name if latest else "",
        }

    def _build_reply_view(self, item: LearningReply, siblings: list[LearningReply], users: dict[int, dict], *, viewer_id: int) -> dict:
        target_user_name = ""
        if item.target_reply_id:
            target = next((reply for reply in siblings if reply.id == item.target_reply_id), None)
            if target is not None:
                target_user_name, _ = self._resolve_identity(target.user_id, target.anonymity, users)
        nested_count = len([reply for reply in siblings if reply.answer_id == item.id])
        user_name, user_icon = self._resolve_identity(item.user_id, item.anonymity, users)
        liked_user_ids = list(item.liked_user_ids or [])
        return {
            "id": item.id,
            "questionId": item.question_id,
            "answerId": item.answer_id,
            "targetReplyId": item.target_reply_id,
            "targetUserId": item.target_user_id,
            "targetUserName": target_user_name,
            "userId": item.user_id,
            "userName": user_name,
            "userIcon": user_icon,
            "content": item.content,
            "createTime": item.created_at or item.updated_at or "",
            "liked": viewer_id in liked_user_ids,
            "likedTimes": int(item.liked_times or 0),
            "replyTimes": nested_count,
        }

    def _build_note_view(self, item: LearningNote, users: dict[int, dict], *, viewer_id: int) -> dict:
        user_meta = users.get(item.user_id) or {"name": f"用户 {item.user_id}", "icon": "/src/assets/icon.jpeg"}
        return {
            "id": item.id,
            "courseId": item.course_id,
            "chapterId": item.chapter_id,
            "sectionId": item.section_id,
            "authorId": item.user_id,
            "authorName": user_meta["name"],
            "authorIcon": user_meta["icon"],
            "content": item.content,
            "noteMoment": item.note_moment,
            "isPrivate": item.is_private,
            "isGathered": item.is_gathered,
            "createTime": item.created_at or item.updated_at or "",
        }

    def _build_latest_answer(self, item: LearningReply | None, users: dict[int, dict]) -> dict | None:
        if item is None:
            return None
        user_name, _ = self._resolve_identity(item.user_id, item.anonymity, users)
        return {"content": item.content, "replier": {"id": item.user_id, "name": user_name}}

    @staticmethod
    def _page(items: list[dict], *, page_no: int, page_size: int) -> LearningPageResponse:
        size = max(page_size, 1)
        start = max(page_no - 1, 0) * size
        return LearningPageResponse(list=items[start : start + size], total=len(items))

    async def _get_question_or_404(self, session, question_id: int) -> LearningQuestion:
        question = await session.get(LearningQuestion, question_id)
        if question is None or question.status != "active":
            raise HTTPException(status_code=404, detail="question not found")
        return question

    async def _get_reply_or_404(self, session, reply_id: int) -> LearningReply:
        reply = await session.get(LearningReply, reply_id)
        if reply is None or reply.status != "active":
            raise HTTPException(status_code=404, detail="reply not found")
        return reply

    async def _get_note_or_404(self, session, note_id: int) -> LearningNote:
        note = await session.get(LearningNote, note_id)
        if note is None or note.status != "active":
            raise HTTPException(status_code=404, detail="note not found")
        return note

    def _resolve_personalized_data(self, course_id: int) -> dict:
        return deepcopy(self._personalized_course_data.get(course_id) or self._personalized_course_data[401])

    async def _get_learning_session_state(self, *, user_id: int, course_id: int) -> dict:
        cache_key = (user_id, course_id)
        try:
            async with async_session_factory() as session:
                current = await PersonalizedLearningStateRepository().get_by_user_course(session, user_id=user_id, course_id=course_id)
        except SQLAlchemyError:
            current = None
        if current is None:
            cached = self._learning_session_state.get(cache_key)
            if cached is not None:
                return deepcopy(cached)
            return {"total_watched_seconds": 0, "completed_sections": [], "last_event_type": "init"}
        return {
            "total_watched_seconds": int(current.total_watched_seconds or 0),
            "completed_sections": list(current.completed_sections or []),
            "last_event_type": current.last_event_type or "init",
        }

    async def _save_learning_session_state(self, *, user_id: int, course_id: int, state: dict) -> None:
        normalized_state = {
            "total_watched_seconds": int(state.get("total_watched_seconds", 0)),
            "completed_sections": list(state.get("completed_sections", [])),
            "last_event_type": str(state.get("last_event_type", "init")),
        }
        self._learning_session_state[(user_id, course_id)] = deepcopy(normalized_state)
        try:
            async with async_session_factory() as session:
                await PersonalizedLearningStateRepository().upsert_state(
                    session,
                    user_id=user_id,
                    course_id=course_id,
                    total_watched_seconds=normalized_state["total_watched_seconds"],
                    completed_sections=normalized_state["completed_sections"],
                    last_event_type=normalized_state["last_event_type"],
                    created_at=self._now_text(),
                    updated_at=self._now_text(),
                )
                await session.commit()
        except SQLAlchemyError:
            return

    @staticmethod
    def _resolve_recommended_level(state: dict, latest_score: float | None = None) -> str:
        completed_count = len(state.get("completed_sections", []))
        watched_seconds = int(state.get("total_watched_seconds", 0))
        if latest_score is not None:
            if latest_score >= 85:
                return "expert"
            if latest_score >= 70:
                return "intermediate"
            return "beginner"
        if completed_count >= 3 or watched_seconds >= 2400:
            return "expert"
        if completed_count >= 1 or watched_seconds >= 900:
            return "intermediate"
        return "beginner"

    async def _build_personalization_context(self, *, user_id: int, course_id: int) -> dict:
        latest_score = None
        improvement = None
        focus_knowledge_points: list[str] = []
        favorite_resource_type = None
        try:
            trend = await EvaluationHistoryService().get_trend(user_id=user_id, course_id=course_id, limit=5)
            latest_score = trend.latest_score
            improvement = trend.improvement
            focus_knowledge_points = list(trend.focus_knowledge_points or [])
        except Exception:
            pass
        try:
            favorite_summary = await ResourceFavoriteSummaryService().get_summary(user_id=user_id)
            if favorite_summary.by_type:
                favorite_resource_type = max(favorite_summary.by_type.items(), key=lambda item: item[1])[0]
        except Exception:
            pass
        return {
            "latest_score": latest_score,
            "improvement": improvement,
            "focus_knowledge_points": focus_knowledge_points,
            "favorite_resource_type": favorite_resource_type,
        }

    @staticmethod
    def _personalize_resources(resource_titles: list[str], context: dict) -> list[str]:
        resources = list(resource_titles)
        favorite_resource_type = context.get("favorite_resource_type")
        if favorite_resource_type:
            resources.insert(0, f"优先补充：{favorite_resource_type} 类资料")
        focus_knowledge_points = context.get("focus_knowledge_points") or []
        if focus_knowledge_points:
            resources.append(f"薄弱点专项：{focus_knowledge_points[0]}")
        return resources[:5]

    @staticmethod
    def _resolve_identity(user_id: int, anonymity: bool, users: dict[int, dict]) -> tuple[str, str]:
        if anonymity:
            return "匿名用户", "/src/assets/anonymity.png"
        meta = users.get(user_id) or {"name": f"用户 {user_id}", "icon": "/src/assets/icon.jpeg"}
        return str(meta["name"]), str(meta["icon"])

    @staticmethod
    def _ensure_owner(owner_id: int, current_user_id: int) -> None:
        if int(owner_id) != int(current_user_id):
            raise HTTPException(status_code=403, detail="permission denied")

    @staticmethod
    def _collect_question_user_ids(questions: list[LearningQuestion], replies_map: dict[int, list[LearningReply]]) -> list[int]:
        ids = [item.user_id for item in questions]
        for replies in replies_map.values():
            ids.extend(reply.user_id for reply in replies)
        return ids

    @staticmethod
    def _collect_reply_user_ids(replies: list[LearningReply]) -> list[int]:
        return [item.user_id for item in replies]

    @staticmethod
    def _next_question_id() -> int:
        return int(datetime.now().timestamp() * 1000)

    @staticmethod
    def _next_reply_id() -> int:
        return int(datetime.now().timestamp() * 1000) + 1

    @staticmethod
    def _next_note_id() -> int:
        return int(datetime.now().timestamp() * 1000) + 2

    @staticmethod
    def _now_text() -> str:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    @staticmethod
    def _now_iso() -> str:
        return datetime.now().isoformat(timespec="seconds")
