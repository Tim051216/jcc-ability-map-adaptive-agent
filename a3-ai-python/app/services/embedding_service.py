import hashlib
import math

import httpx

from app.core.config import settings


class EmbeddingService:
    """优先走真实 embedding 接口，失败后再降级到稳定哈希向量。"""

    def _hash_embedding(self, text: str) -> list[float]:
        normalized = text.strip() or "empty"
        digest = hashlib.sha256(normalized.encode("utf-8")).digest()
        values: list[float] = []
        for index in range(settings.milvus_dimension):
            byte_value = digest[index % len(digest)]
            values.append((byte_value / 255.0) * 2 - 1)

        norm = math.sqrt(sum(value * value for value in values)) or 1.0
        return [value / norm for value in values]

    def _remote_enabled(self) -> bool:
        return settings.embedding_provider == "openai_compat" and bool(settings.embedding_base_url)

    async def _request_remote_embedding(self, text: str) -> list[float]:
        if not self._remote_enabled():
            raise ValueError("embedding remote provider is not enabled")

        async with httpx.AsyncClient(timeout=settings.embedding_timeout_seconds) as client:
            response = await client.post(
                f"{settings.embedding_base_url.rstrip('/')}/embeddings",
                headers={
                    "Authorization": f"Bearer {settings.embedding_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.embedding_model,
                    "input": text,
                },
            )
            response.raise_for_status()
            payload = response.json()
            embedding = payload["data"][0]["embedding"]
            if not isinstance(embedding, list) or not embedding:
                raise ValueError("embedding payload is empty")

            vector = [float(value) for value in embedding]
            if len(vector) != settings.milvus_dimension:
                raise ValueError(
                    f"embedding dimension mismatch: remote={len(vector)}, milvus={settings.milvus_dimension}"
                )
            return vector

    async def embed_text(self, text: str) -> list[float]:
        if not self._remote_enabled():
            return self._hash_embedding(text)

        try:
            return await self._request_remote_embedding(text)
        except Exception:
            # 真实模型不可用时退回稳定向量，保证本地开发和演示链路不中断。
            return self._hash_embedding(text)

    async def ping(self) -> dict:
        if not self._remote_enabled():
            return {
                "status": "fallback",
                "provider": settings.embedding_provider,
                "model": settings.embedding_model,
                "dimension": settings.milvus_dimension,
                "message": "未配置真实 embedding 服务，当前使用本地哈希向量。",
            }

        try:
            vector = await self._request_remote_embedding("embedding health check")
            return {
                "status": "ok",
                "provider": settings.embedding_provider,
                "model": settings.embedding_model,
                "dimension": len(vector),
                "message": "真实 embedding 服务可用。",
            }
        except Exception as exc:
            return {
                "status": "unavailable",
                "provider": settings.embedding_provider,
                "model": settings.embedding_model,
                "dimension": settings.milvus_dimension,
                "message": str(exc),
            }
