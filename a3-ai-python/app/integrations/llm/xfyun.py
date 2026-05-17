from app.integrations.llm.base import BaseLLMProvider, LLMMessage
from app.integrations.llm.openai_compat import OpenAICompatProvider


class XFYunProvider(BaseLLMProvider):
    async def generate(self, messages: list[LLMMessage]) -> str:
        return await OpenAICompatProvider().generate(messages)

    async def ping(self) -> str:
        return await OpenAICompatProvider().ping()
