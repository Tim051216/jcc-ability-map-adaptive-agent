from fastapi import APIRouter
import httpx

from app.integrations.llm.base import LLMMessage
from app.integrations.llm.provider_factory import get_llm_provider
from app.rag.ingest.pipelines import KnowledgeIngestPipeline
from app.services.admin_service import AdminService
from app.services.embedding_service import EmbeddingService

router = APIRouter()


@router.get("/ping")
async def ping() -> dict[str, str]:
    return {"message": "admin ok"}


@router.get("/overview")
async def overview() -> dict:
    return await AdminService().get_overview()


@router.post("/knowledge/{course_code}/ingest")
async def ingest_knowledge(course_code: str) -> dict:
    pipeline = KnowledgeIngestPipeline()
    return await pipeline.run(course_code)


@router.get("/llm/ping")
async def ping_llm() -> dict:
    try:
        provider = get_llm_provider()
        text = await provider.generate(
            [
                LLMMessage(role="system", content="你是一个简短的系统连通性测试助手。"),
                LLMMessage(role="user", content="请只回复：ok"),
            ]
        )
        return {"status": "ok", "message": text}
    except (httpx.HTTPError, ValueError, KeyError, IndexError) as exc:
        return {"status": "unavailable", "message": str(exc)}


@router.get("/embedding/ping")
async def ping_embedding() -> dict:
    return await EmbeddingService().ping()
