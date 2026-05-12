"""add admin user control table"""

from alembic import op
import sqlalchemy as sa


revision = "20260509_0007"
down_revision = "20260509_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_admin_user_control",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False, unique=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_admin_user_control_user_id", "ai_admin_user_control", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_ai_admin_user_control_user_id", table_name="ai_admin_user_control")
    op.drop_table("ai_admin_user_control")
