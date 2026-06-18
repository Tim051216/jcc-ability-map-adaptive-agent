import asyncio
import json

from app.schemas.web_tools import WebSearchRequest
from app.services.web_tool_service import WebToolService


async def main() -> None:
    service = WebToolService()
    result = {
        "api_key_present": bool(service.api_key),
        "search_items": 0,
        "first_title": "",
        "first_url": "",
        "fetch_title": "",
        "fetch_content_len": 0,
    }

    search = await service.websearch(
        WebSearchRequest(
            query="React official docs useEffect",
            top_k=3,
            domain_whitelist=["react.dev"],
        )
    )
    result["search_items"] = len(search.items)

    if search.items:
        first = search.items[0]
        result["first_title"] = first.title
        result["first_url"] = first.url
        fetched = await service.webfetch(first.url, max_chars=800)
        result["fetch_title"] = fetched.title
        result["fetch_content_len"] = len(fetched.content)

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
