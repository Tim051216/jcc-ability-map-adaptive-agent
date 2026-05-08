from fastapi import APIRouter, HTTPException

from app.schemas.evaluation import EvaluationRequest, EvaluationResponse
from app.services.evaluation_service import EvaluationService

router = APIRouter()


@router.post("", response_model=EvaluationResponse)
async def evaluate(request: EvaluationRequest) -> EvaluationResponse:
    service = EvaluationService()
    return await service.evaluate(request)


@router.get("/latest", response_model=EvaluationResponse)
async def get_latest_evaluation(user_id: int, course_code: str) -> EvaluationResponse:
    service = EvaluationService()
    evaluation = await service.get_latest_evaluation(user_id=user_id, course_code=course_code)
    if evaluation is None:
        raise HTTPException(status_code=404, detail="evaluation not found")
    return evaluation
