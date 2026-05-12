"""profile conversation tables"""

from alembic import op
import sqlalchemy as sa


revision = "20260510_0010"
down_revision = "20260510_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_conversation_session",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("profile_id", sa.BigInteger(), nullable=True),
        sa.Column("status", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("session_type", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("total_rounds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("collected_dimensions", sa.String(length=256), nullable=True),
        sa.Column("completeness", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("start_time", sa.DateTime(), nullable=False),
        sa.Column("end_time", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_conversation_session_user_id", "ai_conversation_session", ["user_id"])

    op.create_table(
        "ai_conversation_message",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("message_type", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("related_dimension", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_conversation_message_session_id", "ai_conversation_message", ["session_id"])
    op.create_index("ix_ai_conversation_message_user_id", "ai_conversation_message", ["user_id"])

    op.create_table(
        "ai_extracted_info",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.BigInteger(), nullable=False),
        sa.Column("message_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("dimension", sa.String(length=64), nullable=False),
        sa.Column("info_key", sa.String(length=128), nullable=False),
        sa.Column("info_value", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("extraction_method", sa.String(length=64), nullable=True),
        sa.Column("verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_extracted_info_session_id", "ai_extracted_info", ["session_id"])
    op.create_index("ix_ai_extracted_info_user_id", "ai_extracted_info", ["user_id"])
    op.create_index("ix_ai_extracted_info_dimension", "ai_extracted_info", ["dimension"])

    op.create_table(
        "ai_student_profile",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("knowledge_base", sa.JSON(), nullable=True),
        sa.Column("cognitive_style", sa.JSON(), nullable=True),
        sa.Column("learning_progress", sa.JSON(), nullable=True),
        sa.Column("error_preference", sa.JSON(), nullable=True),
        sa.Column("interest_direction", sa.JSON(), nullable=True),
        sa.Column("learning_habit", sa.JSON(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("completeness", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("last_behavior_time", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_student_profile_user_id", "ai_student_profile", ["user_id"], unique=True)

    op.create_table(
        "ai_profile_history",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("profile_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("snapshot_data", sa.JSON(), nullable=False),
        sa.Column("change_type", sa.Integer(), nullable=False),
        sa.Column("change_description", sa.String(length=512), nullable=True),
        sa.Column("changed_dimensions", sa.String(length=256), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_profile_history_profile_id", "ai_profile_history", ["profile_id"])
    op.create_index("ix_ai_profile_history_user_id", "ai_profile_history", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_profile_history_user_id", table_name="ai_profile_history")
    op.drop_index("ix_ai_profile_history_profile_id", table_name="ai_profile_history")
    op.drop_table("ai_profile_history")

    op.drop_index("ix_ai_student_profile_user_id", table_name="ai_student_profile")
    op.drop_table("ai_student_profile")

    op.drop_index("ix_ai_extracted_info_dimension", table_name="ai_extracted_info")
    op.drop_index("ix_ai_extracted_info_user_id", table_name="ai_extracted_info")
    op.drop_index("ix_ai_extracted_info_session_id", table_name="ai_extracted_info")
    op.drop_table("ai_extracted_info")

    op.drop_index("ix_ai_conversation_message_user_id", table_name="ai_conversation_message")
    op.drop_index("ix_ai_conversation_message_session_id", table_name="ai_conversation_message")
    op.drop_table("ai_conversation_message")

    op.drop_index("ix_ai_conversation_session_user_id", table_name="ai_conversation_session")
    op.drop_table("ai_conversation_session")
