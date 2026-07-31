"""Structured, redacted JSONL traces for agent runs."""

from __future__ import annotations

import json
import os
import re
import time
import uuid
from pathlib import Path
from typing import Any

_SECRET_KEY = re.compile(r"(token|password|secret|api[_-]?key|authorization)", re.I)


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: "[REDACTED]" if _SECRET_KEY.search(str(key)) else _redact(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact(item) for item in value]
    if isinstance(value, str) and len(value) > 2000:
        return value[:2000] + "...[TRUNCATED]"
    return value


class TraceRecorder:
    """Append one JSON object per event so traces are easy to replay and diff."""

    def __init__(
        self,
        output_dir: str | os.PathLike[str] = "harness/artifacts",
        run_id: str | None = None,
    ) -> None:
        self.run_id = run_id or uuid.uuid4().hex
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.path = self.output_dir / f"{self.run_id}.jsonl"

    def record(self, event: str, **data: Any) -> dict[str, Any]:
        item = {
            "ts": time.time(),
            "run_id": self.run_id,
            "event": event,
            **_redact(data),
        }
        with self.path.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(item, ensure_ascii=True, sort_keys=True) + "\n")
        return item
