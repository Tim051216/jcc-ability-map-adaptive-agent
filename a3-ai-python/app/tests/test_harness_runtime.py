import asyncio
import json
from pathlib import Path

import pytest
from starlette.requests import Request
from starlette.responses import Response

from app.harness.runtime import emit, read_trace, run_scope, span
from app.integrations.llm.client import LLMClient
from app.main import harness_request_context
from app.services.agent_runtime_logging_service import AgentRuntimeLoggingService


@pytest.mark.asyncio
async def test_run_scope_records_nested_spans_and_redacts_secrets(tmp_path: Path) -> None:
    async with run_scope(
        kind="test",
        input_data={"question_text": "hello", "api_key": "hidden"},
        run_id="run-1",
        trace_dir=tmp_path,
    ):
        async with span("agent", attributes={"token": "hidden"}):
            emit("agent_output", output={"answer_text": "world"})

    events = read_trace(tmp_path / "run-1.jsonl")
    assert [event["seq"] for event in events] == list(range(1, len(events) + 1))
    assert events[0]["input"]["api_key"] == "[REDACTED]"
    started = next(event for event in events if event["event"] == "span_started")
    assert started["attributes"]["token"] == "[REDACTED]"
    assert events[-1]["event"] == "run_finished"


@pytest.mark.asyncio
async def test_failed_run_is_replayable_and_records_error(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError):
        async with run_scope(
            kind="test",
            input_data={"question_text": "hello"},
            run_id="run-2",
            trace_dir=tmp_path,
        ):
            raise RuntimeError("failed")

    events = [json.loads(line) for line in (tmp_path / "run-2.jsonl").read_text().splitlines()]
    assert events[-1]["event"] == "run_failed"
    assert events[-1]["error_type"] == "RuntimeError"


@pytest.mark.asyncio
async def test_production_trace_redacts_replay_content(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("A3_HARNESS_CAPTURE_CONTENT", raising=False)
    async with run_scope(
        kind="test",
        input_data={"question_text": "private question"},
        run_id="run-3",
        trace_dir=tmp_path,
    ):
        emit("agent_output", output={"answer_text": "private answer"})

    events = read_trace(tmp_path / "run-3.jsonl")
    assert events[0]["input"]["question_text"]["redacted"] is True
    answer = next(event for event in events if event["event"] == "agent_output")
    assert answer["output"]["answer_text"]["redacted"] is True


@pytest.mark.asyncio
async def test_runtime_database_log_receives_harness_run_id(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = {}

    async def fake_write_log(self, **kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(AgentRuntimeLoggingService, "_write_log", fake_write_log)
    async with run_scope(
        kind="test",
        input_data={"question_text": "hello"},
        run_id="correlated-run",
        trace_dir=tmp_path,
    ):
        await AgentRuntimeLoggingService().log(
            agent_name="test_agent",
            status="ok",
            message="done",
        )

    assert captured["payload"]["harness_run_id"] == "correlated-run"


@pytest.mark.asyncio
async def test_llm_client_honors_call_site_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class SlowProvider:
        async def generate(self, *args, **kwargs):
            await asyncio.sleep(0.05)
            return "late"

    monkeypatch.setattr("app.integrations.llm.client.get_llm_provider", lambda: SlowProvider())
    with pytest.raises(TimeoutError):
        await LLMClient().chat_completion(
            [{"role": "user", "content": "hello"}],
            timeout=0.001,
        )


@pytest.mark.asyncio
async def test_http_middleware_exposes_agent_run_id(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("A3_HARNESS_TRACE_DIR", str(tmp_path))
    request = Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/api/v1/chat",
            "raw_path": b"/api/v1/chat",
            "query_string": b"",
            "headers": [],
            "client": ("127.0.0.1", 1234),
            "server": ("test", 80),
        }
    )

    async def call_next(_request):
        return Response(status_code=200)

    response = await harness_request_context(request, call_next)
    run_id = response.headers["X-Agent-Run-Id"]
    events = read_trace(tmp_path / f"{run_id}.jsonl")
    assert events[0]["event"] == "run_started"
    assert any(event["event"] == "http_response" for event in events)
