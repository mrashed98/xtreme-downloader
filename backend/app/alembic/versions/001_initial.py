"""Initial schema

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "playlists",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("base_url", sa.String(512), nullable=False),
        sa.Column("username", sa.String(255), nullable=False),
        sa.Column("password", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("playlist_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.Enum("live", "vod", "series", name="categorytype"), nullable=False),
        sa.Column("category_id", sa.String(64), nullable=False),
        sa.Column("name", sa.String(512), nullable=False),
        sa.ForeignKeyConstraint(["playlist_id"], ["playlists.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "live_streams",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("playlist_id", sa.Integer(), nullable=False),
        sa.Column("stream_id", sa.String(64), nullable=False),
        sa.Column("name", sa.String(512), nullable=False),
        sa.Column("icon", sa.Text(), nullable=True),
        sa.Column("category_id", sa.String(64), nullable=True),
        sa.Column("epg_channel_id", sa.String(255), nullable=True),
        sa.Column("stream_type", sa.String(32), nullable=True),
        sa.ForeignKeyConstraint(["playlist_id"], ["playlists.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "vod_streams",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("playlist_id", sa.Integer(), nullable=False),
        sa.Column("stream_id", sa.String(64), nullable=False),
        sa.Column("name", sa.String(512), nullable=False),
        sa.Column("icon", sa.Text(), nullable=True),
        sa.Column("category_id", sa.String(64), nullable=True),
        sa.Column("added", sa.String(64), nullable=True),
        sa.Column("container_extension", sa.String(16), nullable=True),
        sa.Column("imdb_id", sa.String(64), nullable=True),
        sa.Column("genre", sa.String(512), nullable=True),
        sa.Column("cast", sa.Text(), nullable=True),
        sa.Column("director", sa.String(512), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("plot", sa.Text(), nullable=True),
        sa.Column("duration", sa.String(32), nullable=True),
        sa.Column("language", sa.String(128), nullable=True),
        sa.ForeignKeyConstraint(["playlist_id"], ["playlists.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "series",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("playlist_id", sa.Integer(), nullable=False),
        sa.Column("series_id", sa.String(64), nullable=False),
        sa.Column("name", sa.String(512), nullable=False),
        sa.Column("cover", sa.Text(), nullable=True),
        sa.Column("category_id", sa.String(64), nullable=True),
        sa.Column("cast", sa.Text(), nullable=True),
        sa.Column("director", sa.String(512), nullable=True),
        sa.Column("genre", sa.String(512), nullable=True),
        sa.Column("plot", sa.Text(), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("language", sa.String(128), nullable=True),
        sa.ForeignKeyConstraint(["playlist_id"], ["playlists.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "seasons",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("series_id", sa.Integer(), nullable=False),
        sa.Column("season_num", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(512), nullable=True),
        sa.Column("cover", sa.Text(), nullable=True),
        sa.Column("air_date", sa.String(64), nullable=True),
        sa.ForeignKeyConstraint(["series_id"], ["series.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "episodes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("series_id", sa.Integer(), nullable=False),
        sa.Column("season_num", sa.Integer(), nullable=False),
        sa.Column("episode_id", sa.String(64), nullable=False),
        sa.Column("episode_num", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(512), nullable=True),
        sa.Column("container_extension", sa.String(16), nullable=True),
        sa.Column("added", sa.String(64), nullable=True),
        sa.Column("duration", sa.String(32), nullable=True),
        sa.ForeignKeyConstraint(["series_id"], ["series.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "downloads",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("playlist_id", sa.Integer(), nullable=False),
        sa.Column("content_type", sa.Enum("live", "vod", "series", name="contenttype"), nullable=False),
        sa.Column("stream_id", sa.String(64), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("language", sa.String(128), nullable=True),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("status", sa.Enum("queued", "downloading", "paused", "completed", "failed", "cancelled", name="downloadstatus"), nullable=False, server_default="queued"),
        sa.Column("progress_pct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("speed_bps", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("total_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("downloaded_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("chunks", sa.Integer(), nullable=False, server_default="16"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["playlist_id"], ["playlists.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "series_tracking",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("series_id", sa.Integer(), nullable=False),
        sa.Column("playlist_id", sa.Integer(), nullable=False),
        sa.Column("language", sa.String(128), nullable=False),
        sa.Column("track_all_seasons", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("seasons_json", sa.JSON(), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["series_id"], ["series.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["playlist_id"], ["playlists.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Indexes
    op.create_index("ix_categories_playlist_type", "categories", ["playlist_id", "type"])
    op.create_index("ix_live_streams_playlist", "live_streams", ["playlist_id"])
    op.create_index("ix_vod_streams_playlist", "vod_streams", ["playlist_id"])
    op.create_index("ix_series_playlist", "series", ["playlist_id"])
    op.create_index("ix_episodes_series", "episodes", ["series_id", "season_num"])
    op.create_index("ix_downloads_status", "downloads", ["status"])


def downgrade() -> None:
    op.drop_table("series_tracking")
    op.drop_table("downloads")
    op.drop_table("episodes")
    op.drop_table("seasons")
    op.drop_table("series")
    op.drop_table("vod_streams")
    op.drop_table("live_streams")
    op.drop_table("categories")
    op.drop_table("playlists")
    op.execute("DROP TYPE IF EXISTS categorytype")
    op.execute("DROP TYPE IF EXISTS contenttype")
    op.execute("DROP TYPE IF EXISTS downloadstatus")
