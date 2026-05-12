"""add system config and agent runtime tables"""

from alembic import op
import sqlalchemy as sa


revision = "20260509_0006"
down_revision = "20260509_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_system_config",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("config_key", sa.String(length=128), nullable=False, unique=True),
        sa.Column("config_value", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_system_config_config_key", "ai_system_config", ["config_key"], unique=True)

    op.create_table(
        "ai_agent_runtime_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("agent_name", sa.String(length=128), nullable=False),
        sa.Column("level", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("updated_at", sa.String(), nullable=True),
    )
    op.create_index("ix_ai_agent_runtime_log_agent_name", "ai_agent_runtime_log", ["agent_name"])


def downgrade() -> None:
    op.drop_index("ix_ai_agent_runtime_log_agent_name", table_name="ai_agent_runtime_log")
    op.drop_table("ai_agent_runtime_log")

    op.drop_index("ix_ai_system_config_config_key", table_name="ai_system_config")
    op.drop_table("ai_system_config")
