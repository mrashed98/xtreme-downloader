"""Widen overly-tight VARCHAR columns that overflow on real Xtream data

Revision ID: 005
Revises: 004
Create Date: 2026-02-21 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # series.release_date: VARCHAR(32) → TEXT  (providers send arbitrary date strings)
    op.alter_column("series", "release_date", type_=sa.Text(), existing_nullable=True)
    # series.youtube_trailer: VARCHAR(64) → TEXT  (URLs can exceed 64 chars)
    op.alter_column("series", "youtube_trailer", type_=sa.Text(), existing_nullable=True)
    # vod_streams.duration: VARCHAR(32) → VARCHAR(64)  (some providers use verbose formats)
    op.alter_column("vod_streams", "duration", type_=sa.String(64), existing_nullable=True)
    # episodes.duration: VARCHAR(32) → VARCHAR(64)
    op.alter_column("episodes", "duration", type_=sa.String(64), existing_nullable=True)


def downgrade() -> None:
    op.alter_column("episodes", "duration", type_=sa.String(32), existing_nullable=True)
    op.alter_column("vod_streams", "duration", type_=sa.String(32), existing_nullable=True)
    op.alter_column("series", "youtube_trailer", type_=sa.String(64), existing_nullable=True)
    op.alter_column("series", "release_date", type_=sa.String(32), existing_nullable=True)
