"""
Precompute AI analysis for all known bodies from ASTRONOMICAL_DATA.
Runs at FastAPI startup via lifespan handler.
"""
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


def parse_astronomical_data(path: Path) -> dict[str, list[float]]:
    """Parse ASTRONOMICAL_DATA from bodies.ts into {id: [11 feature floats]}."""
    text = path.read_text()
    bodies: dict[str, list[float]] = {}

    block_match = re.search(r"const ASTRONOMICAL_DATA.*?= \{(.*?)\};", text, re.DOTALL)
    if not block_match:
        return bodies

    block = block_match.group(1)
    body_blocks = re.findall(r"(\w+):\s*\{(.*?)\}", block, re.DOTALL)
    for name, body_text in body_blocks:
        features = []
        for py_key, ts_key in FIELD_MAP.items():
            m = re.search(rf"{ts_key}:\s*(-?[\d.]+(?:e[+-]?\d+)?)", body_text)
            features.append(float(m.group(1)) if m else 0.0)
        bodies[name] = features

    return bodies


def precompute_all():
    if not BODIES_TS.exists():
        print("[precompute] bodies.ts not found, skipping precompute")
        return

    predictor = CelestialPredictor()
    if predictor.model is None:
        print("[precompute] No model loaded, skipping")
        return

    bodies = parse_astronomical_data(BODIES_TS)
    print(f"[precompute] Parsed {len(bodies)} bodies from ASTRONOMICAL_DATA")

    classes = predictor.classes_()
    importances = predictor.feature_importances() or [0.0] * len(FEATURES)

    for body_id, features in bodies.items():
        if len(features) < 11:
            features = features + [0.0] * (11 - len(features))

        proba = predictor.predict_proba(*features)
        if proba is None:
            continue

        sorted_idx = np.argsort(proba)[::-1]
        classification = classes[sorted_idx[0]]
        confidence = float(proba[sorted_idx[0]])

        alternatives = [
            {"type": classes[i], "score": float(proba[i])}
            for i in sorted_idx[1:4]
        ]

        feat_list = [
            {"name": name, "value": val, "importance": imp}
            for name, val, imp in zip(FEATURES, features, importances)
        ]

        result = {
            "classification": classification,
            "confidence": confidence,
            "alternatives": alternatives,
            "features": feat_list,
            "similarObjects": [],
        }
        cache_set(body_id, result)

    print(f"[precompute] Precomputed {len(bodies)} classifications")
