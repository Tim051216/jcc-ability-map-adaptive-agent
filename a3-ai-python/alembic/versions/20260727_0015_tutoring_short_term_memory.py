"""add persistent tutoring short-term memory

Revision ID: 20260727_0015
Revises: 20260615_0014
Create Date: 2026-07-27 12:00:00
"""

import sqlalchemy as sa

from alembic import op

revision = "20260727_0015"
down_revision = "20260615_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tutoring_session_memory",
        sa.Column("session_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("summary_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("summarized_through_question_id", sa.BigInteger(), nullable=True),
        sa.Column("summary_token_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_time", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["tutoring_session.id"]),
        sa.PrimaryKeyConstraint("session_id"),
    )
    op.create_index(
        "ix_tutoring_session_memory_user_id",
        "tutoring_session_memory",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_tutoring_session_memory_user_id",
        table_name="tutoring_session_memory",
    )
    op.drop_table("tutoring_session_memory")
