"""
Precompute AI analysis for all known bodies from ASTRONOMICAL_DATA in bodies.ts.
Runs at FastAPI startup via the lifespan handler (in a thread executor to avoid
blocking the event loop).
"""
import json
import re
from pathlib import Path

import numpy as np

from cache import set as cache_set
from predict import CelestialPredictor, FEATURES

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BODIES_TS = PROJECT_ROOT.parent / "client" / "src" / "components" / "solar-system" / "bodies.ts"

FIELD_MAP = {
    "orbital_period": "orbitalPeriod",
    "axial_tilt": "axialTilt",
    "mass": "mass",
    "radius": "radius",
    "eccentricity": "eccentricity",
    "density": "density",
    "gravity": "gravity",
    "temperature": "temperature",
    "semi_major_axis": "semiMajorAxis",
    "inclination": "inclination",
    "rotation_period": "rotationPeriod",
}

# Number pattern: optional minus, digits, optional decimal, optional sci notation
_NUM = r"-?[\d.]+(?:[eE][+-]?\d+)?"


def parse_astronomical_data(path: Path) -> dict[str, list[float]]:
    """
    Parse ASTRONOMICAL_DATA from bodies.ts into {id: [11 feature floats]}.

    Uses a robust per-field regex approach rather than trying to match the entire
    block at once, which was fragile to nested `};` sequences.
    """
    text = path.read_text()
    bodies: dict[str, list[float]] = {}

    # Locate the ASTRONOMICAL_DATA object — find its opening brace
    header_match = re.search(r"const ASTRONOMICAL_DATA\s*[^=]*=\s*\{", text)
    if not header_match:
        print("[precompute] ASTRONOMICAL_DATA not found in bodies.ts")
        return bodies

    # Walk from the opening brace, tracking brace depth to find the closing brace
    start = header_match.end() - 1  # position of the opening '{'
    depth = 0
    block_end = start
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                block_end = i
                break

    block = text[start:block_end + 1]

    # Each top-level key is a body id; find all body sub-blocks
    # Match:  identifier: { ... }  at depth-1 inside the outer block
    body_pattern = re.compile(r"(\w+)\s*:\s*\{([^{}]*)\}", re.DOTALL)
    for m in body_pattern.finditer(block):
        body_id = m.group(1)
        body_text = m.group(2)
        features = []
        for py_key, ts_key in FIELD_MAP.items():
            match = re.search(rf"\b{ts_key}\s*:\s*({_NUM})", body_text)
            features.append(float(match.group(1)) if match else 0.0)
        bodies[body_id] = features

    return bodies


def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def precompute_all():
    """
    Classify all bodies and populate similarObjects for each.
    This is CPU-bound and should be called from a thread executor in async code.
    """
    if not BODIES_TS.exists():
        print("[precompute] bodies.ts not found, skipping")
        return

    predictor = CelestialPredictor()
    if predictor.model is None:
        print("[precompute] No model loaded, skipping")
        return

    bodies = parse_astronomical_data(BODIES_TS)
    if not bodies:
        print("[precompute] No bodies parsed — check ASTRONOMICAL_DATA regex")
        return

    print(f"[precompute] Parsed {len(bodies)} bodies from ASTRONOMICAL_DATA")

    classes = predictor.classes_()
    importances = np.array(predictor.feature_importances() or [1.0] * len(FEATURES))

    # Build scaled feature matrix for similarity (weight by feature importance)
    body_ids = list(bodies.keys())
    raw_matrix = np.array([bodies[bid] for bid in body_ids], dtype=float)

    # Importance-weighted vectors give better similarity than raw features
    # (avoids domination by mass/orbital_period which span many orders of magnitude)
    weighted_matrix = raw_matrix * importances

    results: dict[str, dict] = {}

    for idx, body_id in enumerate(body_ids):
        features = bodies[body_id]
        if len(features) < 11:
            features = features + [0.0] * (11 - len(features))

        proba = predictor.predict_proba(*features)
        if proba is None:
            continue

        sorted_idx = np.argsort(proba)[::-1]
        classification = classes[sorted_idx[0]]
        confidence = float(proba[sorted_idx[0]])
        uncertainty = predictor.predict_uncertainty(*features) or 0.0

        alternatives = [
            {"type": classes[i], "score": float(proba[i])}
            for i in sorted_idx[1:4]
        ]

        feat_list = [
            {"name": name, "value": val, "importance": float(imp)}
            for name, val, imp in zip(FEATURES, features, importances)
        ]

        # Compute cosine similarity against all other bodies using weighted features
        query_vec = weighted_matrix[idx]
        sims = []
        for j, other_id in enumerate(body_ids):
            if j == idx:
                continue
            sim = _cosine_sim(query_vec, weighted_matrix[j])
            sims.append((other_id, sim))
        sims.sort(key=lambda x: x[1], reverse=True)
        similar_objects = [
            {"bodyId": bid, "similarity": round(sim, 4)}
            for bid, sim in sims[:3]
        ]

        results[body_id] = {
            "classification": classification,
            "confidence": confidence,
            "uncertainty": uncertainty,
            "alternatives": alternatives,
            "features": feat_list,
            "similarObjects": similar_objects,
        }

    # Persist all at once
    for body_id, result in results.items():
        cache_set(body_id, result)

    # Also dump the flat JSON fallback that Express merges at startup
    # (server/routes.ts: FILE_CACHE_PATH). Same payload as the DB rows.
    json_path = PROJECT_ROOT / "data" / "ai_cache.json"
    json_path.write_text(json.dumps(results, indent=2))
    print(f"[precompute] Wrote {json_path} ({len(results)} bodies)")

    print(f"[precompute] Done — {len(results)} bodies precomputed")
