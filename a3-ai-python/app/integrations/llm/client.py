"""
面向智能体节点的 LLM 调用适配层（OpenAI SDK 风格的 chat_completion 返回值）。
底层走 `get_llm_provider().generate`。
"""
from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from app.integrations.llm.base import LLMMessage
from app.integrations.llm.provider_factory import get_llm_provider


class CompatNamespace(SimpleNamespace):
    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default)


class LLMClient:
    async def chat_completion(
        self,
        messages: list[dict[str, Any]],
        *,
        temperature: float = 0.2,
        max_tokens: int | None = None,
    ) -> Any:
        _ = temperature
        _ = max_tokens
        provider = get_llm_provider()
        llm_messages = [LLMMessage(role=str(m.get("role", "user")), content=str(m.get("content", ""))) for m in messages]
        text = await provider.generate(llm_messages)
        msg = CompatNamespace(content=text)
        choice = CompatNamespace(message=msg)
        return CompatNamespace(content=text, choices=[choice])


def get_llm_client() -> LLMClient:
    return LLMClient()
