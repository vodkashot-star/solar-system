"""
Validate generated GLB models against spaceAI ML classification.
After running GLB generation, this script checks each body's physical features
against the trained classifier and reports mismatches.

Run: python3 scripts/validate_models.py
"""
import sys
import json
import csv
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "spaceAI" / "src"))
from predict import CelestialPredictor, FEATURES

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = PROJECT_ROOT / "client" / "public" / "models"
BODIES_TS = PROJECT_ROOT / "client" / "src" / "components" / "solar-system" / "bodies.ts"
CSV_PATH = PROJECT_ROOT / "spaceAI" / "data" / "celestial_objects.csv"

# Load expected types from CSV
expected: dict[str, str] = {}
with open(CSV_PATH, newline="") as f:
    for row in csv.DictReader(f):
        expected[row["name"].strip().lower()] = row["body_type"]

# Load body features from bodies.ts ASTRONOMICAL_DATA
import re

ts_text = BODIES_TS.read_text()
block_match = re.search(r"const ASTRONOMICAL_DATA.*?= \{(.*?)\};", ts_text, re.DOTALL)
if not block_match:
    print("ERROR: could not parse ASTRONOMICAL_DATA from bodies.ts")
    sys.exit(1)

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

body_blocks = re.findall(r"(\w+):\s*\{(.*?)\}", block_match.group(1), re.DOTALL)
body_features: dict[str, list[float]] = {}
for name, body_text in body_blocks:
    props = {}
    for csv_key, ts_key in FIELD_MAP.items():
        m = re.search(rf"{ts_key}:\s*(-?[\d.]+(?:e[+-]?\d+)?)", body_text)
        props[csv_key] = float(m.group(1)) if m else 0
    body_features[name] = [props[k] for k in FEATURES]

# Load ML model
predictor = CelestialPredictor()
if predictor.model is None:
    print("ERROR: could not load model. Run: npm run ai:train")
    sys.exit(1)

print(f"Model loaded — classifying {len(body_features)} bodies...\n")
print(f"{'Body':<20} {'Expected':<16} {'Predicted':<16} {'Match':<8} {'Confidence'}")
print("-" * 80)

total = 0
mismatches = 0
for name, features in sorted(body_features.items()):
    glb_path = MODELS_DIR / f"{name}.glb"
    if not glb_path.exists():
        continue

    total += 1
    proba = predictor.predict_proba(*features)
    classes = predictor.classes_()
    if proba is None:
        continue

    import numpy as np

    sorted_idx = np.argsort(proba)[::-1]
    predicted = classes[sorted_idx[0]]
    confidence = float(proba[sorted_idx[0]])

    exp = expected.get(name, "?")
    match = "✓" if predicted.lower() == exp.lower() else "✗"
    if match == "✗":
        mismatches += 1
        alt_info = " | alt: "
        for i in sorted_idx[1:4]:
            alt_info += f"{classes[i]}({proba[i]:.2f}) "
    else:
        alt_info = ""

    print(f"{name:<20} {exp:<16} {predicted:<16} {match:<8} {confidence:.3f}{alt_info}")

print(f"\n{mismatches}/{total} mismatches found")
if mismatches:
    print("TIP: Above-average mismatches may indicate the model needs retraining")
    print("     or the body's physical features are unusual for its type.")
