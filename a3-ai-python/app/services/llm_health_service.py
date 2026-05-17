import httpx
from time import monotonic

from app.core.config import settings
from app.integrations.llm.provider_factory import get_llm_provider


class LLMHealthService:
    _cache_ttl_seconds = 30.0
    _cached_response: dict | None = None
    _cached_at = 0.0

    def _configured(self) -> bool:
        return bool(settings.llm_base_url and settings.llm_api_key and settings.llm_model)

    async def ping(self) -> dict:
        cached = self._get_cached_response()
        if cached is not None:
            return cached

        if not self._configured():
            response = {
                "status": "not_configured",
                "provider": settings.llm_provider,
                "model": settings.llm_model,
                "message": "未配置可用的 LLM 连接信息。",
            }
            self._store_cached_response(response)
            return response

        try:
            provider = get_llm_provider()
            text = await provider.ping()
            response = {
                "status": "ok",
                "provider": settings.llm_provider,
                "model": settings.llm_model,
                "message": text,
            }
        except (httpx.HTTPError, ValueError, KeyError, IndexError, RuntimeError) as exc:
            response = {
                "status": "unavailable",
                "provider": settings.llm_provider,
                "model": settings.llm_model,
                "message": str(exc),
            }
        self._store_cached_response(response)
        return response

    @classmethod
    def _get_cached_response(cls) -> dict | None:
        if cls._cached_response is None:
            return None
        if monotonic() - cls._cached_at > cls._cache_ttl_seconds:
            cls._cached_response = None
            return None
        return dict(cls._cached_response)

    @classmethod
    def _store_cached_response(cls, response: dict) -> None:
        cls._cached_response = dict(response)
        cls._cached_at = monotonic()
