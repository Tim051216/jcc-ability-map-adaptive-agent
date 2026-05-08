from app.rag.retrieve.vector_store import MilvusVectorStore
from app.schemas.common import Citation, KnowledgeHit
from app.schemas.rag import RagSearchRequest, RagSearchResponse
from app.services.embedding_service import EmbeddingService


class RagService:
    def __init__(self) -> None:
        self.embedding_service = EmbeddingService()
        self.vector_store = MilvusVectorStore()

    async def search(self, request: RagSearchRequest) -> RagSearchResponse:
        query_vector = await self.embedding_service.embed_text(request.query)
        hits = self.vector_store.search(
            course_code=request.course_code,
            vector=query_vector,
            top_k=request.top_k,
        )
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
