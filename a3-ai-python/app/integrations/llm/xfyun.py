from app.integrations.llm.base import BaseLLMProvider, LLMMessage
from app.integrations.llm.openai_compat import OpenAICompatProvider


class XFYunProvider(BaseLLMProvider):
    async def generate(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.2,
        max_tokens: int | None = None,
    ) -> str:
        return await OpenAICompatProvider().generate(messages, temperature=temperature, max_tokens=max_tokens)

    async def generate_stream(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.2,
        max_tokens: int | None = None,
    ):
        async for chunk in OpenAICompatProvider().generate_stream(
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
        ):
            yield chunk

    async def ping(self) -> str:
        return await OpenAICompatProvider().ping()
