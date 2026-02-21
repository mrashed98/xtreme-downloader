"""Add unique constraints and deduplicate content tables

Revision ID: 002
Revises: 001
Create Date: 2024-01-02 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # --- Deduplicate before adding constraints ---
    # Keep the row with the lowest id for each natural key.
    # ON DELETE CASCADE handles child rows automatically.

    conn.execute(sa.text("""
        DELETE FROM categories
        WHERE id NOT IN (
            SELECT MIN(id) FROM categories
            GROUP BY playlist_id, type, category_id
        )
    """))

    conn.execute(sa.text("""
        DELETE FROM live_streams
        WHERE id NOT IN (
            SELECT MIN(id) FROM live_streams
            GROUP BY playlist_id, stream_id
        )
    """))

    conn.execute(sa.text("""
        DELETE FROM vod_streams
        WHERE id NOT IN (
            SELECT MIN(id) FROM vod_streams
            GROUP BY playlist_id, stream_id
        )
    """))

    # Episodes and seasons cascade-delete when their parent series row is deleted,
    # so deduplicating series is enough to clean up orphaned child rows.
    conn.execute(sa.text("""
        DELETE FROM series
        WHERE id NOT IN (
            SELECT MIN(id) FROM series
            GROUP BY playlist_id, series_id
        )
    """))

    conn.execute(sa.text("""
        DELETE FROM seasons
        WHERE id NOT IN (
            SELECT MIN(id) FROM seasons
            GROUP BY series_id, season_num
        )
    """))

    conn.execute(sa.text("""
        DELETE FROM episodes
        WHERE id NOT IN (
            SELECT MIN(id) FROM episodes
            GROUP BY series_id, episode_id
        )
    """))

    # --- Add unique constraints ---
    op.create_unique_constraint(
        "uq_categories_playlist_type_cat",
        "categories",
        ["playlist_id", "type", "category_id"],
    )
    op.create_unique_constraint(
        "uq_live_streams_playlist_stream",
        "live_streams",
        ["playlist_id", "stream_id"],
    )
    op.create_unique_constraint(
        "uq_vod_streams_playlist_stream",
        "vod_streams",
        ["playlist_id", "stream_id"],
    )
    op.create_unique_constraint(
        "uq_series_playlist_series",
        "series",
        ["playlist_id", "series_id"],
    )
    op.create_unique_constraint(
        "uq_seasons_series_num",
        "seasons",
        ["series_id", "season_num"],
    )
    op.create_unique_constraint(
        "uq_episodes_series_epid",
        "episodes",
        ["series_id", "episode_id"],
    )

    # Add a sync_status column to playlists so the frontend can poll it
    op.add_column(
        "playlists",
        sa.Column("sync_status", sa.String(20), nullable=False, server_default="idle"),
    )


def downgrade() -> None:
    op.drop_column("playlists", "sync_status")
    op.drop_constraint("uq_episodes_series_epid", "episodes", type_="unique")
    op.drop_constraint("uq_seasons_series_num", "seasons", type_="unique")
    op.drop_constraint("uq_series_playlist_series", "series", type_="unique")
    op.drop_constraint("uq_vod_streams_playlist_stream", "vod_streams", type_="unique")
    op.drop_constraint("uq_live_streams_playlist_stream", "live_streams", type_="unique")
    op.drop_constraint("uq_categories_playlist_type_cat", "categories", type_="unique")
