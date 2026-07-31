from __future__ import annotations

import hashlib
import json
import os
import re
import time
import uuid
from contextlib import asynccontextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncIterator

_SECRET_KEY = re.compile(
    r"(authorization|cookie|password|secret|token|api[_-]?key|access[_-]?key)",
    re.I,
)
_CONTENT_KEYS = {
    "answer_text",
    "conversation_context",
    "prompt",
    "question_images",
    "question_text",
    "user_profile",
}
_current_recorder: ContextVar[RunRecorder | None] = ContextVar(
    "a3_harness_recorder",
    default=None,
)
_span_stack: ContextVar[tuple[str, ...]] = ContextVar("a3_harness_span_stack", default=())


def _sanitize(value: Any, *, depth: int = 0) -> Any:
    if depth > 8:
        return "[MAX_DEPTH]"
    if isinstance(value, dict):
        return {
            str(key): (
                "[REDACTED]"
                if _SECRET_KEY.search(str(key))
                else _sanitize(item, depth=depth + 1)
            )
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [_sanitize(item, depth=depth + 1) for item in value[:100]]
    if isinstance(value, str):
        return value if len(value) <= 12000 else value[:12000] + "...[TRUNCATED]"
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if hasattr(value, "model_dump"):
        return _sanitize(value.model_dump(mode="json"), depth=depth + 1)
    return str(value)


def runtime_snapshot() -> dict[str, Any]:
    from app.core.config import settings

    prompt_version = os.getenv("A3_PROMPT_VERSION", "unversioned")
    snapshot = {
        "app_version": os.getenv("APP_VERSION", "dev"),
        "prompt_version": prompt_version,
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
        "llm_fast_model": settings.llm_fast_model,
        "guardrails_enabled": settings.guardrails_enabled,
        "agent_max_steps": settings.agent_max_steps,
        "agent_max_replans": settings.agent_max_replans,
        "tool_timeout_seconds": settings.mcp_tool_timeout_seconds,
        "tool_retry_attempts": settings.mcp_tool_retry_attempts,
    }
    encoded = json.dumps(snapshot, sort_keys=True, ensure_ascii=True).encode("utf-8")
    snapshot["snapshot_sha256"] = hashlib.sha256(encoded).hexdigest()
    return snapshot


@dataclass
class RunRecorder:
    run_id: str
    trace_dir: Path
    parent_run_id: str | None = None
    started_monotonic: float = field(default_factory=time.perf_counter)
    sequence: int = 0
    capture_content: bool = True

    @property
    def path(self) -> Path:
        return self.trace_dir / f"{self.run_id}.jsonl"

    def record(self, event: str, **data: Any) -> dict[str, Any]:
        self.trace_dir.mkdir(parents=True, exist_ok=True)
        self.sequence += 1
        stack = _span_stack.get()
        sanitized = _sanitize(data)
        if not self.capture_content:
            sanitized = _remove_content(sanitized)
        item = {
            "schema_version": 1,
            "seq": self.sequence,
            "ts": datetime.now(timezone.utc).isoformat(),
            "elapsed_ms": round((time.perf_counter() - self.started_monotonic) * 1000, 3),
            "run_id": self.run_id,
            "parent_run_id": self.parent_run_id,
            "span_id": stack[-1] if stack else None,
            "parent_span_id": stack[-2] if len(stack) > 1 else None,
            "event": event,
            **sanitized,
        }
        with self.path.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(item, sort_keys=True, ensure_ascii=True) + "\n")
        return item


def _default_trace_dir() -> Path:
    configured = os.getenv("A3_HARNESS_TRACE_DIR", "").strip()
    return Path(configured) if configured else Path(".runtime/harness/traces")


def _capture_content_enabled() -> bool:
    configured = os.getenv("A3_HARNESS_CAPTURE_CONTENT", "").strip().lower()
    if configured:
        return configured in {"1", "true", "yes", "on"}
    return os.getenv("APP_ENV", "local").strip().lower() in {"local", "dev", "test"}


