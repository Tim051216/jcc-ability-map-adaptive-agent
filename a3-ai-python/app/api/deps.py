from collections.abc import AsyncGenerator

from fastapi import Header, HTTPException, Query, WebSocket

from app.core.config import settings
from app.core.logging import get_logger
from app.db.session import async_session_factory

logger = get_logger(__name__)


async def get_db_session() -> AsyncGenerator:
    async with async_session_factory() as session:
        yield session


def _parse_bearer_token_map() -> dict[str, int]:
    token_map: dict[str, int] = {}
    for item in (settings.auth_bearer_tokens or "").split(","):
        pair = item.strip()
        if not pair or ":" not in pair:
            continue
        token, raw_user_id = pair.split(":", 1)
        token = token.strip()
        raw_user_id = raw_user_id.strip()
        if not token or not raw_user_id:
            continue
        try:
            token_map[token] = int(raw_user_id)
        except ValueError:
            logger.warning("auth.invalid_token_mapping", token=token, raw_user_id=raw_user_id)
    return token_map


def _resolve_user_id_from_bearer(authorization: str | None) -> int | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="invalid Authorization header")
    token_map = _parse_bearer_token_map()
    user_id = token_map.get(token.strip())
    if user_id is None:
        raise HTTPException(status_code=401, detail="invalid bearer token")
    return user_id


def resolve_current_user_id(
    *,
    x_user_id: int | None = None,
    authorization: str | None = None,
    query_user_id: int | None = None,
    access_token: str | None = None,
) -> int:
    # 明确优先级：Bearer Token > 网关注入头 > 查询参数，避免调试参数覆盖正式身份。
    bearer_value = authorization
    if access_token:
        bearer_value = f"Bearer {access_token}"

    if bearer_value:
        user_id = _resolve_user_id_from_bearer(bearer_value)
        if user_id is not None:
            return user_id
    if x_user_id is not None:
        return x_user_id
    if query_user_id is not None:
        return query_user_id
    raise HTTPException(status_code=401, detail="missing authentication")


async def get_current_user_id(
    x_user_id: int | None = Header(None, alias="X-User-Id"),
    authorization: str | None = Header(None, alias="Authorization"),
    user_id: int | None = Query(None),
) -> int:
    """
    支持 Bearer Token、网关注入 X-User-Id、以及兼容旧调试链路的 user_id 查询参数。
    不再在 APP_DEBUG 下自动回退固定用户，避免把调试身份带入正式流程。
    """
    return resolve_current_user_id(
        x_user_id=x_user_id,
        authorization=authorization,
        query_user_id=user_id,
    )


def get_websocket_user_id(websocket: WebSocket) -> int:
    query_user_id = websocket.query_params.get("user_id")
    access_token = websocket.query_params.get("access_token")
    raw_x_user_id = websocket.headers.get("x-user-id")

    parsed_query_user_id = int(query_user_id) if query_user_id is not None else None
    parsed_x_user_id = int(raw_x_user_id) if raw_x_user_id is not None else None
    return resolve_current_user_id(
        x_user_id=parsed_x_user_id,
        authorization=websocket.headers.get("authorization"),
        query_user_id=parsed_query_user_id,
        access_token=access_token,
    )
