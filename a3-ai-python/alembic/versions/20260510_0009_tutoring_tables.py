"""add tutoring tables"""

from alembic import op
import sqlalchemy as sa


revision = "20260510_0009"
down_revision = "20260509_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tutoring_session",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("course_id", sa.BigInteger(), nullable=True),
        sa.Column("section_id", sa.BigInteger(), nullable=True),
        sa.Column("session_status", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("question_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("start_time", sa.DateTime(), nullable=False),
        sa.Column("end_time", sa.DateTime(), nullable=True),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_time", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_tutoring_session_user_id", "tutoring_session", ["user_id"])
    op.create_index("ix_tutoring_session_session_status", "tutoring_session", ["session_status"])

    op.create_table(
        "tutoring_question",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("session_id", sa.BigInteger(), sa.ForeignKey("tutoring_session.id"), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("course_id", sa.BigInteger(), nullable=True),
        sa.Column("section_id", sa.BigInteger(), nullable=True),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("question_images", sa.JSON(), nullable=True),
        sa.Column("question_type", sa.String(length=50), nullable=True),
        sa.Column("knowledge_points", sa.JSON(), nullable=True),
        sa.Column("difficulty_level", sa.Integer(), nullable=True),
        sa.Column("question_status", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("has_answer", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_escalated", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_time", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_tutoring_question_session_id", "tutoring_question", ["session_id"])
    op.create_index("ix_tutoring_question_user_id", "tutoring_question", ["user_id"])
    op.create_index("ix_tutoring_question_question_status", "tutoring_question", ["question_status"])

    op.create_table(
        "tutoring_answer",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("question_id", sa.BigInteger(), sa.ForeignKey("tutoring_question.id"), nullable=False),
        sa.Column("session_id", sa.BigInteger(), sa.ForeignKey("tutoring_session.id"), nullable=False),
        sa.Column("answer_source", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("answerer_id", sa.BigInteger(), nullable=True),
        sa.Column("answer_text", sa.Text(), nullable=False),
        sa.Column("answer_diagrams", sa.JSON(), nullable=True),
        sa.Column("answer_videos", sa.JSON(), nullable=True),
        sa.Column("reference_sources", sa.JSON(), nullable=True),
        sa.Column("confidence_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("generation_time", sa.Integer(), nullable=True),
        sa.Column("is_helpful", sa.Boolean(), nullable=True),
        sa.Column("user_rating", sa.Integer(), nullable=True),
        sa.Column("user_feedback", sa.String(length=500), nullable=True),
        sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_time", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_tutoring_answer_question_id", "tutoring_answer", ["question_id"])
    op.create_index("ix_tutoring_answer_session_id", "tutoring_answer", ["session_id"])
    op.create_index("ix_tutoring_answer_answer_source", "tutoring_answer", ["answer_source"])
    op.create_index("ix_tutoring_answer_confidence_score", "tutoring_answer", ["confidence_score"])

    op.create_table(
        "escalation_record",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("question_id", sa.BigInteger(), sa.ForeignKey("tutoring_question.id"), nullable=False),
        sa.Column("session_id", sa.BigInteger(), sa.ForeignKey("tutoring_session.id"), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("escalation_reason", sa.Integer(), nullable=False),
        sa.Column("ai_confidence_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("escalation_status", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("assigned_expert_id", sa.BigInteger(), nullable=True),
        sa.Column("assign_time", sa.DateTime(), nullable=True),
        sa.Column("expert_answer_id", sa.BigInteger(), nullable=True),
        sa.Column("complete_time", sa.DateTime(), nullable=True),
        sa.Column("response_time", sa.Integer(), nullable=True),
        sa.Column("expert_notes", sa.String(length=500), nullable=True),
        sa.Column("feedback_to_ai", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("create_time", sa.DateTime(), nullable=False),
        sa.Column("update_time", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_escalation_record_question_id", "escalation_record", ["question_id"])
    op.create_index("ix_escalation_record_session_id", "escalation_record", ["session_id"])
    op.create_index("ix_escalation_record_user_id", "escalation_record", ["user_id"])
    op.create_index("ix_escalation_record_escalation_status", "escalation_record", ["escalation_status"])
    op.create_index("ix_escalation_record_assigned_expert_id", "escalation_record", ["assigned_expert_id"])

    op.create_table(
        "tutoring_favorite",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("question_id", sa.BigInteger(), nullable=False),
        sa.Column("answer_id", sa.BigInteger(), nullable=False),
        sa.Column("favorite_note", sa.String(length=200), nullable=True),
        sa.Column("create_time", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_tutoring_favorite_user_id", "tutoring_favorite", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_tutoring_favorite_user_id", table_name="tutoring_favorite")
    op.drop_table("tutoring_favorite")

    op.drop_index("ix_escalation_record_assigned_expert_id", table_name="escalation_record")
    op.drop_index("ix_escalation_record_escalation_status", table_name="escalation_record")
    op.drop_index("ix_escalation_record_user_id", table_name="escalation_record")
    op.drop_index("ix_escalation_record_session_id", table_name="escalation_record")
    op.drop_index("ix_escalation_record_question_id", table_name="escalation_record")
    op.drop_table("escalation_record")

    op.drop_index("ix_tutoring_answer_confidence_score", table_name="tutoring_answer")
    op.drop_index("ix_tutoring_answer_answer_source", table_name="tutoring_answer")
    op.drop_index("ix_tutoring_answer_session_id", table_name="tutoring_answer")
    op.drop_index("ix_tutoring_answer_question_id", table_name="tutoring_answer")
    op.drop_table("tutoring_answer")

    op.drop_index("ix_tutoring_question_question_status", table_name="tutoring_question")
    op.drop_index("ix_tutoring_question_user_id", table_name="tutoring_question")
    op.drop_index("ix_tutoring_question_session_id", table_name="tutoring_question")
    op.drop_table("tutoring_question")

    op.drop_index("ix_tutoring_session_session_status", table_name="tutoring_session")
    op.drop_index("ix_tutoring_session_user_id", table_name="tutoring_session")
    op.drop_table("tutoring_session")
