"""add personalized learning state table"""

from alembic import op
import sqlalchemy as sa


revision = "20260604_0013"
down_revision = "20260512_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "personalized_learning_state",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("total_watched_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_sections", sa.JSON(), nullable=False),
        sa.Column("last_event_type", sa.String(length=32), nullable=False, server_default="init"),
        sa.Column("created_at", sa.String(length=32), nullable=False),
        sa.Column("updated_at", sa.String(length=32), nullable=False),
        sa.UniqueConstraint("user_id", "course_id", name="uq_personalized_learning_state_user_course"),
    )
    op.create_index("ix_personalized_learning_state_user_id", "personalized_learning_state", ["user_id"])
    op.create_index("ix_personalized_learning_state_course_id", "personalized_learning_state", ["course_id"])


def downgrade() -> None:
    op.drop_index("ix_personalized_learning_state_course_id", table_name="personalized_learning_state")
    op.drop_index("ix_personalized_learning_state_user_id", table_name="personalized_learning_state")
    op.drop_table("personalized_learning_state")
