import asyncio

from app.rag.retrieve.vector_store import MilvusVectorStore
from app.schemas.common import Citation, KnowledgeHit
from app.schemas.rag import RagSearchRequest, RagSearchResponse
from app.services.embedding_service import EmbeddingService


class RagService:
    def __init__(self) -> None:
        self.embedding_service = EmbeddingService()

    @staticmethod
    def _search_vector_store(course_code: str, vector: list[float], top_k: int) -> list[dict]:
        # Milvus 客户端初始化和检索都是同步行为，统一放到线程里执行，
        # 避免在本地环境依赖不稳定时卡住整个事件循环。
        vector_store = MilvusVectorStore()
        return vector_store.search(course_code=course_code, vector=vector, top_k=top_k)

    async def search(self, request: RagSearchRequest) -> RagSearchResponse:
        query_vector = await self.embedding_service.embed_text(request.query)
        try:
            hits = await asyncio.wait_for(
                asyncio.to_thread(
                    self._search_vector_store,
                    request.course_code,
                    query_vector,
                    request.top_k,
                ),
                timeout=6,
            )
        except Exception:
            # 检索异常时直接降级为空结果，保证问答与任务轮询链路仍可继续演示。
            hits = []
        return RagSearchResponse(
            query=request.query,
            course_code=request.course_code,
            hits=[
                KnowledgeHit(
                    chunk_id=int(hit["chunk_id"]),
                    document_id=hit.get("document_id"),
                    title=hit.get("title") or "未命名片段",
                    content=hit.get("content") or "",
                    score=float(hit.get("score", 0.0)),
                )
                for hit in hits
            ],
            citations=[
                Citation(
                    source=hit.get("title") or "未命名片段",
                    chunk_id=int(hit["chunk_id"]),
                    score=float(hit.get("score", 0.0)),
                )
                for hit in hits
            ],
        )
