from __future__ import annotations

import json
import re
import asyncio
from typing import Any

from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI

from app.core.config import settings
from app.core.logging import logger
from app.integrations.llm.client import get_llm_client
from app.schemas.mcp_tools import MCPAgentResponse, MCPToolCall, MCPToolPlan, MCPToolResult
from app.services.agent_safety_policy import AgentSafetyPolicy
from app.services.mcp_tool_runtime import MCPToolRegistry


class LangChainToolCallingAgent:
    """LLM-planned tool-calling agent using MCP-style specs and LangChain tools."""

    def __init__(
        self,
        registry: MCPToolRegistry | None = None,
        safety_policy: AgentSafetyPolicy | None = None,
    ) -> None:
        self.safety_policy = safety_policy or AgentSafetyPolicy.from_settings()
        self.registry = registry or MCPToolRegistry(safety_policy=self.safety_policy)
        self.llm_client = get_llm_client()
        # Materialize LangChain StructuredTool wrappers so the runtime is a real
        # LangChain tool-calling surface, while our provider adapter handles the
        # JSON planning for models without native tool_calls support.
        self.langchain_tools = self.registry.list_langchain_tools()
        self.agent_executor = self._build_native_agent_executor()
        self.agent_executor_kind = (
            "langchain_agent_executor" if self.agent_executor is not None else "schema_planner_fallback"
        )

    async def run(
        self,
        query: str,
        *,
        course_id: int | None = None,
        user_profile: dict[str, Any] | None = None,
        max_tool_calls: int = 3,
    ) -> MCPAgentResponse | None:
        query = str(query or "").strip()
        if not query:
            return None

        try:
            plan = await asyncio.wait_for(
                self._build_plan(query, course_id=course_id, user_profile=user_profile),
                timeout=self.safety_policy.step_timeout_seconds,
            )
        except asyncio.TimeoutError:
            plan = MCPToolPlan(tool_calls=self._fallback_plan(query, course_id=course_id))
        if not plan.tool_calls:
            return None

        tool_calls = plan.tool_calls[:max_tool_calls]
        tool_results: list[MCPToolResult] = []
        reference_sources: list[dict[str, Any]] = []
        for call in tool_calls:
            result = await self.registry.invoke(call)
            tool_results.append(result)
            reference_sources.extend(self._extract_reference_sources(result))

        answer_text = await self._compose_answer(query, tool_calls, tool_results, plan.final_answer)
        return MCPAgentResponse(
            answer_text=answer_text,
            tool_calls=tool_calls,
            tool_results=tool_results,
            reference_sources=reference_sources,
            confidence_score=96.0 if any(result.ok for result in tool_results) else 65.0,
        )

    def _build_native_agent_executor(self) -> AgentExecutor | None:
        if not settings.llm_base_url or not settings.llm_api_key:
            return None
        try:
            llm = ChatOpenAI(
                model=settings.llm_fast_model or settings.llm_model,
                api_key=settings.llm_api_key,
                base_url=settings.llm_base_url.rstrip("/"),
                temperature=0,
            )
            prompt = ChatPromptTemplate.from_messages(
                [
                    (
                        "system",
                        "You are BiliLearn AI Tutor. Select tools when needed, "
                        "fill tool arguments from the user intent, and answer concisely in Chinese.",
                    ),
                    ("human", "{input}"),
                    MessagesPlaceholder("agent_scratchpad"),
                ]
            )
            agent = create_tool_calling_agent(llm, self.langchain_tools, prompt)
            return AgentExecutor(agent=agent, tools=self.langchain_tools, verbose=False)
        except Exception as exc:
            logger.info("langchain_tool_agent.native_executor_unavailable", error=repr(exc))
            return None

    async def _build_plan(
        self,
        query: str,
        *,
        course_id: int | None,
        user_profile: dict[str, Any] | None,
    ) -> MCPToolPlan:
        specs = [spec.model_dump() for spec in self.registry.list_specs()]
        prompt = (
            "You are the BiliLearn tool-calling planner.\n"
            "Choose tools only when they are useful. Return strict JSON only.\n"
            "Schema: {\"tool_calls\":[{\"tool_name\":\"...\",\"arguments\":{...}}],\"final_answer\":\"optional\"}\n"
            "Rules:\n"
            "1. Use local_time for current date/time/weekday.\n"
            "2. Use weather for weather questions.\n"
            "3. Use web_search for latest/current/external facts.\n"
            "4. Use web_fetch when the user gives a URL.\n"
            "5. Use course_knowledge_search for course or project knowledge questions.\n"
            "6. If no tool is needed, return an empty tool_calls array.\n\n"
            f"Available tools:\n{json.dumps(specs, ensure_ascii=False)}\n\n"
            f"course_id: {course_id}\n"
            f"user_profile: {json.dumps(user_profile or {}, ensure_ascii=False)[:1200]}\n"
            f"user_query: {query}\n"
        )
        try:
            response = await self.llm_client.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=700,
                model=settings.llm_fast_model,
            )
            payload = self._parse_json(str(response.choices[0].message.content or ""))
            calls = [
                MCPToolCall(
                    tool_name=str(item.get("tool_name") or item.get("name") or "").strip(),
                    arguments=dict(item.get("arguments") or item.get("args") or {}),
                )
                for item in payload.get("tool_calls", [])
                if isinstance(item, dict)
            ]
            calls = [call for call in calls if call.tool_name]
            if calls:
                return MCPToolPlan(tool_calls=calls, final_answer=payload.get("final_answer"))
        except Exception as exc:
            logger.info("langchain_tool_agent.plan_failed", error=repr(exc))

        return MCPToolPlan(tool_calls=self._fallback_plan(query, course_id=course_id))

    async def _compose_answer(
        self,
        query: str,
        tool_calls: list[MCPToolCall],
        tool_results: list[MCPToolResult],
        planner_answer: str | None,
    ) -> str:
        if planner_answer and not tool_results:
            return planner_answer

        compact_results = [result.model_dump() for result in tool_results]
        prompt = (
            "You are BiliLearn AI Tutor. Answer the user in concise Chinese.\n"
            "Use only the tool results below. Do not mention internal MCP, schema, or tool names unless necessary.\n"
            "If a tool failed, explain the useful part and say what information is missing.\n\n"
            f"User question: {query}\n"
            f"Tool calls: {json.dumps([call.model_dump() for call in tool_calls], ensure_ascii=False)}\n"
            f"Tool results: {json.dumps(compact_results, ensure_ascii=False)[:9000]}\n"
        )
        try:
            response = await self.llm_client.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.25,
                max_tokens=700,
                model=settings.llm_fast_model,
            )
            text = str(response.choices[0].message.content or "").strip()
            if text:
                return text
        except Exception as exc:
            logger.info("langchain_tool_agent.compose_failed", error=repr(exc))

        return self._fallback_answer(tool_results)

    @staticmethod
    def _parse_json(text: str) -> dict[str, Any]:
        match = re.search(r"\{.*\}", text, re.S)
        if not match:
            return {}
        try:
            return json.loads(match.group(0))
        except Exception:
            return {}

    @staticmethod
    def _fallback_plan(query: str, *, course_id: int | None) -> list[MCPToolCall]:
        lowered = query.lower()
        normalized = re.sub(r"\s+", "", query)
        if re.search(r"https?://", query):
            url = re.search(r"https?://\S+", query)
            return [MCPToolCall(tool_name="web_fetch", arguments={"url": url.group(0)})] if url else []
        if any(token in normalized for token in ("天气", "气温", "下雨", "降雨")):
            location = re.sub(r"(今天|明天|后天|天气|气温|温度|下雨|降雨|请问|帮我|查一下)", "", normalized)
            return [MCPToolCall(tool_name="weather", arguments={"location": location or "北京"})]
        if any(token in normalized for token in ("几点", "日期", "星期", "当前时间", "现在时间")):
            return [MCPToolCall(tool_name="local_time", arguments={"query": query})]
        if any(token in normalized for token in ("最新", "实时", "新闻", "官网", "联网", "搜索")):
            return [MCPToolCall(tool_name="web_search", arguments={"query": query, "top_k": 5})]
        if course_id or any(token in lowered for token in ("软件工程", "课程", "bililearn", "项目", "知识点")):
            return [
                MCPToolCall(
                    tool_name="course_knowledge_search",
                    arguments={"query": query, "course_code": "software_engineering_4th", "top_k": 4},
                )
            ]
        return []

    @staticmethod
    def _extract_reference_sources(result: MCPToolResult) -> list[dict[str, Any]]:
        if not result.ok:
            return []
        payload = result.result
        direct = payload.get("reference_sources")
        if isinstance(direct, list):
            return [item for item in direct if isinstance(item, dict)]
        items = payload.get("items")
        if isinstance(items, list):
            return [
                {
                    "source_type": "web",
                    "title": str(item.get("title") or ""),
                    "url": str(item.get("url") or ""),
                    "excerpt": str(item.get("snippet") or ""),
                }
                for item in items
                if isinstance(item, dict)
            ]
        chunks = payload.get("chunks") or payload.get("results")
        if isinstance(chunks, list):
            return [
                {
                    "source_type": "course",
                    "title": str(item.get("source") or item.get("title") or "Course knowledge"),
                    "url": str(item.get("url") or ""),
                    "excerpt": str(item.get("content") or item.get("snippet") or "")[:240],
                }
                for item in chunks
                if isinstance(item, dict)
            ]
        return []

    @staticmethod
    def _fallback_answer(tool_results: list[MCPToolResult]) -> str:
        for result in tool_results:
            if not result.ok:
                continue
            payload = result.result
            if payload.get("answer_text"):
                return str(payload["answer_text"])
            if payload.get("items"):
                first = payload["items"][0]
                return f"我查到的首条结果是：{first.get('title', '')}。{first.get('snippet', '')}"
            if payload.get("content"):
                return str(payload["content"])[:600]
        return "我尝试调用工具，但没有拿到足够可用的结果。你可以换一个更具体的问题再试。"
