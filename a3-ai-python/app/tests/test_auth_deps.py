from fastapi import HTTPException

from app.api.deps import get_websocket_user_id, resolve_current_user_id


def test_resolve_current_user_id_accepts_bearer_token() -> None:
    assert resolve_current_user_id(authorization="Bearer student-demo") == 1001


def test_resolve_current_user_id_prefers_header_over_bearer() -> None:
    assert resolve_current_user_id(authorization="Bearer student-demo", x_user_id=9999) == 9999


def test_resolve_current_user_id_accepts_x_user_id() -> None:
    assert resolve_current_user_id(x_user_id=1234) == 1234


def test_resolve_current_user_id_accepts_query_user_id() -> None:
    assert resolve_current_user_id(query_user_id=5678) == 5678


def test_resolve_current_user_id_rejects_missing_auth() -> None:
    try:
        resolve_current_user_id()
        assert False, "expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 401
        assert exc.detail == "missing authentication"


def test_resolve_current_user_id_rejects_invalid_bearer_token() -> None:
    try:
        resolve_current_user_id(authorization="Bearer unknown-token")
        assert False, "expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 401
        assert exc.detail == "invalid bearer token"


class _DummyWebSocket:
    def __init__(self, *, query_params: dict[str, str] | None = None, headers: dict[str, str] | None = None) -> None:
        self.query_params = query_params or {}
        self.headers = headers or {}


def test_get_websocket_user_id_accepts_access_token() -> None:
    websocket = _DummyWebSocket(query_params={"access_token": "student-demo"})
    assert get_websocket_user_id(websocket) == 1001


def test_get_websocket_user_id_accepts_x_user_id() -> None:
    websocket = _DummyWebSocket(headers={"x-user-id": "2002"})
    assert get_websocket_user_id(websocket) == 2002


def test_get_websocket_user_id_prefers_x_user_id_over_access_token() -> None:
    websocket = _DummyWebSocket(
        query_params={"access_token": "student-demo"},
        headers={"x-user-id": "2003"},
    )
    assert get_websocket_user_id(websocket) == 2003
