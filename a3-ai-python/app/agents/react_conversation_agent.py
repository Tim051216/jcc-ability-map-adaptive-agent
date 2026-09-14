from __future__ import annotations

import json
import re
import asyncio
from typing import Any

try:
    from langchain.agents import AgentExecutor, create_react_agent
    from langchain_core.prompts import PromptTemplate
    from langchain_openai import ChatOpenAI
except ImportError:
    AgentExecutor = None  # type: ignore[assignment,misc]
    create_react_agent = None  # type: ignore[assignment]
    PromptTemplate = None  # type: ignore[assignment,misc]
    ChatOpenAI = None  # type: ignore[assignment,misc]

from app.core.config import settings
from app.core.logging import logger
from app.integrations.llm.client import get_llm_client
from app.schemas.mcp_tools import MCPAgentResponse, MCPToolCall, MCPToolResult, ReActTraceStep
from app.services.agent_safety_policy import AgentSafetyPolicy
from app.services.mcp_tool_runtime import MCPToolRegistry


class ReActConversationAgent:
    """Conversation agent with explicit Thought -> Action -> Observation loop."""

    def __init__(
        self,
        registry: MCPToolRegistry | None = None,
        safety_policy: AgentSafetyPolicy | None = None,
    ) -> None:
        self.safety_policy = safety_policy or AgentSafetyPolicy.from_settings()
        self.registry = registry or MCPToolRegistry(safety_policy=self.safety_policy)
        self.llm_client = get_llm_client()
        self.langchain_tools = self.registry.list_langchain_tools()
        self.agent_executor = self._build_native_react_executor()
        self.agent_executor_kind = (
            "langchain_react_agent_executor" if self.agent_executor is not None else "react_json_loop"
        )

    async def run(
        self,
        query: str,
        *,
        course_id: int | None = None,
        user_profile: dict[str, Any] | None = None,
        max_steps: int | None = None,
    ) -> MCPAgentResponse | None:
        query = str(query or "").strip()
        if not query:
            return None

        trace: list[ReActTraceStep] = []
        tool_calls: list[MCPToolCall] = []
        tool_results: list[MCPToolResult] = []

        replan_count = 0
        for _ in range(self.safety_policy.clamp_steps(max_steps)):
            try:
                decision = await asyncio.wait_for(
                    self._next_react_decision(
                        query,
                        trace=trace,
                        course_id=course_id,
                        user_profile=user_profile,
                    ),
                    timeout=self.safety_policy.step_timeout_seconds,
                )
            except asyncio.TimeoutError:
                trace.append(
                    ReActTraceStep(
                        step_type="observation",
                        content="Agent step timed out and was stopped by safety policy.",
                    )
                )
                break
            thought = str(decision.get("thought") or "").strip()
            if thought:
                trace.append(ReActTraceStep(step_type="thought", content=thought))

            final_answer = str(decision.get("final_answer") or "").strip()
            action = decision.get("action")
            if final_answer and not action:
                trace.append(ReActTraceStep(step_type="final", content=final_answer))
                return MCPAgentResponse(
                    answer_text=final_answer,
                    tool_calls=tool_calls,
                    tool_results=tool_results,
                    react_trace=trace,
                    agent_mode="react",
                    reference_sources=self._extract_reference_sources(tool_results),
                    confidence_score=96.0 if tool_results else 88.0,
                )

            if not isinstance(action, dict):
                break

            replan_count += 1
            if replan_count > self.safety_policy.max_replans:
                trace.append(
                    ReActTraceStep(
                        step_type="observation",
                        content="Replan limit reached; stop planning and compose final answer.",
                    )
                )
                break

            call = MCPToolCall(
                tool_name=str(action.get("tool_name") or "").strip(),
                arguments=dict(action.get("arguments") or {}),
            )
            if not call.tool_name:
                break

            trace.append(
                ReActTraceStep(
                    step_type="action",
                    content=f"Call {call.tool_name}",
                    tool_name=call.tool_name,
                    arguments=call.arguments,
                )
            )
            result = await self.registry.invoke(call)
            tool_calls.append(call)
            tool_results.append(result)
            trace.append(
                ReActTraceStep(
                    step_type="observation",
                    content=result.error or "Tool returned data.",
                    tool_name=result.tool_name,
                    observation=result.model_dump(),
                )
            )

        if not tool_results:
            fallback_calls = self._fallback_action(query, course_id=course_id)
            if not fallback_calls:
                return None
            for call in fallback_calls[:2]:
                trace.append(ReActTraceStep(step_type="thought", content="需要调用工具补充信息。"))
                trace.append(
                    ReActTraceStep(
                        step_type="action",
                        content=f"Call {call.tool_name}",
                        tool_name=call.tool_name,
                        arguments=call.arguments,
                    )
                )
                result = await self.registry.invoke(call)
                tool_calls.append(call)
                tool_results.append(result)
                trace.append(
                    ReActTraceStep(
                        step_type="observation",
                        content=result.error or "Tool returned data.",
                        tool_name=result.tool_name,
                        observation=result.model_dump(),
                    )
                )

        answer_text = await self._compose_final_answer(query, trace, tool_results)
        trace.append(ReActTraceStep(step_type="final", content=answer_text))
        return MCPAgentResponse(
            answer_text=answer_text,
            tool_calls=tool_calls,
            tool_results=tool_results,
            react_trace=trace,
            agent_mode="react",
            reference_sources=self._extract_reference_sources(tool_results),
            confidence_score=96.0 if any(result.ok for result in tool_results) else 70.0,
        )

    def _build_native_react_executor(self) -> AgentExecutor | None:
        if (
            AgentExecutor is None
            or create_react_agent is None
            or PromptTemplate is None
            or ChatOpenAI is None
            or not settings.llm_base_url
            or not settings.llm_api_key
        ):
            return None
        try:
            llm = ChatOpenAI(
                model=settings.llm_fast_model or settings.llm_model,
                api_key=settings.llm_api_key,
                base_url=settings.llm_base_url.rstrip("/"),
                temperature=0,
            )
            prompt = PromptTemplate.from_template(
                "Answer the following questions as best you can. You have access to these tools:\n"
                "{tools}\n\n"
                "Use this format:\n"
                "Question: the input question\n"
                "Thought: think about what to do\n"
                "Action: one of [{tool_names}]\n"
                "Action Input: the JSON input to the action\n"
                "Observation: the result of the action\n"
                "... repeat Thought/Action/Action Input/Observation as needed\n"
                "Thought: I now know the final answer\n"
                "Final Answer: the final answer in Chinese\n\n"
                "Question: {input}\n"
                "{agent_scratchpad}"
            )
            agent = create_react_agent(llm, self.langchain_tools, prompt)
            return AgentExecutor(agent=agent, tools=self.langchain_tools, verbose=False)
        except Exception as exc:
            logger.info("react_conversation_agent.native_executor_unavailable", error=repr(exc))
            return None

    async def _next_react_decision(
        self,
        query: str,
        *,
        trace: list[ReActTraceStep],
        course_id: int | None,
        user_profile: dict[str, Any] | None,
    ) -> dict[str, Any]:
        prompt = (
            "You are the Gang-Ke-Sai ReAct conversation agent for software engineering job-course-competition learning. Return strict JSON only.\n"
            "Use Thought -> Action -> Observation. You only produce the next Thought and optional Action.\n"
            "Schema: {\"thought\":\"...\",\"action\":{\"tool_name\":\"...\",\"arguments\":{...}},\"final_answer\":null}\n"
            "If observations are enough, return {\"thought\":\"...\",\"action\":null,\"final_answer\":\"...\"}.\n"
            "Available tools:\n"
            f"{json.dumps([spec.model_dump() for spec in self.registry.list_specs()], ensure_ascii=False)}\n\n"
            f"course_id: {course_id}\n"
            f"user_profile: {json.dumps(user_profile or {}, ensure_ascii=False)[:1000]}\n"
            f"user_query: {query}\n"
            f"trace_so_far: {json.dumps([step.model_dump() for step in trace], ensure_ascii=False)[:7000]}\n"
        )
        try:
            response = await self.llm_client.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=700,
                model=settings.llm_fast_model,
            )
            payload = self._parse_json(str(response.choices[0].message.content or ""))
            if payload:
                return payload
        except Exception as exc:
            logger.info("react_conversation_agent.step_failed", error=repr(exc))
        calls = self._fallback_action(query, course_id=course_id)
        if calls:
            return {
                "thought": "这个问题需要先调用工具获得可靠信息。",
                "action": calls[0].model_dump(),
                "final_answer": None,
            }
        return {"thought": "这个问题不需要外部工具。", "action": None, "final_answer": ""}

    async def _compose_final_answer(
        self,
        query: str,
        trace: list[ReActTraceStep],
        tool_results: list[MCPToolResult],
    ) -> str:
        prompt = (
            "You are the Gang-Ke-Sai AI Tutor. Based on the ReAct trace, answer in concise Chinese with job, course, and competition mapping.\n"
            "Do not expose hidden chain-of-thought. Summarize only the useful result.\n\n"
            f"Question: {query}\n"
            f"Trace: {json.dumps([step.model_dump() for step in trace], ensure_ascii=False)[:9000]}\n"
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
            logger.info("react_conversation_agent.compose_failed", error=repr(exc))

        for result in tool_results:
            if result.ok and result.result.get("answer_text"):
                return str(result.result["answer_text"])
        return "我已经完成工具查询，但没有拿到足够明确的结果。你可以把目标再说具体一点。"

    @staticmethod
    def _fallback_action(query: str, *, course_id: int | None) -> list[MCPToolCall]:
        lowered = query.lower()
        normalized = re.sub(r"\s+", "", query)
        if re.search(r"https?://", query):
            match = re.search(r"https?://\S+", query)
            return [MCPToolCall(tool_name="web_fetch", arguments={"url": match.group(0)})] if match else []
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
    def _parse_json(text: str) -> dict[str, Any]:
        match = re.search(r"\{.*\}", text, re.S)
        if not match:
            return {}
        try:
            return json.loads(match.group(0))
        except Exception:
            return {}

    @staticmethod
    def _extract_reference_sources(tool_results: list[MCPToolResult]) -> list[dict[str, Any]]:
        sources: list[dict[str, Any]] = []
        for result in tool_results:
            if not result.ok:
                continue
            direct = result.result.get("reference_sources")
            if isinstance(direct, list):
                sources.extend(item for item in direct if isinstance(item, dict))
            items = result.result.get("items")
            if isinstance(items, list):
                sources.extend(
                    {
                        "source_type": "web",
                        "title": str(item.get("title") or ""),
                        "url": str(item.get("url") or ""),
                        "excerpt": str(item.get("snippet") or ""),
                    }
                    for item in items
                    if isinstance(item, dict)
                )
        return sources
