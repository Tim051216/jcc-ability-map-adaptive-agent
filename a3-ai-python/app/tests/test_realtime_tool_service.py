import pytest

from app.services.realtime_tool_service import RealtimeToolService


class _FakeWeatherResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


@pytest.mark.asyncio
async def test_realtime_tool_service_returns_weather_payload(monkeypatch) -> None:
    service = RealtimeToolService()

    class _FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def get(self, url, params=None):
            if "geocoding-api" in url:
                return _FakeWeatherResponse(
                    {
                        "results": [
                            {
                                "name": "南京",
                                "admin1": "江苏",
                                "country": "中国",
                                "latitude": 32.06,
                                "longitude": 118.79,
                            }
                        ]
                    }
                )
            return _FakeWeatherResponse(
                {
                    "current": {
                        "temperature_2m": 28.4,
                        "weather_code": 2,
                    },
                    "daily": {
                        "time": ["2026-06-02", "2026-06-03", "2026-06-04"],
                        "weather_code": [2, 3, 61],
                        "temperature_2m_max": [31.0, 29.0, 27.0],
                        "temperature_2m_min": [23.0, 22.0, 21.0],
                        "precipitation_probability_max": [20, 35, 80],
                    },
                }
            )

    monkeypatch.setattr("app.services.realtime_tool_service.httpx.AsyncClient", _FakeClient)

    result = await service.lookup("今天南京天气怎么样")
    assert result is not None
    assert result["tool"] == "weather"
    assert result["location"] == "南京"
    assert result["reference_sources"][0]["source_type"] == "web"

