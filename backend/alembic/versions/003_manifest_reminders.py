from alembic import op
import sqlalchemy as sa

revision = "003_manifest_reminders"
down_revision = "002_assets_events"


def upgrade():
    op.create_table(
        "reminder_devices",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("subscription", sa.JSON(), nullable=False),
        sa.Column("schedules", sa.JSON(), nullable=False),
        sa.Column("timezone", sa.String(100), nullable=False),
        sa.Column("active", sa.Integer(), nullable=False),
        sa.Column("updated", sa.Float(), nullable=False),
        sa.Column("error", sa.String(80), nullable=False),
    )
    op.create_table(
        "reminder_deliveries",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("device", sa.String(64), nullable=False),
        sa.Column("schedule", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("next_attempt", sa.Float(), nullable=False),
        sa.Column("expires", sa.Float(), nullable=False),
    )
    op.create_index("ix_reminder_deliveries_device", "reminder_deliveries", ["device"])
    op.create_table(
        "reminder_worker",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("heartbeat", sa.Float(), nullable=False),
    )


def downgrade():
    op.drop_table("reminder_worker")
    op.drop_index("ix_reminder_deliveries_device", table_name="reminder_deliveries")
    op.drop_table("reminder_deliveries")
    op.drop_table("reminder_devices")
