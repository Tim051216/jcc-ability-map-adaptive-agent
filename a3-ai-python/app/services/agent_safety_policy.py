from __future__ import annotations

from dataclasses import dataclass

from app.core.config import settings


@dataclass(frozen=True)
class AgentSafetyPolicy:
    """Three-layer control policy for Agent planning and MCP tool calls."""

    step_timeout_seconds: float = 12.0
    tool_timeout_seconds: float = 10.0
    max_steps: int = 4
    max_replans: int = 2
    tool_retry_attempts: int = 2
    retry_backoff_ms: int = 250
    retry_backoff_multiplier: float = 2.0

    @classmethod
    def from_settings(cls) -> "AgentSafetyPolicy":
        return cls(
            step_timeout_seconds=float(settings.agent_step_timeout_seconds),
            tool_timeout_seconds=float(settings.mcp_tool_timeout_seconds),
            max_steps=int(settings.agent_max_steps),
            max_replans=int(settings.agent_max_replans),
            tool_retry_attempts=int(settings.mcp_tool_retry_attempts),
            retry_backoff_ms=int(settings.mcp_tool_retry_backoff_ms),
            retry_backoff_multiplier=float(settings.mcp_tool_retry_backoff_multiplier),
        )

    def clamp_steps(self, requested: int | None = None) -> int:
        value = self.max_steps if requested is None else int(requested)
        return max(1, min(value, self.max_steps))

    def backoff_seconds(self, attempt_index: int) -> float:
        multiplier = self.retry_backoff_multiplier ** max(attempt_index, 0)
        return (self.retry_backoff_ms * multiplier) / 1000.0
