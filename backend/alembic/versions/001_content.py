from alembic import op
import sqlalchemy as sa
revision = "001_content"
down_revision = None

def upgrade():
    op.create_table("content_packs",
        sa.Column("id", sa.String(80), primary_key=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False))

def downgrade():
    op.drop_table("content_packs")
