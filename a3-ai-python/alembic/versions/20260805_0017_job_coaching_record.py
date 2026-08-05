"""add job coaching records

Revision ID: 20260805_0017
Revises: 20260805_0016
"""

import sqlalchemy as sa

from alembic import op

revision = "20260805_0017"
down_revision = "20260805_0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_coaching_record",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("user_question", sa.Text(), nullable=False),
        sa.Column("advice_summary", sa.Text(), nullable=False),
        sa.Column("recommended_actions", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("helpful", sa.Boolean(), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("feedback_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_job_coaching_record_user_id",
        "job_coaching_record",
        ["user_id"],
    )
    op.create_index(
        "ix_job_coaching_record_course_id",
        "job_coaching_record",
        ["course_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_job_coaching_record_course_id", table_name="job_coaching_record")
    op.drop_index("ix_job_coaching_record_user_id", table_name="job_coaching_record")
    op.drop_table("job_coaching_record")
