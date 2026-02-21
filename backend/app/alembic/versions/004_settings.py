"""Add app_settings table with default values

Revision ID: 004
Revises: 003
Create Date: 2024-01-04 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False),
    )
    op.execute(
        "INSERT INTO app_settings (key, value) VALUES "
        "('max_concurrent_downloads', '3'), "
        "('download_chunks', '16'), "
        "('speed_limit_bps', '0')"
    )


def downgrade() -> None:
    op.drop_table("app_settings")
