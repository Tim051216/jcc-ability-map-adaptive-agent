"""add job learning goal fields

Revision ID: 20260805_0016
Revises: 20260727_0015
"""

import sqlalchemy as sa

from alembic import op

revision = "20260805_0016"
down_revision = "20260727_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "personalized_learning_state",
        sa.Column("student_goal", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "personalized_learning_state",
        sa.Column("goal_scene", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "personalized_learning_state",
        sa.Column("job_name", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("personalized_learning_state", "job_name")
    op.drop_column("personalized_learning_state", "goal_scene")
    op.drop_column("personalized_learning_state", "student_goal")
