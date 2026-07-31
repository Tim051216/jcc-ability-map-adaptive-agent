from __future__ import annotations

from fastapi import APIRouter

from app.agents.langchain_tool_agent import LangChainToolCallingAgent
from app.agents.react_conversation_agent import ReActConversationAgent
from app.schemas.mcp_tools import (
    MCPAgentRequest,
    MCPAgentResponse,
    MCPInvokeRequest,
    MCPToolCall,
    MCPToolResult,
    MCPToolSpec,
)
from app.services.mcp_tool_runtime import MCPToolRegistry

router = APIRouter()


@router.get("/tools", response_model=list[MCPToolSpec])
async def list_tools() -> list[MCPToolSpec]:
    return MCPToolRegistry().list_specs()


@router.post("/invoke", response_model=MCPToolResult)
async def invoke_tool(request: MCPInvokeRequest) -> MCPToolResult:
    return await MCPToolRegistry().invoke(
        call=MCPToolCall(tool_name=request.tool_name, arguments=request.arguments)
    )


@router.post("/agent/run", response_model=MCPAgentResponse)
async def run_agent(request: MCPAgentRequest) -> MCPAgentResponse:
    result = await LangChainToolCallingAgent().run(
        request.query,
        course_id=request.course_id,
        user_profile=request.user_profile,
        max_tool_calls=request.max_tool_calls,
    )
    if result is not None:
        return result
    return MCPAgentResponse(
        answer_text="这个问题不需要调用外部工具，可以直接进入课程问答链路处理。",
        confidence_score=70.0,
    )


@router.post("/react/run", response_model=MCPAgentResponse)
async def run_react_agent(request: MCPAgentRequest) -> MCPAgentResponse:
    result = await ReActConversationAgent().run(
        request.query,
        course_id=request.course_id,
        user_profile=request.user_profile,
        max_steps=request.max_tool_calls,
    )
    if result is not None:
        return result
    return MCPAgentResponse(
        answer_text="这个问题不需要进入 ReAct 工具循环，可以直接回答。",
        agent_mode="react",
        confidence_score=70.0,
    )
