"""add peer columns to chat_session

Revision ID: 20260615_0014
Revises: 20260604_0013
Create Date: 2026-06-15 10:15:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260615_0014"
down_revision = "20260604_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("chat_session", sa.Column("peer_user_id", sa.BigInteger(), nullable=True))
    op.add_column("chat_session", sa.Column("peer_name", sa.String(length=255), nullable=True))
    op.create_index("ix_chat_session_peer_user_id", "chat_session", ["peer_user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_chat_session_peer_user_id", table_name="chat_session")
    op.drop_column("chat_session", "peer_name")
    op.drop_column("chat_session", "peer_user_id")
