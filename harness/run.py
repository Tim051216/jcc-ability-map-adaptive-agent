"""Run Harness cases against an offline adapter or an HTTP JSON endpoint."""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

from .evaluate import evaluate
from .trace import TraceRecorder


def _request_json(
    url: str,
    *,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> Any:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={"Content-Type": "application/json", **(headers or {})},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def _extract_output(payload: Any) -> str:
    if isinstance(payload, str):
        return payload
    for key in ("answer", "response", "content", "text", "message"):
        if isinstance(payload, dict) and key in payload:
            return str(payload[key])
    return json.dumps(payload, ensure_ascii=False)


def _http_call(endpoint: str, prompt: str) -> str:
    return _extract_output(
        _request_json(endpoint, method="POST", payload={"prompt": prompt})
    )


def _a3_tutor_call(
    base_url: str,
    prompt: str,
    case: dict[str, Any],
    *,
    user_id: str,
    token: str | None,
    timeout_seconds: float,
) -> str:
    headers = {"X-User-Id": user_id}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    root = base_url.rstrip("/")
    submitted = _request_json(
        f"{root}/api/v1/tutoring/tasks",
        method="POST",
        headers=headers,
        payload={
            "question_text": prompt,
            "question_images": [],
            "course_id": case.get("course_id"),
            "section_id": case.get("section_id"),
            "session_id": None,
            "persona": case.get("persona"),
        },
    )
    task_id = submitted["task_id"]
    interval = max(0.2, float(submitted.get("poll_interval_ms", 1000)) / 1000)
    deadline = time.monotonic() + timeout_seconds

    while time.monotonic() < deadline:
        status = _request_json(
            f"{root}/api/v1/tutoring/tasks/{task_id}",
            headers=headers,
        )
        state = status.get("status")
        if state == "completed":
            return str((status.get("result") or {}).get("answer_text") or "")
        if state in {"failed", "escalated"}:
            raise RuntimeError(status.get("error_message") or f"task {state}")
        time.sleep(interval)
    raise TimeoutError(f"tutoring task {task_id} exceeded {timeout_seconds:.0f}s")


def run(
    cases_path: Path,
    adapter: str,
    endpoint: str | None,
    base_url: str,
    user_id: str,
    token: str | None,
    timeout_seconds: float,
    output_dir: Path,
) -> int:
    recorder = TraceRecorder(output_dir)
    failures = 0
    recorder.record("run_started", cases=str(cases_path), adapter=adapter)

    for line in cases_path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        case: dict[str, Any] = json.loads(line)
        case_id = str(case["id"])
        prompt = str(case["prompt"])
        recorder.record("task_started", task_id=case_id, prompt=prompt)
        try:
            if adapter == "offline":
                output = prompt
            elif adapter == "http":
                if not endpoint:
                    raise ValueError("--endpoint is required for the http adapter")
                output = _http_call(endpoint, prompt)
            else:
                output = _a3_tutor_call(
                    base_url,
                    prompt,
                    case,
                    user_id=user_id,
                    token=token,
                    timeout_seconds=timeout_seconds,
                )
            result = evaluate(output, case)
            recorder.record(
                "task_finished",
                task_id=case_id,
                output=output,
                passed=result.passed,
                score=result.score,
                reasons=result.reasons,
            )
            print(f"{'PASS' if result.passed else 'FAIL'} {case_id} score={result.score:.2f}")
            failures += int(not result.passed)
        except Exception as exc:  # A failed case must remain visible in the trace.
            recorder.record("task_failed", task_id=case_id, error=str(exc))
            print(f"FAIL {case_id} error={exc}")
            failures += 1

    recorder.record("run_finished", failures=failures)
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Run A3 Agent Harness cases")
    parser.add_argument(
        "--adapter",
        choices=("offline", "http", "a3-tutor"),
        default="offline",
    )
    parser.add_argument(
        "--cases",
        type=Path,
        default=Path("harness/cases/smoke.jsonl"),
    )
    parser.add_argument(
        "--endpoint",
        help="Optional HTTP endpoint accepting a JSON object with a prompt field",
    )
    parser.add_argument("--base-url", default="http://127.0.0.1:18080")
    parser.add_argument("--user-id", default="1001")
    parser.add_argument("--token", help="Optional bearer token for the A3 adapter")
    parser.add_argument("--timeout", type=float, default=120.0)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("harness/artifacts"),
    )
    args = parser.parse_args()
    return run(
        args.cases,
        args.adapter,
        args.endpoint,
        args.base_url,
        args.user_id,
        args.token,
        args.timeout,
        args.output_dir,
    )


if __name__ == "__main__":
    sys.exit(main())
