from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class MCPToolSpec(BaseModel):
    name: str
    description: str
    input_schema: dict[str, Any]


class MCPToolCall(BaseModel):
    tool_name: str
    arguments: dict[str, Any] = Field(default_factory=dict)


class MCPToolResult(BaseModel):
    tool_name: str
    ok: bool = True
    result: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None


class MCPToolPlan(BaseModel):
    tool_calls: list[MCPToolCall] = Field(default_factory=list)
    final_answer: str | None = None


class ReActTraceStep(BaseModel):
    step_type: str
    content: str = ""
    tool_name: str | None = None
    arguments: dict[str, Any] = Field(default_factory=dict)
    observation: dict[str, Any] = Field(default_factory=dict)


class MCPInvokeRequest(BaseModel):
    tool_name: str
    arguments: dict[str, Any] = Field(default_factory=dict)


class MCPAgentRequest(BaseModel):
    query: str
    course_id: int | None = None
    user_profile: dict[str, Any] | None = None
    max_tool_calls: int = Field(default=3, ge=1, le=6)


class MCPAgentResponse(BaseModel):
    answer_text: str
    tool_calls: list[MCPToolCall] = Field(default_factory=list)
    tool_results: list[MCPToolResult] = Field(default_factory=list)
    react_trace: list[ReActTraceStep] = Field(default_factory=list)
    agent_mode: str = "tool_calling"
    reference_sources: list[dict[str, Any]] = Field(default_factory=list)
    confidence_score: float = 90.0
