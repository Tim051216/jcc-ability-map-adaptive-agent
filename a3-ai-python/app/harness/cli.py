from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.agents.tutoring_coordinator import TutoringCoordinator
from app.harness.evaluation import evaluate_run
from app.harness.runtime import emit, read_trace, run_scope
from app.services.guardrail_service import GuardrailContext, GuardrailService


def _load_cases(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]


def _append_jsonl(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(payload, ensure_ascii=True, sort_keys=True) + "\n")


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=True, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def _input_from_case(case: dict[str, Any]) -> dict[str, Any]:
    return {
        "question_text": str(case["prompt"]),
        "question_images": case.get("question_images") or [],
        "course_id": case.get("course_id"),
        "user_profile": case.get("user_profile"),
        "persona": case.get("persona"),
        "conversation_context": case.get("conversation_context"),
    }


def replay_spec(events: list[dict[str, Any]]) -> tuple[str, dict[str, Any], dict[str, Any]]:
    started = next((event for event in events if event.get("event") == "run_started"), None)
    if started is None:
        raise ValueError("trace does not contain run_started")
    input_data = dict(started.get("input") or {})
    metadata = dict(started.get("metadata") or {})
    run_id = str(started.get("run_id") or "")
    if not input_data.get("question_text"):
        nested = next((event for event in events if event.get("event") == "nested_run"), None)
        input_data = dict((nested or {}).get("input") or input_data)
    if not input_data.get("question_text"):
        raise ValueError("trace does not contain a tutoring question")
    return run_id, input_data, metadata


async def _apply_guardrails(output: dict[str, Any], input_data: dict[str, Any]) -> None:
    sources = output.get("reference_sources") or []
    citations = [
        " ".join(
            str(source.get(key) or "")
            for key in ("title", "excerpt", "url")
            if source.get(key)
        )
        for source in sources
        if isinstance(source, dict)
    ]
    review = await GuardrailService().review_output(
        str(output.get("answer_text") or ""),
        context=GuardrailContext(
            scene="harness_tutoring",
            course_id=input_data.get("course_id"),
            citations=citations,
        ),
        citations=citations,
    )
    output["harness_safety_review"] = {
        "output_review": (
            review.output_review.model_dump(mode="json") if review.output_review else None
        ),
        "hallucination_review": (
            review.hallucination_review.model_dump(mode="json")
            if review.hallucination_review
            else None
        ),
    }
    emit("guardrail_result", review=output["harness_safety_review"])


async def evaluate_suite(args: argparse.Namespace) -> int:
    cases = _load_cases(args.cases)
    trace_dir = args.output_dir / "traces"
    failure_file = args.output_dir / "failures.jsonl"
    results: list[dict[str, Any]] = []

    for case in cases:
        case_id = str(case["id"])
        run_id = uuid.uuid4().hex
        input_data = _input_from_case(case)
        try:
            async with run_scope(
                kind="tutoring_eval",
                input_data=input_data,
                run_id=run_id,
                metadata={"case_id": case_id, "criteria": case},
                trace_dir=trace_dir,
            ) as recorder:
                output = await TutoringCoordinator().run(**input_data)
                await _apply_guardrails(output, input_data)
                events = read_trace(recorder.path)
                evaluation = evaluate_run(case, output, events)
                emit("evaluation_completed", case_id=case_id, evaluation=evaluation.model_dump())
            events = read_trace(recorder.path)
            latency_ms = max(float(event.get("elapsed_ms") or 0) for event in events)
            item = {
                "case_id": case_id,
                "run_id": run_id,
                "passed": evaluation.passed,
                "score": evaluation.score,
                "latency_ms": round(latency_ms, 3),
                "trace": str(recorder.path),
                "checks": evaluation.model_dump()["checks"],
            }
            results.append(item)
            if not evaluation.passed:
                _append_jsonl(
                    failure_file,
                    {
                        "captured_at": datetime.now(timezone.utc).isoformat(),
                        "case": case,
                        "run_id": run_id,
                        "output": output,
                        "evaluation": evaluation.model_dump(),
                        "trace": str(recorder.path),
                    },
                )
            label = "PASS" if evaluation.passed else "FAIL"
            print(f"{label} {case_id} score={evaluation.score:.3f}")
        except Exception as exc:
            item = {
                "case_id": case_id,
                "run_id": run_id,
                "passed": False,
                "score": 0.0,
                "error": f"{type(exc).__name__}: {exc}",
                "trace": str(trace_dir / f"{run_id}.jsonl"),
            }
            results.append(item)
            _append_jsonl(
                failure_file,
                {
                    "captured_at": datetime.now(timezone.utc).isoformat(),
                    "case": case,
                    **item,
                },
            )
            print(f"FAIL {case_id} error={exc}")

    scores = [float(item["score"]) for item in results]
    latencies = [float(item["latency_ms"]) for item in results if "latency_ms" in item]
    passed_count = sum(bool(item["passed"]) for item in results)
    report = {
        "schema_version": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "suite": str(args.cases),
        "total": len(results),
        "passed": passed_count,
        "pass_rate": passed_count / len(results) if results else 0.0,
        "mean_score": statistics.fmean(scores) if scores else 0.0,
        "max_latency_ms": max(latencies) if latencies else None,
        "results": results,
    }
    baseline_ok = True
    if args.baseline:
        baseline = json.loads(args.baseline.read_text(encoding="utf-8"))
        baseline_score = float(baseline.get("mean_score") or 0)
        score_delta = float(report["mean_score"]) - baseline_score
        report["baseline"] = {
            "path": str(args.baseline),
            "mean_score": baseline_score,
            "score_delta": round(score_delta, 4),
        }
        baseline_ok = score_delta >= -float(args.max_score_regression)
    _write_json(args.report, report)
    required = float(args.required_pass_rate)
    return 0 if report["pass_rate"] >= required and baseline_ok else 1


