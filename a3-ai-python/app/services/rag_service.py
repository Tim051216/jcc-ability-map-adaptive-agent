import asyncio
import hashlib
import json
import math
import re
import socket
import time
from collections import Counter
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.rag.retrieve.vector_store import MilvusVectorStore
from app.schemas.common import Citation, KnowledgeHit
from app.schemas.rag import RagSearchRequest, RagSearchResponse
from app.services.embedding_service import EmbeddingService


class RagService:
    _local_vector_indexes: dict[str, list[tuple[dict[str, Any], list[float]]]] = {}
    _local_vector_build_tasks: dict[
        str, asyncio.Task[list[tuple[dict[str, Any], list[float]]]]
    ] = {}
    _local_tfidf_indexes: dict[
        str, tuple[list[tuple[dict[str, Any], Counter[str]]], dict[str, float]]
    ] = {}
    _query_vector_cache: dict[str, list[float]] = {}
    _milvus_unavailable_until: float = 0.0
    _embedding_unavailable_until: float = 0.0

    def __init__(self) -> None:
        self.embedding_service = EmbeddingService()
        self._knowledge_root = Path(__file__).resolve().parents[2] / "knowledge_base"

    _INTENT_ROUTES: tuple[tuple[str, tuple[str, ...], tuple[str, ...]], ...] = (
        (
            "system_usage",
            (
                "系统",
                "页面",
                "登录",
                "启动",
                "部署",
                "端口",
                "知识库",
                "入库",
                "怎么用",
                "如何使用",
            ),
            ("section_19", "section_20", "section_21", "section_22", "section_23", "section_24"),
        ),
        (
            "assessment",
            ("考核", "试卷", "复习题", "习题", "答案", "评分", "评价", "毕业要求"),
            ("section_06", "section_09", "section_10", "section_18"),
        ),
        (
            "practice",
            ("实验", "课设", "建模", "工具", "报告", "项目", "实践"),
            ("section_07", "section_08", "section_17"),
        ),
        (
            "course_structure",
            ("章节", "教学进度", "教学方法", "课程画像", "适合谁", "专业", "知识图谱"),
            ("section_13", "section_14", "section_15", "section_16"),
        ),
        (
            "resource",
            ("视频", "资源", "手机应用", "ppt", "课件", "案例"),
            ("section_02", "section_03", "section_04", "section_05", "section_11"),
        ),
    )

    _SECTION_HINTS: tuple[tuple[str, tuple[str, ...]], ...] = (
        ("section_25", ("可行性分析", "技术可行性", "经济可行性", "操作可行性", "法律可行性")),
        ("section_26", ("概要设计", "总体结构", "模块划分", "接口关系")),
        ("section_27", ("详细设计", "内部算法", "数据结构", "处理流程")),
        ("section_28", ("软件测试", "测试目标", "发现缺陷", "评估软件质量")),
        ("section_29", ("适应性维护", "维护活动", "环境变化")),
        ("section_20", ("本地服务", "本地启动", "启动 BiliLearn")),
        ("section_21", ("学生端课堂", "课堂页面", "学生端页面")),
        ("section_22", ("管理端知识库", "知识库入库", "管理端")),
        ("section_23", ("端口冲突", "故障排查", "冲突怎么办")),
        ("section_24", ("使用文档索引", "文档索引")),
        ("section_13", ("哪些专业", "专业学生", "课程面向")),
        ("section_14", ("教学进度", "进度安排")),
        ("section_15", ("哪些章节", "课程章节", "章节")),
        ("section_16", ("教学方法", "采用什么教学")),
        ("section_17", ("实验和建模工具", "建模工具", "实验工具")),
        ("section_18", ("如何考核", "课程考核")),
        ("section_02", ("手机应用开发", "手机应用")),
        ("section_03", ("视频扩展资源", "视频资源")),
        ("section_07", ("实验报告样例", "报告样例")),
        ("section_09", ("复习题答案", "复习答案")),
    )

    @staticmethod
    def _search_vector_store(course_code: str, vector: list[float], top_k: int) -> list[dict]:
        vector_store = MilvusVectorStore()
        return vector_store.search(course_code=course_code, vector=vector, top_k=top_k)

    @staticmethod
    def _milvus_reachable() -> bool:
        try:
            with socket.create_connection(
                (settings.milvus_host, settings.milvus_port), timeout=0.2
            ):
                return True
        except OSError:
            return False

    @staticmethod
    def _normalize_text(value: str) -> str:
        return re.sub(r"\s+", "", str(value or "").lower())

    @staticmethod
    def _repair_mojibake(value: str) -> str:
        text = str(value or "")
        if "?" not in text:
            return text
        candidates = [text]
        for source_encoding in ("latin1", "cp1252"):
            try:
                candidates.append(text.encode(source_encoding).decode("utf-8"))
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass
            try:
                candidates.append(text.encode(source_encoding).decode("gb18030"))
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass
        return max(
            candidates,
            key=lambda item: (item.count("?") * -10, len(re.findall(r"[\u4e00-\u9fff]", item))),
        )

    @staticmethod
    def _decode_document_text(raw: bytes) -> str:
        for encoding in ("utf-8", "utf-8-sig", "gb18030", "gbk"):
            try:
                return raw.decode(encoding)
            except UnicodeDecodeError:
                continue
        return raw.decode("utf-8", errors="ignore")

    @staticmethod
    def _normalize_knowledge_text(value: str) -> str:
        text = str(value or "")
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    @classmethod
    def _is_allowed_document(cls, course_code: str, path: Path, content: str) -> bool:
        normalized_stem = path.stem.lower()
        normalized_content = cls._normalize_text(content)
        if course_code == "software_engineering_4th":
            blocked_prefixes = (
                "section_19",
                "section_20",
                "section_21",
                "section_22",
                "section_23",
                "section_24",
            )
            if normalized_stem.startswith(blocked_prefixes):
                return False
            if "bililearn" in normalized_content:
                return False
        return True

    @classmethod
    def _is_bililearn_document(cls, hit: dict[str, Any]) -> bool:
        source_name = cls._normalize_text(str(hit.get("source_name") or ""))
        title = cls._normalize_text(str(hit.get("title") or ""))
        if source_name.startswith(
            (
                "section_19",
                "section_20",
                "section_21",
                "section_22",
                "section_23",
                "section_24",
            )
        ):
            return True
        return "bililearn" in source_name or "bililearn" in title

    @classmethod
    def _is_bililearn_markdown(cls, path: Path, content: str) -> bool:
        stem = path.stem.lower()
        if stem.startswith(
            (
                "section_19",
                "section_20",
                "section_21",
                "section_22",
                "section_23",
                "section_24",
            )
        ):
            return True
        return "bililearn" in stem or "bililearn" in cls._normalize_text(content)

    @classmethod
    def _detect_intent(cls, query: str) -> tuple[str, tuple[str, ...], list[str]]:
        normalized = cls._normalize_text(query)
        best_name = "general"
        best_sections: tuple[str, ...] = ()
        matched_terms: list[str] = []
        best_score = 0
        for name, keywords, sections in cls._INTENT_ROUTES:
            matches = [
                keyword for keyword in keywords if cls._normalize_text(keyword) in normalized
            ]
            if len(matches) > best_score:
                best_name = name
                best_sections = sections
                matched_terms = matches
                best_score = len(matches)
        return best_name, best_sections, matched_terms

    @classmethod
    def _build_intent_query(cls, query: str) -> tuple[str, str, tuple[str, ...]]:
        intent, sections, matched_terms = cls._detect_intent(query)
        expanded_terms = " ".join(matched_terms[:4])
        directed_query = f"{query} {expanded_terms}".strip() if expanded_terms else query
        return intent, directed_query, sections

    @classmethod
    def _matched_section_hint(cls, query: str) -> str | None:
        normalized_query = cls._normalize_text(query)
        for section, hints in cls._SECTION_HINTS:
            if any(cls._normalize_text(hint) in normalized_query for hint in hints):
                return section
        return None

    @staticmethod
    def _cosine_similarity(left: list[float], right: list[float]) -> float:
        if not left or not right or len(left) != len(right):
            return 0.0
        dot = sum(a * b for a, b in zip(left, right, strict=True))
        left_norm = math.sqrt(sum(value * value for value in left)) or 1.0
        right_norm = math.sqrt(sum(value * value for value in right)) or 1.0
        return dot / (left_norm * right_norm)

    @classmethod
    def _vector_terms(cls, value: str) -> list[str]:
        normalized = cls._normalize_text(value)
        terms = re.findall(r"[a-z0-9]{2,}", normalized)
        cjk = "".join(re.findall(r"[\u4e00-\u9fff]+", normalized))
        for size in (2, 3, 4):
            terms.extend(cjk[index : index + size] for index in range(max(0, len(cjk) - size + 1)))
        return terms

    def _get_local_tfidf_index(
        self, course_code: str
    ) -> tuple[list[tuple[dict[str, Any], Counter[str]]], dict[str, float]]:
        cached = self._local_tfidf_indexes.get(course_code)
        if cached is not None:
            return cached
        documents = self._load_local_documents(course_code)
        indexed: list[tuple[dict[str, Any], Counter[str]]] = []
        document_frequency: Counter[str] = Counter()
        for document in documents:
            counts = Counter(self._vector_terms(f"{document['title']} {document['content']}"))
            indexed.append((document, counts))
            document_frequency.update(counts.keys())
        count = max(len(documents), 1)
        idf = {
            term: math.log((count + 1) / (frequency + 1)) + 1.0
            for term, frequency in document_frequency.items()
        }
        cached = (indexed, idf)
        self._local_tfidf_indexes[course_code] = cached
        return cached

    def _search_local_tfidf(self, course_code: str, query: str, top_k: int) -> list[dict[str, Any]]:
        indexed, idf = self._get_local_tfidf_index(course_code)
        query_counts = Counter(self._vector_terms(query))
        query_vector = {term: count * idf.get(term, 1.0) for term, count in query_counts.items()}
        query_norm = math.sqrt(sum(value * value for value in query_vector.values())) or 1.0
        scored: list[dict[str, Any]] = []
        for document, counts in indexed:
            document_vector = {term: count * idf.get(term, 1.0) for term, count in counts.items()}
            document_norm = (
                math.sqrt(sum(value * value for value in document_vector.values())) or 1.0
            )
            dot = sum(
                value * document_vector.get(term, 0.0) for term, value in query_vector.items()
            )
            hit = dict(document)
            hit["content"] = self._build_local_snippet(str(document.get("content") or ""), query)
            hit["score"] = dot / (query_norm * document_norm)
            hit["_route"] = "global_vector_tfidf"
            scored.append(hit)
        scored.sort(key=lambda item: float(item.get("score", 0.0)), reverse=True)
        return scored[:top_k]

    def _load_local_documents(self, course_code: str) -> list[dict[str, Any]]:
        course_dir = self._knowledge_root / course_code
        if not course_dir.exists():
            return []
        documents: list[dict[str, Any]] = []
        for index, path in enumerate(sorted(course_dir.glob("*.md")), start=1):
            try:
                raw = path.read_bytes()
            except OSError:
                continue
            content = self._decode_document_text(raw)
            content = self._repair_mojibake(content)
            content = self._normalize_knowledge_text(content)
            if not self._is_allowed_document(course_code, path, content):
                continue
            title = path.stem.replace("_", " ").strip()
            documents.append(
                {
                    "chunk_id": index,
                    "document_id": index,
                    "title": title,
                    "content": content,
                    "source_name": path.stem,
                    "tags": [course_code, path.stem],
                    "chunk_kind": "local_markdown",
                    "priority": 1,
                    "_fingerprint": hashlib.sha256(content.encode("utf-8")).hexdigest(),
                }
            )
        return documents

    def _vector_cache_path(self, course_code: str) -> Path:
        model = re.sub(r"[^a-zA-Z0-9_.-]+", "_", settings.embedding_model)
        cache_dir = self._knowledge_root.parent / "local_data" / "rag_vector_cache"
        return cache_dir / f"v3_{course_code}_{model}_{settings.milvus_dimension}.json"

    def _load_persisted_vector_index(
        self, course_code: str, documents: list[dict[str, Any]]
    ) -> list[tuple[dict[str, Any], list[float]]] | None:
        path = self._vector_cache_path(course_code)
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        if payload.get("model") != settings.embedding_model:
            return None
        if payload.get("dimension") != settings.milvus_dimension:
            return None
        cached_documents = {item.get("source_name"): item for item in payload.get("documents", [])}
        index: list[tuple[dict[str, Any], list[float]]] = []
        for document in documents:
            cached = cached_documents.get(document["source_name"])
            vector = cached.get("vector") if cached else None
            if cached is None or cached.get("fingerprint") != document["_fingerprint"]:
                return None
            if not isinstance(vector, list) or len(vector) != settings.milvus_dimension:
                return None
            index.append((document, [float(value) for value in vector]))
        return index

    def _save_persisted_vector_index(
        self, course_code: str, index: list[tuple[dict[str, Any], list[float]]]
    ) -> None:
        path = self._vector_cache_path(course_code)
        payload = {
            "model": settings.embedding_model,
            "dimension": settings.milvus_dimension,
            "documents": [
                {
                    "source_name": document["source_name"],
                    "fingerprint": document["_fingerprint"],
                    "vector": vector,
                }
                for document, vector in index
            ],
        }
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix(".tmp")
            temporary.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            temporary.replace(path)
        except OSError:
            return

    async def _get_local_vector_index(
        self, course_code: str
    ) -> list[tuple[dict[str, Any], list[float]]]:
        cached = self._local_vector_indexes.get(course_code)
        if cached is not None:
            return cached

        documents = self._load_local_documents(course_code)
        persisted = self._load_persisted_vector_index(course_code, documents)
        if persisted is not None:
            self._local_vector_indexes[course_code] = persisted
            return persisted
        semaphore = asyncio.Semaphore(6)

        async def embed_document(document: dict[str, Any]) -> tuple[dict[str, Any], list[float]]:
            async with semaphore:
                text = f"{document['title']}\n{document['content'][:3500]}"
                vector = await self.embedding_service.embed_text_strict(text)
                return document, vector

        try:
            index = list(
                await asyncio.gather(*(embed_document(document) for document in documents))
            )
        except Exception:
            return []
        self._local_vector_indexes[course_code] = index
        self._save_persisted_vector_index(course_code, index)
        return index

    async def _search_local_vector(
        self,
        course_code: str,
        query: str,
        query_vector: list[float],
        top_k: int,
    ) -> list[dict[str, Any]]:
        build_task = self._local_vector_build_tasks.get(course_code)
        if build_task is None:
            build_task = asyncio.create_task(self._get_local_vector_index(course_code))
            self._local_vector_build_tasks[course_code] = build_task

            def finish_build(completed: asyncio.Task) -> None:
                self._local_vector_build_tasks.pop(course_code, None)
                if not completed.cancelled():
                    completed.exception()

            build_task.add_done_callback(finish_build)
        try:
            index = await asyncio.wait_for(asyncio.shield(build_task), timeout=0.8)
        except asyncio.TimeoutError:
            return []
        finally:
            if build_task.done():
                self._local_vector_build_tasks.pop(course_code, None)
        scored: list[dict[str, Any]] = []
        for document, vector in index:
            hit = dict(document)
            hit["content"] = self._build_local_snippet(str(document.get("content") or ""), query)
            hit["score"] = self._cosine_similarity(query_vector, vector)
            hit["_route"] = "global_vector_local"
            scored.append(hit)
        scored.sort(key=lambda item: float(item.get("score", 0.0)), reverse=True)
        return scored[:top_k]

    async def _search_global_vector(
        self, course_code: str, query: str, top_k: int, allow_bililearn: bool = False
    ) -> list[dict[str, Any]]:
        cache_key = f"{course_code}:{self._normalize_text(query)}"
        query_vector = self._query_vector_cache.get(cache_key)
        if query_vector is None and time.monotonic() >= self._embedding_unavailable_until:
            try:
                query_vector = await self.embedding_service.embed_text_strict(query)
            except Exception:
                type(self)._embedding_unavailable_until = time.monotonic() + 60.0
                return self._search_local_tfidf(course_code, query, top_k)
            if len(self._query_vector_cache) >= 256:
                self._query_vector_cache.pop(next(iter(self._query_vector_cache)))
            self._query_vector_cache[cache_key] = query_vector
        if query_vector is None:
            return self._search_local_tfidf(course_code, query, top_k)

        if settings.milvus_enabled and time.monotonic() >= self._milvus_unavailable_until:
            if not self._milvus_reachable():
                type(self)._milvus_unavailable_until = time.monotonic() + 60.0
                local_hits = await self._search_local_vector(
                    course_code, query, query_vector, top_k
                )
                return local_hits or self._search_local_tfidf(course_code, query, top_k)
            try:
                hits = await asyncio.wait_for(
                    asyncio.to_thread(self._search_vector_store, course_code, query_vector, top_k),
                    timeout=2.5,
                )
                if hits:
                    filtered_hits = [
                        {**hit, "_route": "global_vector_milvus"}
                        for hit in hits
                        if allow_bililearn or not self._is_bililearn_document(hit)
                    ]
                    if filtered_hits:
                        return filtered_hits
            except Exception:
                type(self)._milvus_unavailable_until = time.monotonic() + 60.0
        local_hits = await self._search_local_vector(course_code, query, query_vector, top_k)
        return local_hits or self._search_local_tfidf(course_code, query, top_k)

    @staticmethod
    def _query_tokens(query: str) -> list[str]:
        compact = re.sub(r"\s+", " ", str(query or "").strip().lower())
        if not compact:
            return []

        tokens = [
            token for token in re.split(r"[\s,;:/\-?？！。，、]+", compact) if len(token) >= 2
        ]
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

            overlap_count = sum(
                1
                for token in query_tokens
                if token in title_normalized or any(token in tag for tag in tags)
            )
            bonus += min(overlap_count, 4) * 0.02
            bonus += priority * 0.02
            if chunk_kind == "section_detail":
                bonus += 0.02

            reranked = dict(hit)
            reranked["score"] = base_score + bonus
            reranked["_order"] = index
            ranked.append(reranked)

        ranked.sort(
            key=lambda item: (float(item.get("score", 0.0)), -int(item.get("_order", 0))),
            reverse=True,
        )
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

        if (
            "bililearn" in title_normalized
            or "项目" in title_normalized
            or "使用文档" in title_normalized
        ):
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

    def _search_local_markdown(
        self,
        course_code: str,
        query: str,
        top_k: int,
        preferred_sections: tuple[str, ...] = (),
        use_section_hints: bool = True,
        allow_bililearn: bool = False,
    ) -> list[dict]:
        course_dir = self._knowledge_root / course_code
        if not course_dir.exists():
            return []

        hits: list[dict] = []
        for index, path in enumerate(sorted(course_dir.glob("*.md")), start=1):
            try:
                raw = path.read_bytes()
            except OSError:
                continue
            content = self._decode_document_text(raw)
            content = self._repair_mojibake(content)
            content = self._normalize_knowledge_text(content)
            if not self._is_allowed_document(course_code, path, content):
                if not (allow_bililearn and self._is_bililearn_markdown(path, content)):
                    continue

            title = path.stem.replace("_", " ").strip()
            score = self._score_local_markdown(query, title, content)
            if preferred_sections and any(
                path.stem.startswith(section) for section in preferred_sections
            ):
                score += 1.35
            matched_section = self._matched_section_hint(query) if use_section_hints else None
            if matched_section and path.stem.startswith(matched_section):
                score += 2.2
            if score <= 0:
                continue

            hits.append(
                {
                    "chunk_id": index,
                    "document_id": index,
                    "title": title,
                    "content": self._build_local_snippet(content, query),
                    "score": score,
                    "source_name": path.stem,
                    "tags": [course_code, path.stem],
                    "chunk_kind": "local_markdown",
                    "priority": 1,
                    "_route": "intent_directed",
                }
            )

        hits.sort(key=lambda item: float(item.get("score", 0.0)), reverse=True)
        return hits[:top_k]

    @classmethod
    def _dedupe_and_fuse(cls, route_hits: list[list[dict[str, Any]]]) -> list[dict[str, Any]]:
        fused: dict[str, dict[str, Any]] = {}
        for hits in route_hits:
            if not hits:
                continue
            scores = [float(hit.get("score", 0.0)) for hit in hits]
            low, high = min(scores), max(scores)
            span = high - low
            for rank, hit in enumerate(hits, start=1):
                raw_score = float(hit.get("score", 0.0))
                normalized_score = (raw_score - low) / span if span > 1e-9 else 1.0
                route = str(hit.get("_route") or "unknown")
                route_prior = 0.10 if route == "intent_directed" else 0.08
                fused_score = normalized_score * 0.72 + route_prior + 0.08 / rank
                source_name = str(hit.get("source_name") or "").strip().lower()
                title_key = cls._normalize_text(str(hit.get("title") or ""))
                dedupe_key = source_name or title_key or f"chunk:{hit.get('chunk_id')}"
                current = fused.get(dedupe_key)
                if current is None:
                    current = dict(hit)
                    current["score"] = fused_score
                    current["_routes"] = [route]
                    fused[dedupe_key] = current
                    continue
                current_routes = list(current.get("_routes") or [])
                if route not in current_routes:
                    current_routes.append(route)
                    current["score"] = max(float(current.get("score", 0.0)), fused_score) + 0.16
                else:
                    current["score"] = max(float(current.get("score", 0.0)), fused_score)
                current["_routes"] = current_routes
                if len(str(hit.get("content") or "")) > len(str(current.get("content") or "")):
                    current["content"] = hit.get("content")
        return list(fused.values())

    @staticmethod
    def _prune_hits(hits: list[dict[str, Any]], top_k: int) -> list[dict[str, Any]]:
        if not hits:
            return []
        best_score = float(hits[0].get("score", 0.0))
        threshold = max(best_score * 0.97, best_score - 0.04)
        selected = [hit for hit in hits if float(hit.get("score", 0.0)) >= threshold]
        return (selected or hits[:1])[:top_k]

    async def search(self, request: RagSearchRequest) -> RagSearchResponse:
        started_at = time.perf_counter()
        intent, directed_query, preferred_sections = self._build_intent_query(request.query)
        candidate_k = min(max(request.top_k * 4, 12), 40)
        allow_bililearn = intent == "system_usage" or "bililearn" in self._normalize_text(request.query)

        intent_task = asyncio.create_task(asyncio.to_thread(
            self._search_local_markdown,
            request.course_code,
            directed_query,
            candidate_k,
            preferred_sections,
            allow_bililearn=allow_bililearn,
        ))
        intent_hits = await intent_task

        vector_hits: list[dict[str, Any]] = []
        if not intent_hits:
            try:
                vector_hits = await self._search_global_vector(
                    request.course_code,
                    request.query,
                    candidate_k,
                    allow_bililearn=allow_bililearn,
                )
            except Exception:
                vector_hits = []

        if not intent_hits:
            intent_hits = self._search_local_markdown(
                request.course_code,
                request.query,
                candidate_k,
                allow_bililearn=allow_bililearn,
            )
        candidates = self._dedupe_and_fuse([intent_hits, vector_hits])
        matched_section = self._matched_section_hint(request.query)
        if matched_section:
            for candidate in candidates:
                if str(candidate.get("source_name") or "").startswith(matched_section):
                    candidate["score"] = float(candidate.get("score", 0.0)) + 0.45
        effective_top_k = 1 if matched_section else request.top_k
        hits = self._prune_hits(self._rerank_hits(request.query, candidates), effective_top_k)
        vector_backend = "none"
        if any("global_vector_milvus" in (hit.get("_routes") or []) for hit in candidates):
            vector_backend = "milvus"
        elif any("global_vector_local" in (hit.get("_routes") or []) for hit in candidates):
            vector_backend = "local_cached_remote_embedding"
        elif any("global_vector_tfidf" in (hit.get("_routes") or []) for hit in candidates):
            vector_backend = "local_tfidf"
        elapsed_ms = (time.perf_counter() - started_at) * 1000
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
            retrieval_mode="intent+global_vector",
            vector_backend=vector_backend,
            intent=intent,
            candidate_count=len(candidates),
            latency_ms=round(elapsed_ms, 2),
        )
