import json
from pathlib import Path
from typing import Any


class LocalRuntimeStore:
    _base_dir = Path(__file__).resolve().parents[2] / "local_data"
    _evaluation_file = _base_dir / "evaluation_store.json"
    _resource_file = _base_dir / "resource_store.json"
    _notification_file = _base_dir / "notification_store.json"
    _admin_session_file = _base_dir / "admin_session_store.json"
    _rag_eval_file = _base_dir / "rag_eval_store.json"

    @classmethod
    def load_evaluation_store(cls) -> dict[str, Any]:
        return cls._read_json(
            cls._evaluation_file,
            {
                "next_record_id": 1,
                "next_paper_id": 1,
                "records": [],
                "papers": [],
                "paper_answers": [],
            },
        )

    @classmethod
    def save_evaluation_store(cls, payload: dict[str, Any]) -> None:
        cls._write_json(cls._evaluation_file, payload)

    @classmethod
    def load_resource_store(cls) -> dict[str, Any]:
        return cls._read_json(
            cls._resource_file,
            {
                "next_resource_id": 1,
                "resources": [],
                "favorites": [],
                "favorite_history": [],
                "archives": [],
            },
        )

    @classmethod
    def save_resource_store(cls, payload: dict[str, Any]) -> None:
        cls._write_json(cls._resource_file, payload)

    @classmethod
    def load_notification_store(cls) -> dict[str, Any]:
        return cls._read_json(
            cls._notification_file,
            {
                "items": {},
            },
        )

    @classmethod
    def save_notification_store(cls, payload: dict[str, Any]) -> None:
        cls._write_json(cls._notification_file, payload)

    @classmethod
    def load_admin_session_store(cls) -> dict[str, Any]:
        return cls._read_json(
            cls._admin_session_file,
            {
                "active_session": None,
                "history": [],
            },
        )

    @classmethod
    def save_admin_session_store(cls, payload: dict[str, Any]) -> None:
        cls._write_json(cls._admin_session_file, payload)

    @classmethod
    def load_rag_eval_store(cls) -> dict[str, Any]:
        return cls._read_json(
            cls._rag_eval_file,
            {
                "next_run_id": 1,
                "next_correction_id": 1,
                "runs": [],
                "corrections": [],
            },
        )

    @classmethod
    def save_rag_eval_store(cls, payload: dict[str, Any]) -> None:
        cls._write_json(cls._rag_eval_file, payload)

    @classmethod
    def _read_json(cls, path: Path, default: dict[str, Any]) -> dict[str, Any]:
        if not path.exists():
            return default
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return default

    @classmethod
    def _write_json(cls, path: Path, payload: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
