"""add chat ticket tables"""

from alembic import op
import sqlalchemy as sa


revision = "20260509_0004"
down_revision = "20260509_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_chat_ticket",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("ai_chat_session.id"), nullable=True),
        sa.Column("course_code", sa.String(length=128), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("question_summary", sa.Text(), nullable=False),
        sa.Column("latest_answer", sa.Text(), nullable=True),
        sa.Column("priority", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_chat_ticket_user_id", "ai_chat_ticket", ["user_id"])
    op.create_index("ix_ai_chat_ticket_session_id", "ai_chat_ticket", ["session_id"])
    op.create_index("ix_ai_chat_ticket_course_code", "ai_chat_ticket", ["course_code"])

    op.create_table(
        "ai_chat_ticket_reply",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("ticket_id", sa.Integer(), sa.ForeignKey("ai_chat_ticket.id"), nullable=False),
        sa.Column("replier_name", sa.String(length=128), nullable=False),
        sa.Column("replier_role", sa.String(length=32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_chat_ticket_reply_ticket_id", "ai_chat_ticket_reply", ["ticket_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_chat_ticket_reply_ticket_id", table_name="ai_chat_ticket_reply")
    op.drop_table("ai_chat_ticket_reply")

    op.drop_index("ix_ai_chat_ticket_course_code", table_name="ai_chat_ticket")
    op.drop_index("ix_ai_chat_ticket_session_id", table_name="ai_chat_ticket")
    op.drop_index("ix_ai_chat_ticket_user_id", table_name="ai_chat_ticket")
    op.drop_table("ai_chat_ticket")
