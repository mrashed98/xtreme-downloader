"""Provider metadata: VOD enrichment fields + adult flag, series backdrop/run-time/last_modified,
tracker last_modified cursor.
Revision ID: 007
Revises: 006
"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade():
    # VOD — persisted enrichment from get_vod_info + adult flag from list sync
    op.add_column("vod_streams", sa.Column("tmdb_id", sa.String(64), nullable=True))
    op.add_column("vod_streams", sa.Column("backdrop", sa.Text(), nullable=True))
    op.add_column("vod_streams", sa.Column("youtube_trailer", sa.Text(), nullable=True))
    op.add_column("vod_streams", sa.Column("release_date", sa.Text(), nullable=True))
    op.add_column(
        "vod_streams",
        sa.Column("is_adult", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    # Series — list-sync extras
    op.add_column("series", sa.Column("backdrop", sa.Text(), nullable=True))
    op.add_column("series", sa.Column("episode_run_time", sa.String(32), nullable=True))
    op.add_column("series", sa.Column("last_modified", sa.String(64), nullable=True))

    # Tracker cursor — independent from series.last_modified (which playlist sync overwrites)
    op.add_column("series_tracking", sa.Column("last_seen_modified", sa.String(64), nullable=True))


def downgrade():
    op.drop_column("series_tracking", "last_seen_modified")
    op.drop_column("series", "last_modified")
    op.drop_column("series", "episode_run_time")
    op.drop_column("series", "backdrop")
    op.drop_column("vod_streams", "is_adult")
    op.drop_column("vod_streams", "release_date")
    op.drop_column("vod_streams", "youtube_trailer")
    op.drop_column("vod_streams", "backdrop")
    op.drop_column("vod_streams", "tmdb_id")
