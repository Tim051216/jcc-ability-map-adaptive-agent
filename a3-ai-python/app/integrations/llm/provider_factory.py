from app.core.config import settings
from app.integrations.llm.base import BaseLLMProvider
from app.integrations.llm.openai_compat import OpenAICompatProvider
from app.integrations.llm.xfyun import XFYunProvider


def get_llm_provider() -> BaseLLMProvider:
    if settings.llm_provider == "xfyun":
        return XFYunProvider()
    return OpenAICompatProvider()
