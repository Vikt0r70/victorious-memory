"""provider_system

Revision ID: 27eb17c6c35d
Revises: 
Create Date: 2026-05-25 23:16:21.194422

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '27eb17c6c35d'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Drop old table if it exists
    op.drop_table("provider_configs", if_exists=True)

    # Create providers table
    op.create_table(
        "providers",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("provider_type", sa.Text(), nullable=False),
        sa.Column("base_url", sa.Text(), nullable=False),
        sa.Column("api_key_encrypted", sa.Text(), server_default=""),
        sa.Column("model", sa.Text(), nullable=False),
        sa.Column("max_tokens", sa.Integer(), server_default="2000"),
        sa.Column("is_enabled", sa.Boolean(), server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    # Create agents table
    op.create_table(
        "agents",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("role", sa.Text(), nullable=False, unique=True),
        sa.Column(
            "fallback_provider_ids",
            postgresql.JSONB(),
            server_default="[]",
        ),
        sa.Column(
            "settings_override",
            postgresql.JSONB(),
            server_default="{}",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    # Create usage_logs table
    op.create_table(
        "usage_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("provider_id", sa.Text(), sa.ForeignKey("providers.id"), nullable=False),
        sa.Column("agent_role", sa.Text(), nullable=False),
        sa.Column("model", sa.Text(), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), server_default="0"),
        sa.Column("completion_tokens", sa.Integer(), server_default="0"),
        sa.Column("total_tokens", sa.Integer(), server_default="0"),
        sa.Column("latency_ms", sa.Integer(), server_default="0"),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("fallback_position", sa.Integer(), server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    # Seed fixed agent roles using ad-hoc table definitions
    agents_table = sa.table(
        "agents",
        sa.column("id", sa.Text),
        sa.column("role", sa.Text),
        sa.column("fallback_provider_ids", postgresql.JSONB),
        sa.column("settings_override", postgresql.JSONB),
    )

    op.bulk_insert(
        agents_table,
        [
            {
                "id": "agent-extraction",
                "role": "extraction",
                "fallback_provider_ids": [],
                "settings_override": {},
            },
            {
                "id": "agent-edge-detection",
                "role": "edge_detection",
                "fallback_provider_ids": [],
                "settings_override": {},
            },
            {
                "id": "agent-consolidation",
                "role": "consolidation",
                "fallback_provider_ids": [],
                "settings_override": {},
            },
        ],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("usage_logs", if_exists=True)
    op.drop_table("agents", if_exists=True)
    op.drop_table("providers", if_exists=True)
