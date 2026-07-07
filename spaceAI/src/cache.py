"""
Persistent DB cache for AI analysis results using SQLAlchemy.

Supports PostgreSQL (via SPACEAI_DATABASE_URL env var) and SQLite (default).
Exposes the same public API as the previous JSON-file backend:
    get_all() -> dict
    get(body_id) -> dict | None
    set(body_id, result) -> None
    load_cache() -> dict
    save_cache(data) -> None
"""

from datetime import datetime, timezone
from database import AICache, get_session, init_db


def _row_to_dict(row: AICache) -> dict:
    return {
        "classification": row.classification,
        "confidence": row.confidence,
        "uncertainty": row.uncertainty or 0.0,
        "alternatives": row.alternatives or [],
        "features": row.features or [],
        "similarObjects": row.similar_objects or [],
    }


def load_cache() -> dict:
    """Load all cache entries as {body_id: result_dict}."""
    init_db()
    with get_session() as session:
        rows = session.query(AICache).all()
    return {row.body_id: _row_to_dict(row) for row in rows}


def save_cache(data: dict):
    """Replace all cache entries with the given dict of results."""
    init_db()
    with get_session() as session:
        session.query(AICache).delete()
        for body_id, result in data.items():
            session.add(
                AICache(
                    body_id=body_id,
                    classification=result.get("classification", ""),
                    confidence=result.get("confidence", 0.0),
                    uncertainty=result.get("uncertainty", 0.0),
                    alternatives=result.get("alternatives", []),
                    features=result.get("features", []),
                    similar_objects=result.get("similarObjects", []),
                )
            )
        session.commit()


def get_all() -> dict:
    return load_cache()


def get(body_id: str) -> dict | None:
    init_db()
    with get_session() as session:
        row = session.query(AICache).filter_by(body_id=body_id).first()
    return _row_to_dict(row) if row else None


def set(body_id: str, result: dict):
    init_db()
    with get_session() as session:
        row = session.query(AICache).filter_by(body_id=body_id).first()
        if row is None:
            row = AICache(body_id=body_id)
            session.add(row)
        row.classification = result.get("classification", row.classification)
        row.confidence = result.get("confidence", row.confidence)
        row.uncertainty = result.get("uncertainty", row.uncertainty or 0.0)
        row.alternatives = result.get("alternatives", row.alternatives)
        row.features = result.get("features", row.features)
        row.similar_objects = result.get("similarObjects", row.similar_objects)
        row.updated_at = datetime.now(timezone.utc)
        session.commit()
