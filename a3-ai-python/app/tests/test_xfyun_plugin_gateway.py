from fastapi.testclient import TestClient

from xfyun_agent import plugin_gateway


def test_job_learning_gateway_caches_successful_upstream_response(monkeypatch) -> None:
    payload = {
        "user_id": 1001,
        "course_id": 401,
        "job_name": "software developer",
    }

    class FakeResponse:
        status_code = 200

        @staticmethod
        def json() -> dict:
            return payload

    class FakeAsyncClient:
        calls = 0

        def __init__(self, **kwargs) -> None:
            self.kwargs = kwargs

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback) -> None:
            return None

        async def get(self, url: str, *, params: dict[str, int]):
            self.__class__.calls += 1
            assert url.endswith("/api/v1/student-portal/job-learning")
            assert params == {"user_id": 1001, "course_id": 401}
            return FakeResponse()

    plugin_gateway._response_cache.clear()
    monkeypatch.setattr(plugin_gateway.httpx, "AsyncClient", FakeAsyncClient)

    with TestClient(plugin_gateway.app) as client:
        first = client.get(
            "/api/v1/student-portal/job-learning",
            params={"user_id": 1001, "course_id": 401},
        )
        second = client.get(
            "/api/v1/student-portal/job-learning",
            params={"user_id": 1001, "course_id": 401},
        )

    assert first.status_code == 200
    assert first.json() == payload
    assert first.headers["x-plugin-cache"] == "miss"
    assert second.status_code == 200
    assert second.headers["x-plugin-cache"] == "hit"
    assert FakeAsyncClient.calls == 1
