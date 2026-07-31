import json
import tempfile
import unittest
from pathlib import Path

from harness.evaluate import evaluate
from harness.run import _extract_output
from harness.trace import TraceRecorder


class HarnessTests(unittest.TestCase):
    def test_evaluator_reports_missing_and_forbidden_terms(self):
        result = evaluate(
            "只有输入，没有答案",
            {"must_contain": ["输出"], "must_not_contain": ["答案"]},
        )
        self.assertFalse(result.passed)
        self.assertEqual(result.score, 0.0)
        self.assertEqual(len(result.reasons), 2)

    def test_trace_redacts_secrets_and_is_jsonl(self):
        with tempfile.TemporaryDirectory() as directory:
            recorder = TraceRecorder(directory, run_id="test-run")
            recorder.record(
                "tool_called",
                api_key="do-not-write",
                nested={"password": "hidden"},
            )
            item = json.loads(
                Path(directory, "test-run.jsonl").read_text(encoding="utf-8")
            )
            self.assertEqual(item["api_key"], "[REDACTED]")
            self.assertEqual(item["nested"]["password"], "[REDACTED]")

    def test_http_adapter_extracts_supported_response_shapes(self):
        self.assertEqual(_extract_output({"answer": "ok"}), "ok")
        self.assertEqual(_extract_output("plain"), "plain")


if __name__ == "__main__":
    unittest.main()
