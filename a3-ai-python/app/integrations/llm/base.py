from dataclasses import dataclass
from collections.abc import AsyncIterator
from typing import Any


@dataclass
class LLMMessage:
    role: str
    content: Any


class BaseLLMProvider:
    async def generate(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.2,
        max_tokens: int | None = None,
        model: str | None = None,
    ) -> str:
        raise NotImplementedError

    async def generate_stream(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.2,
        max_tokens: int | None = None,
        model: str | None = None,
    ) -> AsyncIterator[str]:
        text = await self.generate(messages, temperature=temperature, max_tokens=max_tokens, model=model)
        if text:
            yield text

    async def ping(self) -> str:
        raise NotImplementedError