async def replay(args: argparse.Namespace) -> int:
    events = read_trace(args.trace)
    original_run_id, input_data, metadata = replay_spec(events)
    original_output_event = next(
        (event for event in reversed(events) if event.get("event") == "agent_output"),
        {},
    )
    original_output = dict(original_output_event.get("output") or {})
    replay_run_id = uuid.uuid4().hex
    trace_dir = args.output_dir / "traces"
    async with run_scope(
        kind="tutoring_replay",
        input_data=input_data,
        run_id=replay_run_id,
        parent_run_id=original_run_id,
        metadata={"replay_of": original_run_id, **metadata},
        trace_dir=trace_dir,
    ) as recorder:
        output = await TutoringCoordinator().run(**input_data)
        await _apply_guardrails(output, input_data)
        emit(
            "replay_comparison",
            original_run_id=original_run_id,
            answer_changed=output.get("answer_text") != original_output.get("answer_text"),
            original_confidence=original_output.get("confidence_score"),
            replay_confidence=output.get("confidence_score"),
        )
        criteria = metadata.get("criteria")
        if isinstance(criteria, dict):
            evaluation = evaluate_run(criteria, output, read_trace(recorder.path))
            emit("evaluation_completed", evaluation=evaluation.model_dump())
            passed = evaluation.passed
        else:
            passed = bool(output.get("answer_text"))
    print(f"REPLAY {'PASS' if passed else 'FAIL'} run_id={replay_run_id} parent={original_run_id}")
    return 0 if passed else 1


def promote_failures(args: argparse.Namespace) -> int:
    existing = _load_cases(args.output) if args.output.exists() else []
    seen = {str(case.get("id")) for case in existing}
    promoted = 0
    for line in args.failures.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        failure = json.loads(line)
        case = dict(failure.get("case") or {})
        case_id = str(case.get("id") or "")
        if not case_id or case_id in seen:
            continue
        case["candidate_source_run_id"] = failure.get("run_id")
        _append_jsonl(args.output, case)
        seen.add(case_id)
        promoted += 1
    print(f"PROMOTED {promoted} candidate cases to {args.output}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="A3 production Agent Harness")
    subparsers = parser.add_subparsers(dest="command", required=True)

    eval_parser = subparsers.add_parser("eval", help="execute and evaluate real tutoring agents")
    eval_parser.add_argument("--cases", type=Path, required=True)
    eval_parser.add_argument("--output-dir", type=Path, default=Path(".runtime/harness"))
    eval_parser.add_argument("--report", type=Path, default=Path(".runtime/harness/report.json"))
    eval_parser.add_argument("--required-pass-rate", type=float, default=1.0)
    eval_parser.add_argument("--baseline", type=Path)
    eval_parser.add_argument("--max-score-regression", type=float, default=0.0)

    replay_parser = subparsers.add_parser("replay", help="re-execute a recorded tutoring run")
    replay_parser.add_argument("--trace", type=Path, required=True)
    replay_parser.add_argument("--output-dir", type=Path, default=Path(".runtime/harness"))

    promote_parser = subparsers.add_parser("promote", help="build a reviewable candidate suite")
    promote_parser.add_argument("--failures", type=Path, required=True)
    promote_parser.add_argument("--output", type=Path, required=True)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.command == "eval":
        return asyncio.run(evaluate_suite(args))
    if args.command == "replay":
        return asyncio.run(replay(args))
    return promote_failures(args)


if __name__ == "__main__":
    sys.exit(main())
