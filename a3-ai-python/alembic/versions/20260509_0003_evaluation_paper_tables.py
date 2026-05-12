"""add evaluation paper tables"""

from alembic import op
import sqlalchemy as sa


revision = "20260509_0003"
down_revision = "20260509_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_evaluation_paper",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("course_code", sa.String(length=128), nullable=False),
        sa.Column("paper_type", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("questions_data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_evaluation_paper_user_id", "ai_evaluation_paper", ["user_id"])
    op.create_index("ix_ai_evaluation_paper_course_code", "ai_evaluation_paper", ["course_code"])

    op.create_table(
        "ai_evaluation_answer",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("paper_id", sa.Integer(), sa.ForeignKey("ai_evaluation_paper.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.String(length=64), nullable=False),
        sa.Column("question_type", sa.String(length=32), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("knowledge_point", sa.String(length=255), nullable=False),
        sa.Column("user_answer", sa.Text(), nullable=False),
        sa.Column("correct_answer", sa.Text(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_evaluation_answer_paper_id", "ai_evaluation_answer", ["paper_id"])
    op.create_index("ix_ai_evaluation_answer_user_id", "ai_evaluation_answer", ["user_id"])
    op.create_index("ix_ai_evaluation_answer_question_id", "ai_evaluation_answer", ["question_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_evaluation_answer_question_id", table_name="ai_evaluation_answer")
    op.drop_index("ix_ai_evaluation_answer_user_id", table_name="ai_evaluation_answer")
    op.drop_index("ix_ai_evaluation_answer_paper_id", table_name="ai_evaluation_answer")
    op.drop_table("ai_evaluation_answer")

    op.drop_index("ix_ai_evaluation_paper_course_code", table_name="ai_evaluation_paper")
    op.drop_index("ix_ai_evaluation_paper_user_id", table_name="ai_evaluation_paper")
    op.drop_table("ai_evaluation_paper")
