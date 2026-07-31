"""
面向智能体节点的 LLM 调用适配层（OpenAI SDK 风格的 chat_completion 返回值）。
底层走 `get_llm_provider().generate`。
"""
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from types import SimpleNamespace
from typing import Any

from app.harness.runtime import emit, span
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
        timeout: float | None = None,
    ) -> Any:
        attributes = {
            "model": model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "timeout": timeout,
            "message_count": len(messages),
            "input_chars": sum(len(str(message.get("content", ""))) for message in messages),
        }
        async with span("llm.chat_completion", kind="llm", attributes=attributes):
            provider = get_llm_provider()
            llm_messages = [
                LLMMessage(
                    role=str(message.get("role", "user")),
                    content=message.get("content", ""),
                )
                for message in messages
            ]
            request = provider.generate(
                llm_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                model=model,
            )
            text = await asyncio.wait_for(request, timeout=timeout) if timeout else await request
            emit("llm_result", model=model, output_chars=len(text))
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
        attributes = {
            "model": model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "message_count": len(messages),
            "input_chars": sum(len(str(message.get("content", ""))) for message in messages),
        }
        async with span("llm.chat_completion_stream", kind="llm", attributes=attributes):
            provider = get_llm_provider()
            llm_messages = [
                LLMMessage(
                    role=str(message.get("role", "user")),
                    content=message.get("content", ""),
                )
                for message in messages
            ]
            output_chars = 0
            chunks = provider.generate_stream(
                llm_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                model=model,
            )
            async for chunk in chunks:
                if chunk:
                    output_chars += len(chunk)
                    yield chunk
            emit("llm_result", model=model, output_chars=output_chars, streaming=True)


def get_llm_client() -> LLMClient:
    return LLMClient()
