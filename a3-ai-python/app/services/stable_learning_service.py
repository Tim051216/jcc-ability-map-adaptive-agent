from __future__ import annotations

from app.schemas.learning import (
    GoalPathResponse,
    GoalPathItem,
    GrowthDimensionItem,
    GrowthMapResponse,
    LearningExamGenerateRequest,
    LearningSessionEventRequest,
    LearningSessionEventResponse,
    LearningExamSubmitRequest,
    LearningLikeRequest,
    LearningNoteCreateRequest,
    LearningNoteUpdateRequest,
    LearningPageResponse,
    LearningQuestionCreateRequest,
    LearningQuestionUpdateRequest,
    LearningReplyCreateRequest,
    LevelRecommendationItem,
    LevelRecommendationResponse,
    PersonalizedNextStepResponse,
    ReviewCardItem,
    ReviewPlanResponse,
)
from app.services.learning_service import LearningService as RuntimeLearningService


class LearningService:
    def __init__(self) -> None:
        self.runtime = RuntimeLearningService()

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
        return await self.runtime.list_questions(
            user_id=user_id,
            course_id=course_id,
            section_id=section_id,
            only_mine=only_mine,
            page_no=page_no,
            page_size=page_size,
        )

    async def create_question(self, request: LearningQuestionCreateRequest, *, user_id: int) -> dict:
        return await self.runtime.create_question(request, user_id=user_id)

    async def get_question(self, question_id: int, *, user_id: int) -> dict:
        return await self.runtime.get_question(question_id, user_id=user_id)

    async def update_question(self, question_id: int, request: LearningQuestionUpdateRequest, *, user_id: int) -> dict:
        return await self.runtime.update_question(question_id, request, user_id=user_id)

    async def delete_question(self, question_id: int, *, user_id: int) -> dict:
        return await self.runtime.delete_question(question_id, user_id=user_id)

    async def list_replies(
        self,
        *,
        user_id: int,
        question_id: int | None = None,
        answer_id: int | None = None,
        page_no: int = 1,
        page_size: int = 10,
    ) -> LearningPageResponse:
        return await self.runtime.list_replies(
            user_id=user_id,
            question_id=question_id,
            answer_id=answer_id,
            page_no=page_no,
            page_size=page_size,
        )

    async def create_reply(self, request: LearningReplyCreateRequest, *, user_id: int) -> dict:
        return await self.runtime.create_reply(request, user_id=user_id)

    async def toggle_like(self, request: LearningLikeRequest, *, user_id: int) -> dict:
        return await self.runtime.toggle_like(request, user_id=user_id)

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
        return await self.runtime.list_notes(
            user_id=user_id,
            course_id=course_id,
            section_id=section_id,
            only_mine=only_mine,
            page_no=page_no,
            page_size=page_size,
        )

    async def create_note(self, request: LearningNoteCreateRequest, *, user_id: int) -> dict:
        return await self.runtime.create_note(request, user_id=user_id)

    async def update_note(self, note_id: int, request: LearningNoteUpdateRequest, *, user_id: int) -> dict:
        return await self.runtime.update_note(note_id, request, user_id=user_id)

    async def delete_note(self, note_id: int, *, user_id: int) -> dict:
        return await self.runtime.delete_note(note_id, user_id=user_id)

    async def gather_note(self, note_id: int, gathered: bool, *, user_id: int) -> dict:
        return await self.runtime.gather_note(note_id, gathered, user_id=user_id)

    async def generate_exam(self, request: LearningExamGenerateRequest) -> dict:
        return await self.runtime.generate_exam(request)

    async def submit_exam(self, request: LearningExamSubmitRequest) -> list[dict]:
        return await self.runtime.submit_exam(request)

    async def record_learning_session_event(self, request: LearningSessionEventRequest) -> LearningSessionEventResponse:
        return await self.runtime.record_learning_session_event(request)

    async def get_personalized_next_step(self, *, user_id: int, course_id: int, section_index: int = 0) -> PersonalizedNextStepResponse:
        return PersonalizedNextStepResponse(
            course_id=course_id,
            section_index=section_index,
            current_video=f"第 {section_index + 1} 节课堂片段",
            next_topic="先完成当前主线知识点，再补一轮结构化复习",
            next_action="建议先继续当前课堂内容，再生成讲义或导图进行复盘。",
            target_goal="7 天完成软件工程核心主线的一轮强化",
            estimated_minutes=35,
            difficulty_level="intermediate",
            reason="你已经进入课程主线推进阶段，当前更适合围绕需求、设计、测试和交付做连续强化。",
            recommended_resources=["课堂讲义", "知识导图", "随堂练习"],
        )

    async def get_goal_path(self, *, user_id: int, course_id: int) -> GoalPathResponse:
        return GoalPathResponse(
            course_id=course_id,
            goal_title="7 天软件工程进阶路径",
            goal_subtitle="围绕你当前的学习阶段，把课程内容拆成可以连续完成的小闭环。",
            suitable_for="适合已经完成课程导入，准备进入需求、设计、实现与测试主线强化的学习者。",
            items=[
                GoalPathItem(day=1, title="梳理课程主线", focus="软件工程生命周期与章节关系", task="先把当前章节放回整个软件工程主线中，明确它解决什么问题。", deliverable="一张主线关系图"),
                GoalPathItem(day=2, title="强化需求分析", focus="需求获取与用例建模", task="围绕一个案例整理功能需求、非功能需求和核心用户流程。", deliverable="一份需求要点清单"),
                GoalPathItem(day=3, title="推进设计理解", focus="模块划分与接口协作", task="把当前章节里的设计思路画成结构图，并解释模块间如何协作。", deliverable="一张模块结构图"),
            ],
        )

    async def get_review_plan(self, *, user_id: int, course_id: int, section_index: int = 0) -> ReviewPlanResponse:
        return ReviewPlanResponse(
            course_id=course_id,
            summary=f"已根据第 {section_index + 1} 节内容生成一组课堂回顾卡，适合先记主线、再补案例、最后做迁移复述。",
            cards=[
                ReviewCardItem(
                    id="review-1",
                    prompt="这一节最核心的问题是什么？",
                    answer="先回答本节知识点为什么存在、解决什么问题，再去记术语和定义。",
                    review_stage="首次回顾",
                    next_review_in_hours=12,
                    source_video="软件工程与实践（第4版）",
                ),
                ReviewCardItem(
                    id="review-2",
                    prompt="这一节和上一节是怎么衔接的？",
                    answer="把当前章节放回课程主线里，说明它承接了什么输入，又为下一步提供了什么输出。",
                    review_stage="巩固回顾",
                    next_review_in_hours=24,
                    source_video="软件工程与实践（第4版）",
                ),
                ReviewCardItem(
                    id="review-3",
                    prompt="如果把这一节放到项目里，它会落在哪？",
                    answer="优先用真实项目场景解释它的职责、边界和交付价值，而不是只背定义。",
                    review_stage="迁移回顾",
                    next_review_in_hours=48,
                    source_video="软件工程与实践（第4版）",
                ),
            ],
        )

    async def get_level_recommendation(self, *, user_id: int, course_id: int) -> LevelRecommendationResponse:
        return LevelRecommendationResponse(
            course_id=course_id,
            active_level="intermediate",
            items=[
                LevelRecommendationItem(
                    level="beginner",
                    label="基础巩固",
                    fit_score=68,
                    description="先建立完整课程框架，重点看清章节边界、术语含义和基本流程。",
                    recommended_topics=["软件生命周期", "需求分析基础", "测试基础"],
                ),
                LevelRecommendationItem(
                    level="intermediate",
                    label="主线强化",
                    fit_score=93,
                    description="你当前更适合进入需求拆解、设计理解、测试验证和项目推进这条主线。",
                    recommended_topics=["需求规格说明", "模块划分", "测试计划设计", "阶段性交付"],
                ),
                LevelRecommendationItem(
                    level="expert",
                    label="综合迁移",
                    fit_score=79,
                    description="适合进一步把课程能力迁移到复杂项目、答辩表达和团队协作治理中。",
                    recommended_topics=["项目治理", "质量保障", "交付复盘"],
                ),
            ],
        )

    async def get_growth_map(self, *, course_id: int, user_id: int) -> GrowthMapResponse:
        return GrowthMapResponse(
            course_id=course_id,
            user_id=user_id,
            title="AI 自动画像解读",
            summary="当前画像显示，你已经进入软件工程主线强化阶段，适合以结构化任务拆解、案例分析和连续复盘来推进学习。",
            next_milestone="再完成一轮从需求到设计再到测试的完整小闭环，就可以进入更稳定的综合应用阶段。",
            dimensions=[
                GrowthDimensionItem(key="planning", label="主线规划", score=82, trend="up", evidence="已经开始按章节主线而不是零散知识点推进学习。"),
                GrowthDimensionItem(key="execution", label="执行推进", score=86, trend="up", evidence="能够把课程内容推进到讲义、练习和阶段任务里。"),
                GrowthDimensionItem(key="review", label="复盘巩固", score=75, trend="steady", evidence="已经有回看和总结动作，但还可以再系统一些。"),
                GrowthDimensionItem(key="transfer", label="迁移应用", score=80, trend="up", evidence="开始把课堂里的分析和设计思路迁移到真实项目场景中。"),
            ],
        )
