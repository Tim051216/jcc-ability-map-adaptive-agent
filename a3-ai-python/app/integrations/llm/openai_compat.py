import httpx

from app.core.config import settings
from app.core.logging import logger
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
        timeout_seconds = max(int(settings.llm_timeout_seconds or 0), 90)
        timeout = httpx.Timeout(timeout_seconds, connect=15.0, write=30.0, pool=15.0)
        last_error: Exception | None = None

        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
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
            except httpx.ReadTimeout as exc:
                last_error = exc
                logger.warning(
                    "LLM response timed out, retrying once",
                    attempt=attempt + 1,
                    timeout_seconds=timeout_seconds,
                    model=settings.llm_model,
                )
            except httpx.HTTPStatusError as exc:
                detail = exc.response.text.strip()
                if detail:
                    raise RuntimeError(
                        f"LLM request failed with status {exc.response.status_code}: {detail[:300]}"
                    ) from exc
                raise RuntimeError(f"LLM request failed with status {exc.response.status_code}") from exc
            except httpx.HTTPError as exc:
                detail = str(exc).strip()
                raise RuntimeError(detail or exc.__class__.__name__) from exc

        raise RuntimeError(f"LLM response timed out after {timeout_seconds}s") from last_error
