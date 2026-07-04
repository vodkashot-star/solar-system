"""
SQLAlchemy async-enabled models and session management for SpaceAI cache.

Tables:
  ai_cache        — precomputed classification results per body_id
  prediction_logs — regression prediction history
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, JSON, Integer, create_engine
from sqlalchemy.orm import declarative_base, Session

from config import DATABASE_URL

Base = declarative_base()


class AICache(Base):
    __tablename__ = "ai_cache"

    body_id = Column(String(100), primary_key=True)
    classification = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=False, default=0.0)
    alternatives = Column(JSON, default=list)
    features = Column(JSON, default=list)
    similar_objects = Column(JSON, default=list)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class Correction(Base):
    __tablename__ = "corrections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    body_id = Column(String(100), nullable=False)
    predicted_type = Column(String(50), nullable=False)
    corrected_type = Column(String(50), nullable=False)
    features = Column(JSON, nullable=False)
    uncertainty = Column(Float, nullable=True)
    source = Column(String(50), default="user")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class PredictionLog(Base):
    __tablename__ = "prediction_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    body_id = Column(String(100), nullable=True)
    target = Column(String(50), nullable=False)
    feature_values = Column(JSON, nullable=False)
    prediction = Column(Float, nullable=False)
    ci_lower = Column(Float, nullable=True)
    ci_upper = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


_engine = None


def get_engine():
    global _engine
    if _engine is None:
        connect_args = {}
        if DATABASE_URL.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        _engine = create_engine(DATABASE_URL, connect_args=connect_args)
    return _engine


def init_db():
    """Create all tables if they don't exist (idempotent)."""
    Base.metadata.create_all(get_engine())


def get_session() -> Session:
    return Session(get_engine())
