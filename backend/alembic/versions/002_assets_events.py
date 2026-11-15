from alembic import op
import sqlalchemy as sa

revision = "002_assets_events"
down_revision = "001_content"


def upgrade():
    op.create_table(
        "stored_assets",
        sa.Column("sha256", sa.String(64), primary_key=True),
        sa.Column("asset_id", sa.String(80), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("bytes", sa.Integer(), nullable=False),
        sa.Column("seconds", sa.Float(), nullable=False),
        sa.Column("created_by", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "pack_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "pack_id", sa.String(80), sa.ForeignKey("content_packs.id"), nullable=False
        ),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("actor", sa.String(200), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_pack_events_pack_id", "pack_events", ["pack_id"])


def downgrade():
    op.drop_index("ix_pack_events_pack_id", table_name="pack_events")
    op.drop_table("pack_events")
    op.drop_table("stored_assets")
