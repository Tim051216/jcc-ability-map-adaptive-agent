"""
面向智能体节点的 LLM 调用适配层（OpenAI SDK 风格的 chat_completion 返回值）。
底层走 `get_llm_provider().generate`。
"""
from __future__ import annotations

from types import SimpleNamespace
from collections.abc import AsyncIterator
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
        model: str | None = None,
    ) -> Any:
        provider = get_llm_provider()
        llm_messages = [LLMMessage(role=str(m.get("role", "user")), content=str(m.get("content", ""))) for m in messages]
        text = await provider.generate(llm_messages, temperature=temperature, max_tokens=max_tokens, model=model)
        msg = CompatNamespace(content=text)
        choice = CompatNamespace(message=msg)
        return CompatNamespace(content=text, choices=[choice])

    async def chat_completion_stream(
        self,
        messages: list[dict[str, Any]],
        *,
        temperature: float = 0.2,
        max_tokens: int | None = None,
        model: str | None = None,
    ) -> AsyncIterator[str]:
        provider = get_llm_provider()
        llm_messages = [LLMMessage(role=str(m.get("role", "user")), content=str(m.get("content", ""))) for m in messages]
        async for chunk in provider.generate_stream(llm_messages, temperature=temperature, max_tokens=max_tokens, model=model):
            if chunk:
                yield chunk


def get_llm_client() -> LLMClient:
    return LLMClient()
