"""add job trial feedback

Revision ID: 20260808_0018
Revises: 20260805_0017
"""

import sqlalchemy as sa

from alembic import op

revision = "20260808_0018"
down_revision = "20260805_0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_trial_feedback",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("participant_role", sa.String(length=32), nullable=False),
        sa.Column("identity_description", sa.String(length=200), nullable=False),
        sa.Column("trial_task", sa.Text(), nullable=False),
        sa.Column("strengths", sa.Text(), nullable=False),
        sa.Column("problems", sa.Text(), nullable=False),
        sa.Column("improvement_suggestions", sa.Text(), nullable=False),
        sa.Column("overall_rating", sa.Integer(), nullable=False),
        sa.Column("consent_to_quote", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_job_trial_feedback_user_id",
        "job_trial_feedback",
        ["user_id"],
    )
    op.create_index(
        "ix_job_trial_feedback_course_id",
        "job_trial_feedback",
        ["course_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_job_trial_feedback_course_id", table_name="job_trial_feedback")
    op.drop_index("ix_job_trial_feedback_user_id", table_name="job_trial_feedback")
    op.drop_table("job_trial_feedback")
