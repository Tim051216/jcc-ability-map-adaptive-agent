from fastapi import APIRouter, HTTPException

from app.schemas.evaluation import (
    AnswerGradingRequest,
    AnswerGradingResponse,
    AssessmentRequest,
    AssessmentResponse,
    EvaluationExportResponse,
    EvaluationHistoryResponse,
    EvaluationPaperGenerateRequest,
    EvaluationPaperResponse,
    EvaluationPaperSummaryResponse,
    EvaluationPaperSubmitRequest,
    EvaluationRequest,
    EvaluationResponse,
    EvaluationTrendResponse,
    QuestionGenerateRequest,
    QuestionGenerateResponse,
    ReportGenerateRequest,
    ReportGenerateResponse,
    WrongQuestionListResponse,
    WrongQuestionSummaryResponse,
)
from app.services.course_context_service import CourseContextService
from app.services.evaluation_agent_service import EvaluationAgentService
from app.services.evaluation_export_service import EvaluationExportService
from app.services.evaluation_history_service import EvaluationHistoryService
from app.services.evaluation_paper_summary_service import EvaluationPaperSummaryService
from app.services.evaluation_service import EvaluationService
from app.services.wrong_question_summary_service import WrongQuestionSummaryService

router = APIRouter()


@router.post("", response_model=EvaluationResponse)
async def evaluate(request: EvaluationRequest) -> EvaluationResponse:
    service = EvaluationService()
    return await service.evaluate(request)


@router.post("/papers/generate", response_model=EvaluationPaperResponse)
async def generate_paper(request: EvaluationPaperGenerateRequest) -> EvaluationPaperResponse:
    service = EvaluationService()
    return await service.generate_paper(request)


@router.get("/papers/summary", response_model=EvaluationPaperSummaryResponse)
async def get_paper_summary(
    user_id: int,
    course_code: str | None = None,
    limit: int = 10,
) -> EvaluationPaperSummaryResponse:
    service = EvaluationPaperSummaryService()
    return await service.get_summary(user_id=user_id, course_code=course_code, limit=limit)


@router.get("/papers/{paper_id}", response_model=EvaluationPaperResponse)
async def get_paper(paper_id: int) -> EvaluationPaperResponse:
    service = EvaluationService()
    paper = await service.get_paper(paper_id)
    if paper is None:
        raise HTTPException(status_code=404, detail="evaluation paper not found")
    return paper


@router.post("/papers/{paper_id}/submit", response_model=EvaluationResponse)
async def submit_paper(
    paper_id: int,
    request: EvaluationPaperSubmitRequest,
) -> EvaluationResponse:
    service = EvaluationService()
    return await service.submit_paper(paper_id=paper_id, request=request)


@router.get("/results/{record_id}", response_model=EvaluationResponse)
async def get_result(record_id: int) -> EvaluationResponse:
    service = EvaluationService()
    result = await service.get_result(record_id)
    if result is None:
        raise HTTPException(status_code=404, detail="evaluation result not found")
    return result


@router.get("/results/{record_id}/export", response_model=EvaluationExportResponse)
async def export_result(record_id: int, format: str = "markdown") -> EvaluationExportResponse:
    service = EvaluationExportService()
    result = await service.export_result(record_id, export_format=format)
    if result is None:
        raise HTTPException(status_code=404, detail="evaluation result not found")
    return result


@router.get("/results/{record_id}/wrong-questions", response_model=WrongQuestionListResponse)
async def get_wrong_questions(record_id: int) -> WrongQuestionListResponse:
    service = EvaluationService()
    return await service.get_wrong_questions(record_id)


@router.get("/results/{record_id}/wrong-questions/summary", response_model=WrongQuestionSummaryResponse)
async def get_wrong_question_summary(record_id: int) -> WrongQuestionSummaryResponse:
    service = WrongQuestionSummaryService()
    return await service.get_summary(record_id)


@router.get("/latest", response_model=EvaluationResponse)
async def get_latest_evaluation(
    user_id: int,
    course_id: int | None = None,
    course_code: str | None = None,
) -> EvaluationResponse:
    service = EvaluationService()
    course_context = await CourseContextService().resolve(course_id=course_id, course_code=course_code)
    evaluation = await service.get_latest_evaluation(user_id=user_id, course_code=course_context.course_code)
    if evaluation is None:
        raise HTTPException(status_code=404, detail="evaluation not found")
    return evaluation


@router.get("/history", response_model=EvaluationHistoryResponse)
async def get_evaluation_history(
    user_id: int,
    course_id: int | None = None,
    course_code: str | None = None,
    evaluation_type: str | None = None,
    limit: int = 10,
) -> EvaluationHistoryResponse:
    service = EvaluationHistoryService()
    return await service.list_history(
        user_id=user_id,
        course_id=course_id,
        course_code=course_code,
        evaluation_type=evaluation_type,
        limit=limit,
    )


@router.get("/trend", response_model=EvaluationTrendResponse)
async def get_evaluation_trend(
    user_id: int,
    course_id: int | None = None,
    course_code: str | None = None,
    evaluation_type: str | None = None,
    limit: int = 10,
) -> EvaluationTrendResponse:
    service = EvaluationHistoryService()
    return await service.get_trend(
        user_id=user_id,
        course_id=course_id,
        course_code=course_code,
        evaluation_type=evaluation_type,
        limit=limit,
    )


# ==================== 新增智能体评估接口 ====================


@router.post("/questions/generate", response_model=QuestionGenerateResponse)
async def generate_questions(request: QuestionGenerateRequest) -> QuestionGenerateResponse:
    """AI 生成题目"""
    service = EvaluationAgentService()
    return await service.generate_questions(request)


@router.post("/answers/grade", response_model=AnswerGradingResponse)
async def grade_answers(request: AnswerGradingRequest) -> AnswerGradingResponse:
    """自动批改答案"""
    service = EvaluationAgentService()
    return await service.grade_answers(request)


@router.post("/assessment", response_model=AssessmentResponse)
async def assess_learning_effectiveness(request: AssessmentRequest) -> AssessmentResponse:
    """评估学习效果"""
    service = EvaluationAgentService()
    return await service.assess_learning_effectiveness(request)


@router.post("/reports/generate", response_model=ReportGenerateResponse)
async def generate_report(request: ReportGenerateRequest) -> ReportGenerateResponse:
    """生成评估报告"""
    service = EvaluationAgentService()
    return await service.generate_report(request)
