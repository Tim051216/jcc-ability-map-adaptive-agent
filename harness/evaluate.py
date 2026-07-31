"""Deterministic acceptance checks used by local runs and CI."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Evaluation:
    passed: bool
    score: float
    reasons: list[str]


def evaluate(output: str, case: dict[str, Any]) -> Evaluation:
    text = output.lower()
    reasons: list[str] = []
    required = [str(item).lower() for item in case.get("must_contain", [])]
    forbidden = [str(item).lower() for item in case.get("must_not_contain", [])]
    missing = [item for item in required if item not in text]
    present_forbidden = [item for item in forbidden if item in text]

    if missing:
        reasons.append("missing: " + ", ".join(missing))
    if present_forbidden:
        reasons.append("forbidden: " + ", ".join(present_forbidden))

    checks = len(required) + len(forbidden)
    passed_checks = checks - len(missing) - len(present_forbidden)
    score = 1.0 if checks == 0 else max(0.0, passed_checks / checks)
    return Evaluation(not reasons, score, reasons)
