import httpx

from app.core.config import settings
from app.integrations.llm.base import BaseLLMProvider, LLMMessage


class OpenAICompatProvider(BaseLLMProvider):
    async def generate(self, messages: list[LLMMessage]) -> str:
        if not settings.llm_base_url or not settings.llm_api_key:
            raise ValueError("LLM base url or api key is missing")

        payload = {
            "model": settings.llm_model,
            "messages": [{"role": message.role, "content": message.content} for message in messages],
            "temperature": 0.2,
        }
        async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
            response = await client.post(
                f"{settings.llm_base_url.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.llm_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
