import asyncio

from sqlalchemy import text

from app.db.session import local_engine


SQLS = [
    """
    ALTER TABLE chat_session
    ADD COLUMN IF NOT EXISTS peer_user_id BIGINT
    """,
    """
    ALTER TABLE chat_session
    ADD COLUMN IF NOT EXISTS peer_name VARCHAR(255)
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_chat_session_peer_user_id
    ON chat_session(peer_user_id)
    """,
]


async def main() -> None:
    async with local_engine.begin() as conn:
        for sql in SQLS:
            await conn.execute(text(sql))
    print("ok")


if __name__ == "__main__":
    asyncio.run(main())
