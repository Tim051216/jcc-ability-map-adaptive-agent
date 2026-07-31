from fastapi import APIRouter, HTTPException

from app.schemas.rag import RagSearchRequest, RagSearchResponse
from app.schemas.rag_evaluation import (
    RagEvalCompareRequest,
    RagEvalCompareResponse,
    RagEvalCorrectionRequest,
    RagEvalCorrectionResponse,
    RagEvalRunListResponse,
    RagEvalRunRequest,
    RagEvalRunResponse,
)
from app.services.rag_evaluation_service import RagEvaluationService
from app.services.rag_service import RagService

router = APIRouter()


@router.post("/search", response_model=RagSearchResponse)
async def search(request: RagSearchRequest) -> RagSearchResponse:
    service = RagService()
    return await service.search(request)


@router.post("/eval/run", response_model=RagEvalRunResponse)
async def run_eval(request: RagEvalRunRequest) -> RagEvalRunResponse:
    service = RagEvaluationService()
    return await service.run(request)


@router.get("/eval/runs", response_model=RagEvalRunListResponse)
async def list_eval_runs(limit: int = 20) -> RagEvalRunListResponse:
    service = RagEvaluationService()
    return service.list_runs(limit=limit)


@router.get("/eval/runs/{run_id}", response_model=RagEvalRunResponse)
async def get_eval_run(run_id: int) -> RagEvalRunResponse:
    service = RagEvaluationService()
    run = service.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="evaluation run not found")
    return run


@router.post("/eval/compare", response_model=RagEvalCompareResponse)
async def compare_eval_runs(request: RagEvalCompareRequest) -> RagEvalCompareResponse:
    service = RagEvaluationService()
    try:
        return await service.compare(request)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/eval/corrections", response_model=RagEvalCorrectionResponse)
async def apply_eval_correction(request: RagEvalCorrectionRequest) -> RagEvalCorrectionResponse:
    service = RagEvaluationService()
    try:
        return await service.apply_correction(request)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/eval/dataset/default")
async def get_default_eval_dataset() -> dict:
    service = RagEvaluationService()
    return {"items": service.export_default_dataset()}
