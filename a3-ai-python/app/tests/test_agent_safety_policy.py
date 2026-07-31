from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from app.agents.react_conversation_agent import ReActConversationAgent
from app.schemas.mcp_tools import MCPToolCall, MCPToolResult
from app.services.agent_safety_policy import AgentSafetyPolicy
from app.services.mcp_tool_runtime import MCPToolRegistry


@pytest.mark.asyncio
async def test_mcp_tool_runtime_retries_with_backoff(monkeypatch) -> None:
    policy = AgentSafetyPolicy(
        tool_timeout_seconds=1,
        tool_retry_attempts=2,
        retry_backoff_ms=1,
    )
    registry = MCPToolRegistry(safety_policy=policy)
    attempts = {"count": 0}

    async def flaky_handler(query: str = ""):
        attempts["count"] += 1
        if attempts["count"] == 1:
            raise RuntimeError("temporary failure")
        return {"answer_text": "ok"}

    registry._register(
        name="flaky_tool",
        description="Flaky test tool",
        fields={"query": (str, "")},
        handler=flaky_handler,
    )

    result = await registry.invoke(MCPToolCall(tool_name="flaky_tool", arguments={"query": "x"}))

    assert result.ok
    assert attempts["count"] == 2
    assert result.result["answer_text"] == "ok"


@pytest.mark.asyncio
async def test_mcp_tool_runtime_enforces_timeout() -> None:
    policy = AgentSafetyPolicy(
        tool_timeout_seconds=0.01,
        tool_retry_attempts=1,
        retry_backoff_ms=1,
    )
    registry = MCPToolRegistry(safety_policy=policy)

    async def slow_handler(query: str = ""):
        await asyncio.sleep(0.05)
        return {"answer_text": "too late"}

    registry._register(
        name="slow_tool",
        description="Slow test tool",
        fields={"query": (str, "")},
        handler=slow_handler,
    )

    result = await registry.invoke(MCPToolCall(tool_name="slow_tool", arguments={"query": "x"}))

    assert not result.ok
    assert "TimeoutError" in str(result.error)


@pytest.mark.asyncio
async def test_react_agent_limits_replans(monkeypatch) -> None:
    policy = AgentSafetyPolicy(
        step_timeout_seconds=1,
        tool_timeout_seconds=1,
        max_steps=5,
        max_replans=1,
        tool_retry_attempts=1,
    )
    registry = MCPToolRegistry(safety_policy=policy)

    async def fake_invoke(call: MCPToolCall):
        return MCPToolResult(tool_name=call.tool_name, ok=True, result={"answer_text": "ok"})

    monkeypatch.setattr(registry, "invoke", fake_invoke)

    class LoopingLLM:
        async def chat_completion(self, messages, **kwargs):
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(
                            content=(
                                '{"thought":"继续查工具。",'
                                '"action":{"tool_name":"local_time","arguments":{"query":"现在几点"}},'
                                '"final_answer":null}'
                            )
                        )
                    )
                ]
            )

    agent = ReActConversationAgent(registry=registry, safety_policy=policy)
    agent.llm_client = LoopingLLM()

    response = await agent.run("现在几点", max_steps=5)

    assert response is not None
    assert len(response.tool_calls) == 1
    assert any("Replan limit reached" in step.content for step in response.react_trace)


@pytest.mark.asyncio
async def test_react_agent_step_timeout_is_recorded() -> None:
    policy = AgentSafetyPolicy(
        step_timeout_seconds=0.01,
        tool_timeout_seconds=1,
        max_steps=2,
        max_replans=1,
        tool_retry_attempts=1,
    )

    class SlowLLM:
        async def chat_completion(self, messages, **kwargs):
            await asyncio.sleep(0.05)
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="{}"))])

    agent = ReActConversationAgent(safety_policy=policy)
    agent.llm_client = SlowLLM()

    response = await agent.run("现在几点", max_steps=2)

    assert response is not None
    assert any("timed out" in step.content for step in response.react_trace)
