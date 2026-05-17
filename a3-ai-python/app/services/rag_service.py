import asyncio
import re

from app.rag.retrieve.vector_store import MilvusVectorStore
from app.schemas.common import Citation, KnowledgeHit
from app.schemas.rag import RagSearchRequest, RagSearchResponse
from app.services.embedding_service import EmbeddingService


class RagService:
    def __init__(self) -> None:
        self.embedding_service = EmbeddingService()

    @staticmethod
    def _search_vector_store(course_code: str, vector: list[float], top_k: int) -> list[dict]:
        vector_store = MilvusVectorStore()
        return vector_store.search(course_code=course_code, vector=vector, top_k=top_k)

    @staticmethod
    def _normalize_text(value: str) -> str:
        return re.sub(r"\s+", "", str(value or "").lower())

    @staticmethod
    def _query_tokens(query: str) -> list[str]:
        compact = re.sub(r"\s+", " ", str(query or "").strip().lower())
        if not compact:
            return []

        tokens = [token for token in re.split(r"[\s,;:/\-]+", compact) if len(token) >= 2]
        compact_token = compact.replace(" ", "")
        if len(compact_token) >= 2:
            tokens.append(compact_token)

        deduped: list[str] = []
        for token in tokens:
            normalized = token.strip()
            if normalized and normalized not in deduped:
                deduped.append(normalized)
        return deduped

    @classmethod
    def _rerank_hits(cls, query: str, hits: list[dict]) -> list[dict]:
        query_tokens = cls._query_tokens(query)
        normalized_query = cls._normalize_text(query)
        ranked: list[dict] = []

        for index, hit in enumerate(hits):
            title = str(hit.get("title") or "")
            title_normalized = cls._normalize_text(title)
            tags = [cls._normalize_text(tag) for tag in hit.get("tags", [])]
            priority = int(hit.get("priority", 0) or 0)
            chunk_kind = str(hit.get("chunk_kind") or "")
            base_score = float(hit.get("score", 0.0))

            bonus = 0.0
            if normalized_query and normalized_query == title_normalized:
                bonus += 0.12
            elif normalized_query and normalized_query in title_normalized:
                bonus += 0.08

            overlap_count = sum(1 for token in query_tokens if token in title_normalized or any(token in tag for tag in tags))
            bonus += min(overlap_count, 4) * 0.02
            bonus += priority * 0.02
            if chunk_kind == "section_detail":
                bonus += 0.02

            reranked = dict(hit)
            reranked["score"] = base_score + bonus
            reranked["_order"] = index
            ranked.append(reranked)

        ranked.sort(key=lambda item: (float(item.get("score", 0.0)), -int(item.get("_order", 0))), reverse=True)
        for item in ranked:
            item.pop("_order", None)
        return ranked

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
            hits = []

        hits = self._rerank_hits(request.query, hits)
        return RagSearchResponse(
            query=request.query,
            course_code=request.course_code,
            hits=[
                KnowledgeHit(
                    chunk_id=int(hit["chunk_id"]),
                    document_id=hit.get("document_id"),
                    title=hit.get("title") or "untitled chunk",
                    content=hit.get("content") or "",
                    score=float(hit.get("score", 0.0)),
                )
                for hit in hits
            ],
            citations=[
                Citation(
                    source=hit.get("title") or "untitled chunk",
                    chunk_id=int(hit["chunk_id"]),
                    score=float(hit.get("score", 0.0)),
                )
                for hit in hits
            ],
        )
