"""add content review tables"""

from alembic import op
import sqlalchemy as sa


revision = "20260509_0005"
down_revision = "20260509_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_content_review_task",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("source_scene", sa.String(length=64), nullable=False),
        sa.Column("priority", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("submitted_content", sa.Text(), nullable=False),
        sa.Column("reviewer_name", sa.String(length=128), nullable=True),
        sa.Column("decision_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_content_review_task_entity_type", "ai_content_review_task", ["entity_type"])
    op.create_index("ix_ai_content_review_task_entity_id", "ai_content_review_task", ["entity_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_content_review_task_entity_id", table_name="ai_content_review_task")
    op.drop_index("ix_ai_content_review_task_entity_type", table_name="ai_content_review_task")
    op.drop_table("ai_content_review_task")
