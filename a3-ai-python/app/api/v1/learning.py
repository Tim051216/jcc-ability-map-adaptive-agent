from fastapi import APIRouter

from app.schemas.learning import (
    LearningExamGenerateRequest,
    LearningExamSubmitRequest,
    LearningLikeRequest,
    LearningNoteCreateRequest,
    LearningNoteUpdateRequest,
    LearningPageResponse,
    LearningQuestionCreateRequest,
    LearningQuestionUpdateRequest,
    LearningReplyCreateRequest,
)
from app.services.learning_service import LearningService

router = APIRouter()


@router.get("/questions/page", response_model=LearningPageResponse)
async def list_questions(
    courseId: int | None = None,
    sectionId: int | None = None,
    onlyMine: bool = False,
    pageNo: int = 1,
    pageSize: int = 10,
) -> LearningPageResponse:
    service = LearningService()
    return await service.list_questions(
        course_id=courseId,
        section_id=sectionId,
        only_mine=onlyMine,
        page_no=pageNo,
        page_size=pageSize,
    )


@router.post("/questions")
async def create_question(request: LearningQuestionCreateRequest) -> dict:
    return await LearningService().create_question(request)


@router.get("/questions/{question_id}")
async def get_question(question_id: int) -> dict:
    return await LearningService().get_question(question_id)


@router.put("/questions/{question_id}")
async def update_question(question_id: int, request: LearningQuestionUpdateRequest) -> dict:
    return await LearningService().update_question(question_id, request)


@router.delete("/questions/{question_id}")
async def delete_question(question_id: int) -> dict:
    return await LearningService().delete_question(question_id)


@router.get("/replies/page", response_model=LearningPageResponse)
async def list_replies(questionId: int | None = None, answerId: int | None = None, pageNo: int = 1, pageSize: int = 10) -> LearningPageResponse:
    return await LearningService().list_replies(
        question_id=questionId,
        answer_id=answerId,
        page_no=pageNo,
        page_size=pageSize,
    )


@router.post("/replies")
async def create_reply(request: LearningReplyCreateRequest) -> dict:
    return await LearningService().create_reply(request)


@router.post("/likes")
async def toggle_like(request: LearningLikeRequest) -> dict:
    return await LearningService().toggle_like(request)


@router.get("/notes/page", response_model=LearningPageResponse)
async def list_notes(
    courseId: int | None = None,
    sectionId: int | None = None,
    onlyMine: bool = True,
    pageNo: int = 1,
    pageSize: int = 1000,
) -> LearningPageResponse:
    return await LearningService().list_notes(
        course_id=courseId,
        section_id=sectionId,
        only_mine=onlyMine,
        page_no=pageNo,
        page_size=pageSize,
    )


@router.post("/notes")
async def create_note(request: LearningNoteCreateRequest) -> dict:
    return await LearningService().create_note(request)


@router.put("/notes/{note_id}")
async def update_note(note_id: int, request: LearningNoteUpdateRequest) -> dict:
    return await LearningService().update_note(note_id, request)


@router.delete("/notes/{note_id}")
async def delete_note(note_id: int) -> dict:
    return await LearningService().delete_note(note_id)


@router.post("/notes/gathers/{note_id}")
async def gather_note(note_id: int) -> dict:
    return await LearningService().gather_note(note_id, True)


@router.delete("/notes/gathers/{note_id}")
async def ungather_note(note_id: int) -> dict:
    return await LearningService().gather_note(note_id, False)


@router.post("/exams")
async def generate_exam(request: LearningExamGenerateRequest) -> dict:
    return await LearningService().generate_exam(request)


@router.post("/exams/details")
async def submit_exam(request: LearningExamSubmitRequest) -> list[dict]:
    return await LearningService().submit_exam(request)
