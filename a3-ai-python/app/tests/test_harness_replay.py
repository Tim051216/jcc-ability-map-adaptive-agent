import json
from argparse import Namespace
from pathlib import Path

import pytest

from app.harness.cli import evaluate_suite, replay_spec


def test_replay_spec_restores_input_and_parent_run() -> None:
    events = [
        {
            "event": "run_started",
            "run_id": "original",
            "input": {"question_text": "什么是需求分析？", "course_id": 1},
            "metadata": {"case_id": "requirements"},
        }
    ]

    run_id, input_data, metadata = replay_spec(events)

    assert run_id == "original"
    assert input_data["question_text"] == "什么是需求分析？"
    assert metadata["case_id"] == "requirements"


@pytest.mark.asyncio
async def test_evaluate_suite_writes_report_and_failure_queue(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cases = tmp_path / "cases.jsonl"
    cases.write_text(
        json.dumps({"id": "case-1", "prompt": "question", "must_contain": ["missing"]}),
        encoding="utf-8",
    )

    async def fake_run(self, **kwargs):
        return {"answer_text": "answer", "confidence_score": 80, "reference_sources": []}

    async def fake_guardrails(output, input_data):
        output["harness_safety_review"] = {"output_review": {"blocked": False}}

    monkeypatch.setattr("app.harness.cli.TutoringCoordinator.run", fake_run)
    monkeypatch.setattr("app.harness.cli._apply_guardrails", fake_guardrails)
    report = tmp_path / "report.json"
    args = Namespace(
        cases=cases,
        output_dir=tmp_path / "output",
        report=report,
        required_pass_rate=1.0,
        baseline=None,
        max_score_regression=0.0,
    )

    exit_code = await evaluate_suite(args)

    payload = json.loads(report.read_text(encoding="utf-8"))
    assert exit_code == 1
    assert payload["pass_rate"] == 0.0
    assert (tmp_path / "output" / "failures.jsonl").exists()
