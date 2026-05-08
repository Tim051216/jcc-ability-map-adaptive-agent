"""init ai tables"""

from alembic import op
import sqlalchemy as sa


revision = "20260507_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_user_profile_snapshot",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("profile_data", sa.JSON(), nullable=False),
        sa.Column("source_summary", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_user_profile_snapshot_user_id", "ai_user_profile_snapshot", ["user_id"])

    op.create_table(
        "ai_chat_session",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("scene", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_chat_session_user_id", "ai_chat_session", ["user_id"])

    op.create_table(
        "ai_chat_message",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("ai_chat_session.id"), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("citations", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_chat_message_session_id", "ai_chat_message", ["session_id"])

    op.create_table(
        "ai_learning_plan",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("course_code", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("plan_data", sa.JSON(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_learning_plan_user_id", "ai_learning_plan", ["user_id"])
    op.create_index("ix_ai_learning_plan_course_code", "ai_learning_plan", ["course_code"])

    op.create_table(
        "ai_generation_task",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("task_type", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("result_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_generation_task_user_id", "ai_generation_task", ["user_id"])

    op.create_table(
        "ai_knowledge_document",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("course_code", sa.String(length=128), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("source_type", sa.String(length=64), nullable=False),
        sa.Column("source_uri", sa.String(length=500), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_knowledge_document_course_code", "ai_knowledge_document", ["course_code"])

    op.create_table(
        "ai_knowledge_chunk",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("document_id", sa.Integer(), sa.ForeignKey("ai_knowledge_document.id"), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("keywords", sa.String(length=500), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_knowledge_chunk_document_id", "ai_knowledge_chunk", ["document_id"])
    op.create_index("ix_ai_knowledge_chunk_chunk_index", "ai_knowledge_chunk", ["chunk_index"])

    op.create_table(
        "ai_evaluation_record",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("course_code", sa.String(length=128), nullable=False),
        sa.Column("evaluation_type", sa.String(length=64), nullable=False),
        sa.Column("result_data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_evaluation_record_user_id", "ai_evaluation_record", ["user_id"])
    op.create_index("ix_ai_evaluation_record_course_code", "ai_evaluation_record", ["course_code"])

    op.create_table(
        "ai_audit_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("trace_id", sa.String(length=128), nullable=True),
        sa.Column("scene", sa.String(length=64), nullable=False),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("ai_audit_log")
    op.drop_index("ix_ai_evaluation_record_course_code", table_name="ai_evaluation_record")
    op.drop_index("ix_ai_evaluation_record_user_id", table_name="ai_evaluation_record")
    op.drop_table("ai_evaluation_record")
    op.drop_index("ix_ai_knowledge_chunk_chunk_index", table_name="ai_knowledge_chunk")
    op.drop_index("ix_ai_knowledge_chunk_document_id", table_name="ai_knowledge_chunk")
    op.drop_table("ai_knowledge_chunk")
    op.drop_index("ix_ai_knowledge_document_course_code", table_name="ai_knowledge_document")
    op.drop_table("ai_knowledge_document")
    op.drop_index("ix_ai_generation_task_user_id", table_name="ai_generation_task")
    op.drop_table("ai_generation_task")
    op.drop_index("ix_ai_learning_plan_course_code", table_name="ai_learning_plan")
    op.drop_index("ix_ai_learning_plan_user_id", table_name="ai_learning_plan")
    op.drop_table("ai_learning_plan")
    op.drop_index("ix_ai_chat_message_session_id", table_name="ai_chat_message")
    op.drop_table("ai_chat_message")
    op.drop_index("ix_ai_chat_session_user_id", table_name="ai_chat_session")
    op.drop_table("ai_chat_session")
    op.drop_index("ix_ai_user_profile_snapshot_user_id", table_name="ai_user_profile_snapshot")
    op.drop_table("ai_user_profile_snapshot")
