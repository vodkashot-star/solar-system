"""
SQLAlchemy models and session management for SpaceAI cache.

Tables:
  ai_cache        — precomputed classification results per body_id
  prediction_logs — regression prediction history
  corrections     — user-submitted classification corrections
  model_versions  — tracked model versions for rollback
"""

from contextlib import contextmanager
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, JSON, Integer, Boolean, ForeignKey, create_engine
from sqlalchemy.orm import declarative_base, Session, sessionmaker, relationship

from config import DATABASE_URL

Base = declarative_base()


class AICache(Base):
    __tablename__ = "ai_cache"

    body_id = Column(String(100), primary_key=True)
    classification = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=False, default=0.0)
    uncertainty = Column(Float, nullable=False, default=0.0)
    alternatives = Column(JSON, default=list)
    features = Column(JSON, default=list)
    similar_objects = Column(JSON, default=list)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_type = Column(String(50), nullable=False)
    accuracy = Column(Float, nullable=True)
    cv_score = Column(Float, nullable=True)
    n_corrections = Column(Integer, default=0)
    tuned = Column(Boolean, default=False)
    augmented = Column(Boolean, default=False)
    n_samples = Column(Integer, nullable=True)
    model_path = Column(String(500), nullable=True)
    meta_path = Column(String(500), nullable=True)
    active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Correction(Base):
    __tablename__ = "corrections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    body_id = Column(String(100), nullable=False)
    predicted_type = Column(String(50), nullable=False)
    corrected_type = Column(String(50), nullable=False)
    features = Column(JSON, nullable=False)
    uncertainty = Column(Float, nullable=True)
    source = Column(String(50), default="user")
    model_version_id = Column(Integer, ForeignKey("model_versions.id"), nullable=True)
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
_SessionFactory = None


def get_engine():
    global _engine
    if _engine is None:
        connect_args = {}
        if DATABASE_URL.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        _engine = create_engine(DATABASE_URL, connect_args=connect_args)
    return _engine


def _get_session_factory():
    global _SessionFactory
    if _SessionFactory is None:
        _SessionFactory = sessionmaker(bind=get_engine())
    return _SessionFactory


def init_db():
    """Create all tables if they don't exist (idempotent)."""
    Base.metadata.create_all(get_engine())


@contextmanager
def get_session():
    """Context manager that yields a Session and guarantees close on exit."""
    factory = _get_session_factory()
    session = factory()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
