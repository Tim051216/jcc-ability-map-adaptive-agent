"""add resource and plan progress tables"""

from alembic import op
import sqlalchemy as sa


revision = "20260509_0002"
down_revision = "20260507_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_generated_resource",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("course_code", sa.String(length=128), nullable=False),
        sa.Column("resource_type", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("content_markdown", sa.Text(), nullable=False),
        sa.Column("source_titles", sa.JSON(), nullable=False),
        sa.Column("study_suggestion", sa.Text(), nullable=True),
        sa.Column("generation_context", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_generated_resource_user_id", "ai_generated_resource", ["user_id"])
    op.create_index("ix_ai_generated_resource_course_code", "ai_generated_resource", ["course_code"])
    op.create_index("ix_ai_generated_resource_resource_type", "ai_generated_resource", ["resource_type"])

    op.create_table(
        "ai_resource_favorite",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("resource_id", sa.Integer(), sa.ForeignKey("ai_generated_resource.id"), nullable=False),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
        sa.UniqueConstraint("user_id", "resource_id", name="uq_ai_resource_favorite_user_resource"),
    )
    op.create_index("ix_ai_resource_favorite_user_id", "ai_resource_favorite", ["user_id"])
    op.create_index("ix_ai_resource_favorite_resource_id", "ai_resource_favorite", ["resource_id"])

    op.create_table(
        "ai_plan_step_progress",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("ai_learning_plan.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("step_id", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("last_action", sa.String(length=32), nullable=False),
        sa.Column("progress_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
        sa.UniqueConstraint("plan_id", "user_id", "step_id", name="uq_ai_plan_step_progress_plan_user_step"),
    )
    op.create_index("ix_ai_plan_step_progress_plan_id", "ai_plan_step_progress", ["plan_id"])
    op.create_index("ix_ai_plan_step_progress_user_id", "ai_plan_step_progress", ["user_id"])
    op.create_index("ix_ai_plan_step_progress_step_id", "ai_plan_step_progress", ["step_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_plan_step_progress_step_id", table_name="ai_plan_step_progress")
    op.drop_index("ix_ai_plan_step_progress_user_id", table_name="ai_plan_step_progress")
    op.drop_index("ix_ai_plan_step_progress_plan_id", table_name="ai_plan_step_progress")
    op.drop_table("ai_plan_step_progress")

    op.drop_index("ix_ai_resource_favorite_resource_id", table_name="ai_resource_favorite")
    op.drop_index("ix_ai_resource_favorite_user_id", table_name="ai_resource_favorite")
    op.drop_table("ai_resource_favorite")

    op.drop_index("ix_ai_generated_resource_resource_type", table_name="ai_generated_resource")
    op.drop_index("ix_ai_generated_resource_course_code", table_name="ai_generated_resource")
    op.drop_index("ix_ai_generated_resource_user_id", table_name="ai_generated_resource")
    op.drop_table("ai_generated_resource")
