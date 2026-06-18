import asyncio
import re
from pathlib import Path

from app.core.config import settings
from app.rag.retrieve.vector_store import MilvusVectorStore
from app.schemas.common import Citation, KnowledgeHit
from app.schemas.rag import RagSearchRequest, RagSearchResponse
from app.services.embedding_service import EmbeddingService


class RagService:
    def __init__(self) -> None:
        self.embedding_service = EmbeddingService()
        self._knowledge_root = Path(__file__).resolve().parents[2] / "knowledge_base"

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

        tokens = [token for token in re.split(r"[\s,;:/\-?？！。，、]+", compact) if len(token) >= 2]
        compact_token = compact.replace(" ", "")
        if len(compact_token) >= 2:
            tokens.append(compact_token)

        for match in re.findall(r"\d{2,}", compact):
            tokens.append(match)

        for match in re.findall(r"[a-z]{2,}", compact):
            tokens.append(match)

        cjk_compact = "".join(re.findall(r"[\u4e00-\u9fff]+", compact))
        if len(cjk_compact) >= 2:
            tokens.append(cjk_compact)
            for size in (2, 3, 4):
                if len(cjk_compact) < size:
                    continue
                for index in range(len(cjk_compact) - size + 1):
                    tokens.append(cjk_compact[index : index + size])

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

    @classmethod
    def _score_local_markdown(cls, query: str, title: str, content: str) -> float:
        title_normalized = cls._normalize_text(title)
        content_normalized = cls._normalize_text(content)
        query_normalized = cls._normalize_text(query)
        tokens = cls._query_tokens(query)

        score = 0.0
        if query_normalized and query_normalized in title_normalized:
            score += 1.6
        if query_normalized and query_normalized in content_normalized:
            score += 1.1

        for token in tokens:
            if token in title_normalized:
                score += 0.55
            elif token in content_normalized:
                score += 0.25

        title_hits = sum(1 for token in tokens if token in title_normalized)
        content_hits = sum(1 for token in tokens if token in content_normalized)
        if title_hits:
            score += min(title_hits, 6) * 0.18
        if content_hits:
            score += min(content_hits, 10) * 0.08

        if "bililearn" in title_normalized or "项目" in title_normalized or "使用文档" in title_normalized:
            score += 0.18

        return score

    @classmethod
    def _build_local_snippet(cls, content: str, query: str) -> str:
        compact_content = re.sub(r"\s+", " ", content).strip()
        if not compact_content:
            return ""

        lowered = compact_content.lower()
        for token in cls._query_tokens(query):
            index = lowered.find(token.lower())
            if index >= 0:
                start = max(0, index - 90)
                end = min(len(compact_content), index + 210)
                return compact_content[start:end]

        return compact_content[:220]

    def _search_local_markdown(self, course_code: str, query: str, top_k: int) -> list[dict]:
        course_dir = self._knowledge_root / course_code
        if not course_dir.exists():
            return []

        hits: list[dict] = []
        for index, path in enumerate(sorted(course_dir.glob("*.md")), start=1):
            try:
                content = path.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue

            title = path.stem.replace("_", " ").strip()
            score = self._score_local_markdown(query, title, content)
            if score <= 0:
                continue

            hits.append(
                {
                    "chunk_id": index,
                    "document_id": index,
                    "title": title,
                    "content": self._build_local_snippet(content, query),
                    "score": score,
                    "tags": [course_code, path.stem],
                    "chunk_kind": "local_markdown",
                    "priority": 1,
                }
            )

        hits.sort(key=lambda item: float(item.get("score", 0.0)), reverse=True)
        return hits[:top_k]

    async def search(self, request: RagSearchRequest) -> RagSearchResponse:
        hits: list[dict] = []

        if settings.rag_local_markdown_first:
            hits = self._search_local_markdown(
                request.course_code,
                request.query,
                request.top_k,
            )

        if not hits and settings.milvus_enabled:
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

        if not hits:
            hits = self._search_local_markdown(
                request.course_code,
                request.query,
                request.top_k,
            )

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
