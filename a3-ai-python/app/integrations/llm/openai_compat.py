import httpx
import json
from collections.abc import AsyncIterator

from app.core.config import settings
from app.core.logging import logger
from app.integrations.llm.base import BaseLLMProvider, LLMMessage


class OpenAICompatProvider(BaseLLMProvider):
    @staticmethod
    def _is_billing_error(detail: str) -> bool:
        normalized = (detail or "").lower()
        return "arrearage" in normalized or "overdue-payment" in normalized or "account is in good standing" in normalized

    def _build_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {settings.llm_api_key}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _candidate_models(preferred_model: str | None = None) -> list[str]:
        models: list[str] = []
        for raw in [preferred_model or "", settings.llm_model, *(settings.llm_fallback_models or "").split(",")]:
            model = raw.strip()
            if model and model not in models:
                models.append(model)
        return models

    @staticmethod
    def _contains_multimodal_content(messages: list[LLMMessage]) -> bool:
        for message in messages:
            content = message.content
            if isinstance(content, list) and any(isinstance(item, dict) and item.get("type") == "image_url" for item in content):
                return True
        return False

    @staticmethod
    def _vision_candidate_models(preferred_model: str | None = None) -> list[str]:
        models: list[str] = []
        for raw in [preferred_model or "", settings.llm_vision_model or "", *(settings.llm_vision_fallback_models or "").split(",")]:
            model = raw.strip()
            if model and model not in models:
                models.append(model)
        return models

    async def generate(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.2,
        max_tokens: int | None = None,
        model: str | None = None,
    ) -> str:
        if not settings.llm_base_url or not settings.llm_api_key:
            raise ValueError("LLM base url or api key is missing")

        message_payload = [{"role": message.role, "content": message.content} for message in messages]
        candidate_models = (
            self._vision_candidate_models(model)
            if self._contains_multimodal_content(messages) and self._vision_candidate_models(model)
            else self._candidate_models(model)
        )
        timeout_seconds = max(int(settings.llm_timeout_seconds or 0), 90)
        timeout = httpx.Timeout(timeout_seconds, connect=15.0, write=30.0, pool=15.0)
        last_error: Exception | None = None
        billing_blocked_models: list[str] = []

        async with httpx.AsyncClient(timeout=timeout) as client:
            for model_name in candidate_models:
                payload = {
                    "model": model_name,
                    "messages": message_payload,
                    "temperature": temperature,
                }
                if max_tokens is not None:
                    payload["max_tokens"] = max_tokens
                for attempt in range(2):
                    try:
                        response = await client.post(
                            f"{settings.llm_base_url.rstrip('/')}/chat/completions",
                            headers=self._build_headers(),
                            json=payload,
                        )
                        response.raise_for_status()
                        data = response.json()
                        logger.info("LLM model request succeeded", model=model_name)
                        return data["choices"][0]["message"]["content"].strip()
                    except httpx.ReadTimeout as exc:
                        last_error = exc
                        logger.warning(
                            "LLM response timed out, retrying once",
                            attempt=attempt + 1,
                            timeout_seconds=timeout_seconds,
                            model=model_name,
                        )
                    except httpx.HTTPStatusError as exc:
                        last_error = exc
                        detail = exc.response.text.strip()
                        if self._is_billing_error(detail):
                            billing_blocked_models.append(model_name)
                            logger.warning(
                                "LLM model billing unavailable, trying next candidate",
                                model=model_name,
                                status_code=exc.response.status_code,
                                detail=detail[:300],
                            )
                            break
                        logger.warning(
                            "LLM model request failed, trying next candidate",
                            status_code=exc.response.status_code,
                            model=model_name,
                            detail=detail[:300],
                        )
                        break
                    except httpx.HTTPError as exc:
                        last_error = exc
                        detail = str(exc).strip()
                        logger.warning(
                            "LLM transport failed, trying next candidate",
                            model=model_name,
                            error=detail or exc.__class__.__name__,
                        )
                        break

        if billing_blocked_models and len(billing_blocked_models) == len(candidate_models):
            raise RuntimeError(
                f"LLM billing unavailable for all candidate models: {', '.join(billing_blocked_models)}"
            ) from last_error
        if last_error is not None:
            raise RuntimeError(
                f"LLM request failed for all candidate models: {', '.join(candidate_models)}"
            ) from last_error
        raise RuntimeError("No LLM candidate models configured")

    async def generate_stream(
        self,
        messages: list[LLMMessage],
        *,
        temperature: float = 0.2,
        max_tokens: int | None = None,
        model: str | None = None,
    ) -> AsyncIterator[str]:
        if not settings.llm_base_url or not settings.llm_api_key:
            raise ValueError("LLM base url or api key is missing")

        message_payload = [{"role": message.role, "content": message.content} for message in messages]
        candidate_models = (
            self._vision_candidate_models(model)
            if self._contains_multimodal_content(messages) and self._vision_candidate_models(model)
            else self._candidate_models(model)
        )
        timeout_seconds = max(int(settings.llm_timeout_seconds or 0), 90)
        timeout = httpx.Timeout(timeout_seconds, connect=15.0, write=30.0, pool=15.0)
        last_error: Exception | None = None
        billing_blocked_models: list[str] = []

        async with httpx.AsyncClient(timeout=timeout) as client:
            for model_name in candidate_models:
                payload = {
                    "model": model_name,
                    "messages": message_payload,
                    "temperature": temperature,
                    "stream": True,
                }
                if max_tokens is not None:
                    payload["max_tokens"] = max_tokens
                try:
                    async with client.stream(
                        "POST",
                        f"{settings.llm_base_url.rstrip('/')}/chat/completions",
                        headers=self._build_headers(),
                        json=payload,
                    ) as response:
                        response.raise_for_status()
                        logger.info("LLM model stream request succeeded", model=model_name)
                        async for line in response.aiter_lines():
                            if not line:
                                continue
                            if not line.startswith("data:"):
                                continue
                            data_part = line[5:].strip()
                            if not data_part or data_part == "[DONE]":
                                continue
                            data = json.loads(data_part)
                            choices = data.get("choices") or []
                            if not choices:
                                continue
                            delta = choices[0].get("delta") or {}
                            content = delta.get("content")
                            if isinstance(content, str) and content:
                                yield content
                    return
                except httpx.HTTPStatusError as exc:
                    last_error = exc
                    detail = exc.response.text.strip()
                    if self._is_billing_error(detail):
                        billing_blocked_models.append(model_name)
                        logger.warning(
                            "LLM stream model billing unavailable, trying next candidate",
                            model=model_name,
                            status_code=exc.response.status_code,
                            detail=detail[:300],
                        )
                        continue
                    logger.warning(
                        "LLM stream request failed, falling back to non-stream or next candidate",
                        status_code=exc.response.status_code,
                        model=model_name,
                        detail=detail[:300],
                    )
                except (httpx.HTTPError, json.JSONDecodeError) as exc:
                    last_error = exc
                    detail = str(exc).strip()
                    logger.warning(
                        "LLM stream transport failed, falling back to non-stream or next candidate",
                        model=model_name,
                        error=detail or exc.__class__.__name__,
                    )

        if billing_blocked_models and len(billing_blocked_models) == len(candidate_models):
            raise RuntimeError(
                f"LLM billing unavailable for all candidate models: {', '.join(billing_blocked_models)}"
            ) from last_error
        if last_error is not None:
            raise RuntimeError(
                f"LLM stream request failed for all candidate models: {', '.join(candidate_models)}"
            ) from last_error
        raise RuntimeError("No LLM candidate models configured")

    async def ping(self) -> str:
        if not settings.llm_base_url or not settings.llm_api_key:
            raise ValueError("LLM base url or api key is missing")

        timeout = httpx.Timeout(5.0, connect=3.0, write=3.0, pool=3.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(
                f"{settings.llm_base_url.rstrip('/')}/models",
                headers=self._build_headers(),
            )
            response.raise_for_status()
            data = response.json()

        models = data.get("data")
        if isinstance(models, list):
            available_ids = {item.get("id") for item in models if isinstance(item, dict)}
            matched = [model for model in self._candidate_models() if model in available_ids]
            if matched:
                return f"model {matched[0]} reachable"
            return f"provider reachable ({len(models)} models listed)"

        return "provider reachable"
