import httpx

from app.core.config import settings
from app.integrations.llm.base import LLMMessage
from app.integrations.llm.provider_factory import get_llm_provider


class LLMHealthService:
    def _configured(self) -> bool:
        return bool(settings.llm_base_url and settings.llm_api_key and settings.llm_model)

    async def ping(self) -> dict:
        if not self._configured():
            return {
                "status": "not_configured",
                "provider": settings.llm_provider,
                "model": settings.llm_model,
                "message": "未配置可用的 LLM 连接信息。",
            }

        try:
            provider = get_llm_provider()
            text = await provider.generate(
                [
                    LLMMessage(role="system", content="你是一个简短的系统连通性测试助手。"),
                    LLMMessage(role="user", content="请只回复：ok"),
                ]
            )
            return {
                "status": "ok",
                "provider": settings.llm_provider,
                "model": settings.llm_model,
                "message": text,
            }
        except (httpx.HTTPError, ValueError, KeyError, IndexError, RuntimeError) as exc:
            return {
                "status": "unavailable",
                "provider": settings.llm_provider,
                "model": settings.llm_model,
                "message": str(exc),
            }
