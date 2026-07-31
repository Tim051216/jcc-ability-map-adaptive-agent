from __future__ import annotations

import asyncio
import inspect
from datetime import datetime
from typing import Any, Awaitable, Callable

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field, create_model

from app.harness.runtime import emit, span
from app.schemas.mcp_tools import MCPToolCall, MCPToolResult, MCPToolSpec
from app.schemas.rag import RagSearchRequest
from app.schemas.web_tools import WebSearchRequest
from app.services.agent_safety_policy import AgentSafetyPolicy
from app.services.rag_service import RagService
from app.services.realtime_tool_service import RealtimeToolService
from app.services.web_tool_service import WebToolService

ToolHandler = Callable[..., Awaitable[dict[str, Any]] | dict[str, Any]]


class MCPToolDefinition:
    def __init__(
        self,
        *,
        name: str,
        description: str,
        input_schema: dict[str, Any],
        args_schema: type[BaseModel],
        handler: ToolHandler,
    ) -> None:
        self.name = name
        self.description = description
        self.input_schema = input_schema
        self.args_schema = args_schema
        self.handler = handler

    def as_spec(self) -> MCPToolSpec:
        return MCPToolSpec(
            name=self.name,
            description=self.description,
            input_schema=self.input_schema,
        )

    def as_langchain_tool(self) -> StructuredTool:
        async def _coroutine(**kwargs: Any) -> dict[str, Any]:
            return await self.invoke(kwargs)

        return StructuredTool.from_function(
            coroutine=_coroutine,
            name=self.name,
            description=self.description,
            args_schema=self.args_schema,
        )

    async def invoke(self, arguments: dict[str, Any]) -> dict[str, Any]:
        payload = self.args_schema(**arguments).model_dump()
        result = self.handler(**payload)
        if inspect.isawaitable(result):
            result = await result
        return dict(result or {})


class MCPToolRegistry:
    """MCP-style tool registry backed by LangChain StructuredTool wrappers."""

    def __init__(self, safety_policy: AgentSafetyPolicy | None = None) -> None:
        self._tools: dict[str, MCPToolDefinition] = {}
        self.safety_policy = safety_policy or AgentSafetyPolicy.from_settings()
        self._realtime = RealtimeToolService()
        self._web = WebToolService()
        self._rag = RagService()
        self._register_builtin_tools()

    def list_specs(self) -> list[MCPToolSpec]:
        return [tool.as_spec() for tool in self._tools.values()]

    def list_langchain_tools(self) -> list[StructuredTool]:
        return [tool.as_langchain_tool() for tool in self._tools.values()]

    async def invoke(self, call: MCPToolCall) -> MCPToolResult:
        async with span(
            f"tool.{call.tool_name}",
            kind="tool",
            attributes={"arguments": call.arguments},
        ):
            tool = self._tools.get(call.tool_name)
            if tool is None:
                response = MCPToolResult(
                    tool_name=call.tool_name,
                    ok=False,
                    error=f"Unknown tool: {call.tool_name}",
                )
            else:
                try:
                    result = await self._invoke_with_retry(tool, call.arguments)
                    response = MCPToolResult(tool_name=call.tool_name, ok=True, result=result)
                except Exception as exc:
                    response = MCPToolResult(tool_name=call.tool_name, ok=False, error=repr(exc))
            emit(
                "tool_result",
                tool_name=call.tool_name,
                ok=response.ok,
                error=response.error,
            )
            return response

    async def _invoke_with_retry(
        self,
        tool: MCPToolDefinition,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        last_error: Exception | None = None
        attempts = max(1, self.safety_policy.tool_retry_attempts)
        for attempt in range(attempts):
            try:
                return await asyncio.wait_for(
                    tool.invoke(arguments),
                    timeout=self.safety_policy.tool_timeout_seconds,
                )
            except Exception as exc:
                last_error = exc
                if attempt >= attempts - 1:
                    break
                await asyncio.sleep(self.safety_policy.backoff_seconds(attempt))
        if last_error is not None:
            raise last_error
        raise RuntimeError("MCP tool invocation failed")

    def _register(
        self,
        *,
        name: str,
        description: str,
        fields: dict[str, tuple[Any, Any]],
        handler: ToolHandler,
    ) -> None:
        args_schema = create_model(f"{name.title().replace('_', '')}Args", **fields)
        self._tools[name] = MCPToolDefinition(
            name=name,
            description=description,
            input_schema=args_schema.model_json_schema(),
            args_schema=args_schema,
            handler=handler,
        )

    def _register_builtin_tools(self) -> None:
        self._register(
            name="local_time",
            description="Get current local date, time, and weekday in Asia/Shanghai.",
            fields={
                "query": (
                    str,
                    Field(default="current time", description="The user's time/date question."),
                )
            },
            handler=self._local_time,
        )
        self._register(
            name="weather",
            description="Get live weather forecast for a city or location.",
            fields={
                "location": (str, Field(..., description="City or location name.")),
                "day": (
                    str,
                    Field(
                        default="today",
                        description="today, tomorrow, or the day after tomorrow.",
                    ),
                ),
            },
            handler=self._weather,
        )
        self._register(
            name="web_search",
            description="Search the web for current or external information.",
            fields={
                "query": (str, Field(..., description="Search query.")),
                "top_k": (int, Field(default=5, ge=1, le=10, description="Number of results.")),
            },
            handler=self._web_search,
        )
        self._register(
            name="web_fetch",
            description="Fetch and summarize a specific URL.",
            fields={
                "url": (str, Field(..., description="URL to fetch.")),
                "max_chars": (
                    int,
                    Field(default=6000, ge=500, le=20000, description="Maximum content chars."),
                ),
            },
            handler=self._web_fetch,
        )
        self._register(
            name="course_knowledge_search",
            description="Search the local course knowledge base for BiliLearn course answers.",
            fields={
                "query": (str, Field(..., description="Course knowledge question.")),
                "course_code": (
                    str,
                    Field(default="software_engineering_4th", description="Course code."),
                ),
                "top_k": (int, Field(default=4, ge=1, le=8, description="Number of chunks.")),
            },
            handler=self._course_knowledge_search,
        )

    async def _local_time(self, query: str = "current time") -> dict[str, Any]:
        result = self._realtime._lookup_local_time(query) or {}
        return {
            "answer_text": result.get("answer_text")
            or f"Current local time is {datetime.now():%Y-%m-%d %H:%M}.",
            "reference_sources": result.get("reference_sources", []),
        }

    async def _weather(self, location: str, day: str = "today") -> dict[str, Any]:
        day_text = {"tomorrow": "明天", "day_after_tomorrow": "后天"}.get(day, "今天")
        query = f"{location}{day_text}天气"
        result = await self._realtime._lookup_weather(query)
        return result or {"message": "No weather result found.", "reference_sources": []}

    async def _web_search(self, query: str, top_k: int = 5) -> dict[str, Any]:
        result = await self._web.websearch(WebSearchRequest(query=query, top_k=top_k))
        return result.model_dump()

    async def _web_fetch(self, url: str, max_chars: int = 6000) -> dict[str, Any]:
        result = await self._web.webfetch(url, max_chars=max_chars)
        return result.model_dump()

    async def _course_knowledge_search(
        self,
        query: str,
        course_code: str = "software_engineering_4th",
        top_k: int = 4,
    ) -> dict[str, Any]:
        search = await self._rag.search(
            RagSearchRequest(query=query, course_code=course_code, top_k=top_k)
        )
        return search.model_dump()
