"""add_agent_primary_provider_id

Revision ID: f124433a6086
Revises: 27eb17c6c35d
Create Date: 2026-05-26 01:53:15.180759

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f124433a6086'
down_revision: Union[str, Sequence[str], None] = '27eb17c6c35d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add primary_provider_id column to agents table."""
    op.add_column(
        "agents",
        sa.Column("primary_provider_id", sa.Text(), nullable=True),
    )
    op.create_foreign_key(
        "fk_agents_primary_provider",
        "agents",
        "providers",
        ["primary_provider_id"],
        ["id"],
    )


def downgrade() -> None:
    """Remove primary_provider_id column and FK from agents."""
    op.drop_constraint(
        "fk_agents_primary_provider",
        "agents",
        type_="foreignkey",
    )
    op.drop_column("agents", "primary_provider_id")
