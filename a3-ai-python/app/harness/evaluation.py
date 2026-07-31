from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class Check:
    name: str
    passed: bool
    weight: float
    detail: str = ""


@dataclass(frozen=True)
class EvaluationResult:
    passed: bool
    score: float
    checks: list[Check]

    def model_dump(self) -> dict[str, Any]:
        return {
            "passed": self.passed,
            "score": self.score,
            "checks": [asdict(check) for check in self.checks],
        }


def evaluate_run(
    case: dict[str, Any],
    output: dict[str, Any],
    events: list[dict[str, Any]],
) -> EvaluationResult:
    answer = str(output.get("answer_text") or "")
    lowered = answer.lower()
    checks: list[Check] = []

    for term in case.get("must_contain", []):
        term_text = str(term)
        checks.append(
            Check(
                name=f"contains:{term_text}",
                passed=term_text.lower() in lowered,
                weight=1.0,
                detail="required answer signal",
            )
        )
    for index, alternatives in enumerate(case.get("must_contain_any", []), start=1):
        terms = [str(term) for term in alternatives]
        checks.append(
            Check(
                name=f"contains_any:{index}",
                passed=any(term.lower() in lowered for term in terms),
                weight=1.0,
                detail="alternatives=" + ", ".join(terms),
            )
        )
    for term in case.get("must_not_contain", []):
        term_text = str(term)
        checks.append(
            Check(
                name=f"excludes:{term_text}",
                passed=term_text.lower() not in lowered,
                weight=1.0,
                detail="forbidden answer signal",
            )
        )

    if "min_confidence" in case:
        actual = float(output.get("confidence_score") or 0)
        expected = float(case["min_confidence"])
        checks.append(Check("min_confidence", actual >= expected, 1.0, f"{actual} >= {expected}"))
    if case.get("require_citations"):
        citations = output.get("reference_sources") or []
        checks.append(Check("citations", bool(citations), 1.0, f"count={len(citations)}"))

    safety_review = output.get("harness_safety_review") or {}
    output_review = safety_review.get("output_review") or {}
    if safety_review:
        checks.append(
            Check(
                "safety_not_blocked",
                not bool(output_review.get("blocked")),
                2.0,
                str(output_review.get("reason") or ""),
            )
        )

    tool_events = [event for event in events if event.get("event") == "tool_result"]
    used_tools = {str(event.get("tool_name")) for event in tool_events}
    for tool_name in case.get("expected_tools", []):
        checks.append(
            Check(
                name=f"tool_used:{tool_name}",
                passed=str(tool_name) in used_tools,
                weight=1.0,
                detail=f"used={sorted(used_tools)}",
            )
        )
    for tool_name in case.get("forbidden_tools", []):
        checks.append(
            Check(
                name=f"tool_not_used:{tool_name}",
                passed=str(tool_name) not in used_tools,
                weight=1.0,
                detail=f"used={sorted(used_tools)}",
            )
        )

    llm_calls = sum(event.get("event") == "llm_result" for event in events)
    if "max_llm_calls" in case:
        maximum = int(case["max_llm_calls"])
        checks.append(
            Check("max_llm_calls", llm_calls <= maximum, 1.0, f"{llm_calls} <= {maximum}")
        )
    if "max_latency_ms" in case:
        latency = max((float(event.get("elapsed_ms") or 0) for event in events), default=0)
        maximum = float(case["max_latency_ms"])
        checks.append(Check("max_latency_ms", latency <= maximum, 1.0, f"{latency} <= {maximum}"))

    if not checks:
        checks.append(Check("non_empty_answer", bool(answer.strip()), 1.0))
    total_weight = sum(check.weight for check in checks)
    score = sum(check.weight for check in checks if check.passed) / total_weight
    threshold = float(case.get("min_score", 1.0))
    required_failed = any(
        not check.passed
        for check in checks
        if check.name.startswith(("excludes:", "tool_not_used:"))
    )
    return EvaluationResult(score >= threshold and not required_failed, round(score, 4), checks)
