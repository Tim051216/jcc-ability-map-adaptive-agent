from __future__ import annotations

from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.schemas.web_tools import (
    WebFetchResponse,
    WebSearchRequest,
    WebSearchResponse,
    WebSearchResultItem,
)


class WebToolService:
    DEFAULT_ALLOWED_DOMAINS = {
        "docs.python.org",
        "developer.mozilla.org",
        "fastapi.tiangolo.com",
        "react.dev",
        "vite.dev",
        "www.typescriptlang.org",
        "tailwindcss.com",
        "openai.com",
        "platform.openai.com",
        "arxiv.org",
        "github.com",
        "developer.aliyun.com",
        "help.aliyun.com",
        "bilibili.com",
        "www.bilibili.com",
        "search.bilibili.com",
        "www.rfc-editor.org",
        "wikipedia.org",
        "zh.wikipedia.org",
    }

    def __init__(self) -> None:
        self.api_key = str(settings.firecrawl_api_key or "").strip()
        self.base_url = str(settings.firecrawl_base_url or "https://api.firecrawl.dev/v2").rstrip("/")

    @classmethod
    def _is_allowed_url(cls, url: str, extra_domains: list[str] | None = None) -> bool:
        try:
            hostname = (urlparse(url).hostname or "").lower()
        except ValueError:
            return False
        if not hostname:
            return False
        allowed = {domain.lower() for domain in cls.DEFAULT_ALLOWED_DOMAINS}
        allowed.update(domain.lower() for domain in (extra_domains or []))
        return any(hostname == domain or hostname.endswith(f".{domain}") for domain in allowed)

    async def websearch(self, request: WebSearchRequest) -> WebSearchResponse:
        if not self.api_key:
            return WebSearchResponse(query=request.query, items=[])

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "query": request.query,
            "limit": request.top_k,
            "scrapeOptions": {
                "formats": ["markdown"],
                "onlyMainContent": True,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
                response = await client.post(f"{self.base_url}/search", json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
        except Exception:
            return WebSearchResponse(query=request.query, items=[])

        raw_items = data.get("data") or data.get("results") or []
        items: list[WebSearchResultItem] = []
        for raw in raw_items:
            url = str(raw.get("url") or "").strip()
            if not self._is_allowed_url(url, request.domain_whitelist):
                continue
            items.append(
                WebSearchResultItem(
                    title=str(raw.get("title") or "").strip(),
                    url=url,
                    snippet=str(raw.get("description") or raw.get("markdown") or "").strip()[:320],
                    source=urlparse(url).hostname or "",
                )
            )
            if len(items) >= request.top_k:
                break
        return WebSearchResponse(query=request.query, items=items)

    async def webfetch(self, url: str, *, max_chars: int = 6000) -> WebFetchResponse:
        if not self.api_key or not self._is_allowed_url(url):
            return WebFetchResponse(url=url, final_url=url, title="", content="", source="")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "url": url,
            "formats": ["markdown"],
            "onlyMainContent": True,
        }

        try:
            async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
                response = await client.post(f"{self.base_url}/scrape", json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
        except Exception:
            return WebFetchResponse(url=url, final_url=url, title="", content="", source="")

        record = data.get("data") or {}
        final_url = str(record.get("metadata", {}).get("sourceURL") or record.get("url") or url)
        title = str(record.get("metadata", {}).get("title") or record.get("title") or "").strip()
        content = str(record.get("markdown") or record.get("content") or "").strip()[:max_chars]
        return WebFetchResponse(
            url=url,
            final_url=final_url,
            title=title,
            content=content,
            source=urlparse(final_url).hostname or "",
        )
