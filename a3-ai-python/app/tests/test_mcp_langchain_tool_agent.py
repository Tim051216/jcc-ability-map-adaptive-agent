from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.agents.langchain_tool_agent import LangChainToolCallingAgent
from app.agents.react_conversation_agent import ReActConversationAgent
from app.schemas.mcp_tools import MCPToolCall
from app.services.mcp_tool_runtime import MCPToolRegistry


def test_mcp_registry_exposes_schema_and_langchain_tools() -> None:
    registry = MCPToolRegistry()

    specs = registry.list_specs()
    langchain_tools = registry.list_langchain_tools()

    names = {spec.name for spec in specs}
    assert {"local_time", "weather", "web_search", "web_fetch", "course_knowledge_search"} <= names
    assert {tool.name for tool in langchain_tools} == names
    assert all(spec.input_schema.get("properties") for spec in specs)


@pytest.mark.asyncio
async def test_mcp_registry_invokes_tool() -> None:
    registry = MCPToolRegistry()

    result = await registry.invoke(
        MCPToolCall(tool_name="local_time", arguments={"query": "现在几点"})
    )

    assert result.ok
    assert result.tool_name == "local_time"
    assert result.result.get("answer_text")


@pytest.mark.asyncio
async def test_langchain_tool_agent_executes_llm_planned_tool(monkeypatch) -> None:
    registry = MCPToolRegistry()

    async def fake_invoke(call: MCPToolCall):
        from app.schemas.mcp_tools import MCPToolResult

        return MCPToolResult(
            tool_name=call.tool_name,
            ok=True,
            result={
                "answer_text": "现在是 2026-07-26 11:00。",
                "reference_sources": [{"source_type": "system", "title": "Local clock"}],
            },
        )

    monkeypatch.setattr(registry, "invoke", fake_invoke)

    class FakeLLM:
        async def chat_completion(self, messages, **kwargs):
            content = str(messages[0]["content"])
            if "tool_calls" in content:
                return SimpleNamespace(
                    choices=[
                        SimpleNamespace(
                            message=SimpleNamespace(
                                content='{"tool_calls":[{"tool_name":"local_time","arguments":{"query":"现在几点"}}]}'
                            )
                        )
                    ]
                )
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content="现在是 2026-07-26 11:00。"))]
            )

    agent = LangChainToolCallingAgent(registry=registry)
    agent.llm_client = FakeLLM()

    response = await agent.run("现在几点")

    assert response is not None
    assert response.tool_calls[0].tool_name == "local_time"
    assert response.tool_results[0].ok
    assert "2026" in response.answer_text


@pytest.mark.asyncio
async def test_langchain_tool_agent_falls_back_to_rule_plan(monkeypatch) -> None:
    registry = MCPToolRegistry()

    async def fake_invoke(call: MCPToolCall):
        from app.schemas.mcp_tools import MCPToolResult

        return MCPToolResult(
            tool_name=call.tool_name,
            ok=True,
            result={"answer_text": "当前本地时间可用。", "reference_sources": []},
        )

    monkeypatch.setattr(registry, "invoke", fake_invoke)

    class BrokenLLM:
        async def chat_completion(self, messages, **kwargs):
            raise RuntimeError("model unavailable")

    agent = LangChainToolCallingAgent(registry=registry)
    agent.llm_client = BrokenLLM()

    response = await agent.run("现在几点")

    assert response is not None
    assert response.tool_calls[0].tool_name == "local_time"
    assert response.answer_text == "当前本地时间可用。"


@pytest.mark.asyncio
async def test_react_conversation_agent_records_thought_action_observation_final(monkeypatch) -> None:
    registry = MCPToolRegistry()

    async def fake_invoke(call: MCPToolCall):
        from app.schemas.mcp_tools import MCPToolResult

        return MCPToolResult(
            tool_name=call.tool_name,
            ok=True,
            result={
                "answer_text": "现在是 2026-07-26 11:30。",
                "reference_sources": [{"source_type": "system", "title": "Local clock"}],
            },
        )

    monkeypatch.setattr(registry, "invoke", fake_invoke)

    class FakeLLM:
        def __init__(self) -> None:
            self.calls = 0

        async def chat_completion(self, messages, **kwargs):
            self.calls += 1
            if self.calls == 1:
                return SimpleNamespace(
                    choices=[
                        SimpleNamespace(
                            message=SimpleNamespace(
                                content=(
                                    '{"thought":"需要查询当前时间。",'
                                    '"action":{"tool_name":"local_time","arguments":{"query":"现在几点"}},'
                                    '"final_answer":null}'
                                )
                            )
                        )
                    ]
                )
            if self.calls == 2:
                return SimpleNamespace(
                    choices=[
                        SimpleNamespace(
                            message=SimpleNamespace(
                                content='{"thought":"观察结果已经足够。","action":null,"final_answer":"现在是 2026-07-26 11:30。"}'
                            )
                        )
                    ]
                )
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content="现在是 2026-07-26 11:30。"))]
            )

    agent = ReActConversationAgent(registry=registry)
    agent.llm_client = FakeLLM()

    response = await agent.run("现在几点")

    assert response is not None
    assert response.agent_mode == "react"
    assert [step.step_type for step in response.react_trace] == [
        "thought",
        "action",
        "observation",
        "thought",
        "final",
    ]
    assert response.tool_calls[0].tool_name == "local_time"
    assert "2026" in response.answer_text


def test_react_conversation_agent_builds_native_react_executor() -> None:
    agent = ReActConversationAgent()

    assert agent.agent_executor_kind in {"langchain_react_agent_executor", "react_json_loop"}
    assert len(agent.langchain_tools) >= 5
