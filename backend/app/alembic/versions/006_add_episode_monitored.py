"""Add monitored flag to episodes
Revision ID: 006
Revises: 005
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "episodes",
        sa.Column("monitored", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )


def downgrade():
    op.drop_column("episodes", "monitored")
