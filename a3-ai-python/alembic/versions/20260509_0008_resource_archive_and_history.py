"""add resource archive and favorite history"""

from alembic import op
import sqlalchemy as sa


revision = "20260509_0008"
down_revision = "20260509_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ai_generated_resource", sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("ai_generated_resource", sa.Column("archived_at", sa.String(), nullable=True))
    op.add_column("ai_generated_resource", sa.Column("archived_by", sa.String(length=64), nullable=True))
    op.add_column("ai_generated_resource", sa.Column("archive_reason", sa.Text(), nullable=True))
    op.add_column(
        "ai_generated_resource",
        sa.Column("download_scope", sa.String(length=32), nullable=False, server_default="owner"),
    )
    op.add_column(
        "ai_generated_resource",
        sa.Column("download_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_ai_generated_resource_is_archived", "ai_generated_resource", ["is_archived"])

    op.create_table(
        "ai_resource_favorite_history",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("resource_id", sa.Integer(), sa.ForeignKey("ai_generated_resource.id"), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_resource_favorite_history_user_id", "ai_resource_favorite_history", ["user_id"])
    op.create_index("ix_ai_resource_favorite_history_resource_id", "ai_resource_favorite_history", ["resource_id"])
    op.create_index("ix_ai_resource_favorite_history_action", "ai_resource_favorite_history", ["action"])


def downgrade() -> None:
    op.drop_index("ix_ai_resource_favorite_history_action", table_name="ai_resource_favorite_history")
    op.drop_index("ix_ai_resource_favorite_history_resource_id", table_name="ai_resource_favorite_history")
    op.drop_index("ix_ai_resource_favorite_history_user_id", table_name="ai_resource_favorite_history")
    op.drop_table("ai_resource_favorite_history")

    op.drop_index("ix_ai_generated_resource_is_archived", table_name="ai_generated_resource")
    op.drop_column("ai_generated_resource", "download_count")
    op.drop_column("ai_generated_resource", "download_scope")
    op.drop_column("ai_generated_resource", "archive_reason")
    op.drop_column("ai_generated_resource", "archived_by")
    op.drop_column("ai_generated_resource", "archived_at")
    op.drop_column("ai_generated_resource", "is_archived")
