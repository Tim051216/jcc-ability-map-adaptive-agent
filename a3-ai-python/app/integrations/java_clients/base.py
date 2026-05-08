import httpx

from app.core.config import settings
from app.core.security import build_internal_headers


class BaseJavaClient:
    @staticmethod
    def unwrap_payload(data):
        # Java 侧很多接口可能包了一层 Result，这里统一做一层兼容，避免上层重复判断。
        if isinstance(data, dict) and "data" in data and len(data.keys()) <= 4:
            return data.get("data")
        return data

    async def get(self, path: str, params: dict | None = None) -> dict:
        async with httpx.AsyncClient(base_url=settings.java_gateway_base_url, timeout=15.0) as client:
            response = await client.get(path, params=params, headers=build_internal_headers())
            response.raise_for_status()
            return self.unwrap_payload(response.json())
