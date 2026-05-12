"""add favorite category and notes"""

from alembic import op
import sqlalchemy as sa


revision = "20260511_0011"
down_revision = "20260510_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ai_resource_favorite",
        sa.Column("category", sa.String(length=64), nullable=False, server_default="默认分类"),
    )
    op.add_column(
        "ai_resource_favorite",
        sa.Column("notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ai_resource_favorite", "notes")
    op.drop_column("ai_resource_favorite", "category")
