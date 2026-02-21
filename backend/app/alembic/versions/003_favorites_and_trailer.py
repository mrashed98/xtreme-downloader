"""Add favorites table and series trailer/release_date fields

Revision ID: 003
Revises: 002
Create Date: 2024-01-03 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to series
    op.add_column("series", sa.Column("youtube_trailer", sa.String(64), nullable=True))
    op.add_column("series", sa.Column("release_date", sa.String(32), nullable=True))

    # Create favorites table
    op.create_table(
        "favorites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("playlist_id", sa.Integer(), nullable=False),
        sa.Column("content_type", sa.String(16), nullable=False),
        sa.Column("item_id", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_unique_constraint(
        "uq_favorites_playlist_type_item",
        "favorites",
        ["playlist_id", "content_type", "item_id"],
    )
    op.create_index("ix_favorites_playlist_id", "favorites", ["playlist_id"])


def downgrade() -> None:
    op.drop_index("ix_favorites_playlist_id", "favorites")
    op.drop_constraint("uq_favorites_playlist_type_item", "favorites", type_="unique")
    op.drop_table("favorites")
    op.drop_column("series", "release_date")
    op.drop_column("series", "youtube_trailer")
