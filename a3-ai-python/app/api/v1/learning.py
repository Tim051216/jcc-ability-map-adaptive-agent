from fastapi import APIRouter, Depends

from app.api.deps import get_current_user_id

from app.schemas.learning import (
    GoalPathResponse,
    GrowthMapResponse,
    LearningExamGenerateRequest,
    LearningExamSubmitRequest,
    LearningLikeRequest,
    LearningNoteCreateRequest,
    LearningNoteUpdateRequest,
    LearningPageResponse,
    LearningSessionEventRequest,
    LearningSessionEventResponse,
    LevelRecommendationResponse,
    PersonalizedNextStepResponse,
    LearningQuestionCreateRequest,
    LearningQuestionUpdateRequest,
    LearningReplyCreateRequest,
    ReviewPlanResponse,
)
from app.services.stable_learning_service import LearningService

router = APIRouter()


@router.get("/questions/page", response_model=LearningPageResponse)
async def list_questions(
    courseId: int | None = None,
    sectionId: int | None = None,
    onlyMine: bool = False,
    pageNo: int = 1,
    pageSize: int = 10,
    user_id: int = Depends(get_current_user_id),
) -> LearningPageResponse:
    service = LearningService()
    return await service.list_questions(
        user_id=user_id,
        course_id=courseId,
        section_id=sectionId,
        only_mine=onlyMine,
        page_no=pageNo,
        page_size=pageSize,
    )


@router.post("/questions")
async def create_question(request: LearningQuestionCreateRequest, user_id: int = Depends(get_current_user_id)) -> dict:
    return await LearningService().create_question(request, user_id=user_id)


@router.get("/questions/{question_id}")
async def get_question(question_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    return await LearningService().get_question(question_id, user_id=user_id)


@router.put("/questions/{question_id}")
async def update_question(
    question_id: int,
    request: LearningQuestionUpdateRequest,
    user_id: int = Depends(get_current_user_id),
) -> dict:
    return await LearningService().update_question(question_id, request, user_id=user_id)


@router.delete("/questions/{question_id}")
async def delete_question(question_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    return await LearningService().delete_question(question_id, user_id=user_id)


@router.get("/replies/page", response_model=LearningPageResponse)
async def list_replies(
    questionId: int | None = None,
    answerId: int | None = None,
    pageNo: int = 1,
    pageSize: int = 10,
    user_id: int = Depends(get_current_user_id),
) -> LearningPageResponse:
    return await LearningService().list_replies(
        user_id=user_id,
        question_id=questionId,
        answer_id=answerId,
        page_no=pageNo,
        page_size=pageSize,
    )


@router.post("/replies")
async def create_reply(request: LearningReplyCreateRequest, user_id: int = Depends(get_current_user_id)) -> dict:
    return await LearningService().create_reply(request, user_id=user_id)


@router.post("/likes")
async def toggle_like(request: LearningLikeRequest, user_id: int = Depends(get_current_user_id)) -> dict:
    return await LearningService().toggle_like(request, user_id=user_id)


@router.get("/notes/page", response_model=LearningPageResponse)
async def list_notes(
    courseId: int | None = None,
    sectionId: int | None = None,
    onlyMine: bool = True,
    pageNo: int = 1,
    pageSize: int = 1000,
    user_id: int = Depends(get_current_user_id),
) -> LearningPageResponse:
    return await LearningService().list_notes(
        user_id=user_id,
        course_id=courseId,
        section_id=sectionId,
        only_mine=onlyMine,
        page_no=pageNo,
        page_size=pageSize,
    )


@router.post("/notes")
async def create_note(request: LearningNoteCreateRequest, user_id: int = Depends(get_current_user_id)) -> dict:
    return await LearningService().create_note(request, user_id=user_id)


@router.put("/notes/{note_id}")
async def update_note(note_id: int, request: LearningNoteUpdateRequest, user_id: int = Depends(get_current_user_id)) -> dict:
    return await LearningService().update_note(note_id, request, user_id=user_id)


@router.delete("/notes/{note_id}")
async def delete_note(note_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    return await LearningService().delete_note(note_id, user_id=user_id)


@router.post("/notes/gathers/{note_id}")
async def gather_note(note_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    return await LearningService().gather_note(note_id, True, user_id=user_id)


@router.delete("/notes/gathers/{note_id}")
async def ungather_note(note_id: int, user_id: int = Depends(get_current_user_id)) -> dict:
    return await LearningService().gather_note(note_id, False, user_id=user_id)


@router.post("/exams")
async def generate_exam(request: LearningExamGenerateRequest) -> dict:
    return await LearningService().generate_exam(request)


@router.post("/exams/details")
async def submit_exam(request: LearningExamSubmitRequest) -> list[dict]:
    return await LearningService().submit_exam(request)


@router.get("/personalized/next-step", response_model=PersonalizedNextStepResponse)
async def get_personalized_next_step(
    course_id: int,
    section_index: int = 0,
    user_id: int = Depends(get_current_user_id),
) -> PersonalizedNextStepResponse:
    return await LearningService().get_personalized_next_step(user_id=user_id, course_id=course_id, section_index=section_index)


@router.get("/personalized/goal-path", response_model=GoalPathResponse)
async def get_goal_path(course_id: int, user_id: int = Depends(get_current_user_id)) -> GoalPathResponse:
    return await LearningService().get_goal_path(user_id=user_id, course_id=course_id)


@router.get("/personalized/review-plan", response_model=ReviewPlanResponse)
async def get_review_plan(course_id: int, section_index: int = 0, user_id: int = Depends(get_current_user_id)) -> ReviewPlanResponse:
    return await LearningService().get_review_plan(user_id=user_id, course_id=course_id, section_index=section_index)


@router.get("/personalized/level-recommendation", response_model=LevelRecommendationResponse)
async def get_level_recommendation(course_id: int, user_id: int = Depends(get_current_user_id)) -> LevelRecommendationResponse:
    return await LearningService().get_level_recommendation(user_id=user_id, course_id=course_id)


@router.get("/personalized/growth-map", response_model=GrowthMapResponse)
async def get_growth_map(course_id: int, user_id: int = Depends(get_current_user_id)) -> GrowthMapResponse:
    return await LearningService().get_growth_map(course_id=course_id, user_id=user_id)


@router.post("/personalized/session-event", response_model=LearningSessionEventResponse)
async def post_session_event(request: LearningSessionEventRequest, user_id: int = Depends(get_current_user_id)) -> LearningSessionEventResponse:
    request.user_id = user_id
    return await LearningService().record_learning_session_event(request)
