"""initial_ai_cache

Revision ID: fc46577a7c2d
Revises:
Create Date: 2026-07-02 16:19:17.831077
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'fc46577a7c2d'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('ai_cache',
        sa.Column('body_id', sa.String(length=100), nullable=False),
        sa.Column('classification', sa.String(length=50), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('alternatives', sa.JSON(), nullable=True),
        sa.Column('features', sa.JSON(), nullable=True),
        sa.Column('similar_objects', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('body_id')
    )
    op.create_table('prediction_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('body_id', sa.String(length=100), nullable=True),
        sa.Column('target', sa.String(length=50), nullable=False),
        sa.Column('feature_values', sa.JSON(), nullable=False),
        sa.Column('prediction', sa.Float(), nullable=False),
        sa.Column('ci_lower', sa.Float(), nullable=True),
        sa.Column('ci_upper', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('prediction_logs')
    op.drop_table('ai_cache')