def _remove_content(value: Any) -> Any:
    if isinstance(value, dict):
        filtered: dict[str, Any] = {}
        for key, item in value.items():
            if key in _CONTENT_KEYS:
                encoded = json.dumps(item, sort_keys=True, ensure_ascii=True).encode("utf-8")
                filtered[key] = {
                    "redacted": True,
                    "sha256": hashlib.sha256(encoded).hexdigest(),
                    "bytes": len(encoded),
                }
            else:
                filtered[key] = _remove_content(item)
        return filtered
    if isinstance(value, list):
        return [_remove_content(item) for item in value]
    return value


def _prune_traces(trace_dir: Path) -> None:
    maximum = max(10, int(os.getenv("A3_HARNESS_MAX_TRACE_FILES", "500")))
    trace_dir.mkdir(parents=True, exist_ok=True)
    traces = sorted(trace_dir.glob("*.jsonl"), key=lambda path: path.stat().st_mtime)
    for path in traces[: max(0, len(traces) - maximum + 1)]:
        path.unlink(missing_ok=True)


def get_current_recorder() -> RunRecorder | None:
    return _current_recorder.get()


def get_current_run_id() -> str | None:
    recorder = get_current_recorder()
    return recorder.run_id if recorder else None


def emit(event: str, **data: Any) -> dict[str, Any] | None:
    recorder = get_current_recorder()
    return recorder.record(event, **data) if recorder else None


@asynccontextmanager
async def run_scope(
    *,
    kind: str,
    input_data: dict[str, Any],
    run_id: str | None = None,
    parent_run_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    trace_dir: str | os.PathLike[str] | None = None,
) -> AsyncIterator[RunRecorder]:
    active = get_current_recorder()
    if active is not None:
        active.record("nested_run", kind=kind, input=input_data, metadata=metadata or {})
        yield active
        return

    recorder = RunRecorder(
        run_id=run_id or uuid.uuid4().hex,
        trace_dir=Path(trace_dir) if trace_dir else _default_trace_dir(),
        parent_run_id=parent_run_id,
        capture_content=_capture_content_enabled(),
    )
    _prune_traces(recorder.trace_dir)
    recorder.path.unlink(missing_ok=True)
    recorder.record(
        "run_started",
        kind=kind,
        input=input_data,
        metadata=metadata or {},
        runtime=runtime_snapshot(),
    )
    recorder_token = _current_recorder.set(recorder)
    stack_token = _span_stack.set(())
    try:
        yield recorder
    except Exception as exc:
        recorder.record(
            "run_failed",
            error_type=type(exc).__name__,
            error=str(exc),
        )
        raise
    else:
        recorder.record("run_finished", status="completed")
    finally:
        _span_stack.reset(stack_token)
        _current_recorder.reset(recorder_token)


@asynccontextmanager
async def span(
    name: str,
    *,
    kind: str = "agent",
    attributes: dict[str, Any] | None = None,
) -> AsyncIterator[None]:
    recorder = get_current_recorder()
    if recorder is None:
        yield
        return

    span_id = uuid.uuid4().hex[:16]
    stack = _span_stack.get()
    token = _span_stack.set((*stack, span_id))
    started = time.perf_counter()
    recorder.record(
        "span_started",
        name=name,
        kind=kind,
        attributes=attributes or {},
    )
    try:
        yield
    except Exception as exc:
        recorder.record(
            "span_failed",
            name=name,
            kind=kind,
            duration_ms=round((time.perf_counter() - started) * 1000, 3),
            error_type=type(exc).__name__,
            error=str(exc),
        )
        raise
    else:
        recorder.record(
            "span_finished",
            name=name,
            kind=kind,
            duration_ms=round((time.perf_counter() - started) * 1000, 3),
        )
    finally:
        _span_stack.reset(token)


def read_trace(path: str | os.PathLike[str]) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in Path(path).read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
