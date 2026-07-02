"""
Persistent JSON cache for AI analysis results.
Stored at data/ai_cache.json.
"""
import json
from pathlib import Path

CACHE_PATH = Path(__file__).resolve().parent.parent / "data" / "ai_cache.json"


def load_cache() -> dict:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text())
    return {}


def save_cache(data: dict):
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(data, indent=2))


def get_all() -> dict:
    return load_cache()


def get(body_id: str) -> dict | None:
    return load_cache().get(body_id)


def set(body_id: str, result: dict):
    cache = load_cache()
    cache[body_id] = result
    save_cache(cache)
