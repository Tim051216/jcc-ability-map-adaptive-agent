from app.integrations.llm.base import BaseLLMProvider, LLMMessage
from app.integrations.llm.openai_compat import OpenAICompatProvider


class XFYunProvider(BaseLLMProvider):
    async def generate(self, messages: list[LLMMessage]) -> str:
        # 当前先复用 OpenAI 兼容协议，便于快速接入兼容网关。
        return await OpenAICompatProvider().generate(messages)
