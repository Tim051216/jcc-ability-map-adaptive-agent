from types import SimpleNamespace

import pytest

from app.services import admin_user_status_history_service as admin_user_status_history_service_module
from app.services.admin_user_status_history_service import AdminUserStatusHistoryService


class _FakeSessionFactory:
    def __init__(self, session) -> None:
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


def _patch_session_factory(monkeypatch, session) -> None:
    monkeypatch.setattr(
        admin_user_status_history_service_module,
        "async_session_factory",
        lambda: _FakeSessionFactory(session),
    )


@pytest.mark.asyncio
async def test_list_history_filters_admin_user_status_logs(monkeypatch) -> None:
    session = SimpleNamespace()
    _patch_session_factory(monkeypatch, session)

    logs = [
        SimpleNamespace(
            payload={"user_id": 1001, "status": "suspended", "reason": "manual hold", "updated_by": "adminA"},
            created_at="2026-05-09T21:00:00+00:00",
        ),
        SimpleNamespace(
            payload={"user_id": 1002, "status": "active", "reason": None, "updated_by": "adminB"},
            created_at="2026-05-09T20:00:00+00:00",
        ),
    ]

    class FakeAuditLogRepository:
        async def list_logs(self, session_obj, **kwargs):
            assert session_obj is session
            assert kwargs["scene"] == "admin_user"
            assert kwargs["action"] == "admin_user_status_updated"
            return logs, len(logs)

    monkeypatch.setattr(
        admin_user_status_history_service_module,
        "AuditLogRepository",
        lambda: FakeAuditLogRepository(),
    )

    response = await AdminUserStatusHistoryService().list_history(user_id=1001, status="suspended")

    assert response.total == 1
    assert response.items[0].user_id == 1001
    assert response.items[0].updated_by == "adminA"
