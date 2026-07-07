#!/usr/bin/env python3
"""
Validate generated GLB models against the spaceAI ML classifier.

For each body that has a GLB file, classifies it using the trained model
and reports mismatches against the expected type from celestial_objects.csv.

Usage:
    python3 scripts/validate_models.py
    npm run models:validate

Exit codes:
    0 — all bodies classified correctly (or no GLB present for a body)
    1 — one or more classification mismatches found
    2 — fatal error (model not loaded, data not parsed)
"""
import sys
import csv
import numpy as np
from pathlib import Path

# Add spaceAI/src to path — reuse parse_astronomical_data (single source of truth)
SPACEAI_SRC = Path(__file__).resolve().parent.parent / "spaceAI" / "src"
sys.path.insert(0, str(SPACEAI_SRC))

from predict import CelestialPredictor
from precompute import parse_astronomical_data

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR   = PROJECT_ROOT / "client" / "public" / "models"
BODIES_TS    = PROJECT_ROOT / "client" / "src" / "components" / "solar-system" / "bodies.ts"
CSV_PATH     = PROJECT_ROOT / "spaceAI" / "data" / "celestial_objects.csv"

# ── Expected types from training CSV ──────────────────────────────────────
expected: dict[str, str] = {}
with open(CSV_PATH, newline="") as f:
    for row in csv.DictReader(f):
        expected[row["name"].strip().lower()] = row["body_type"]

# ── Body features from bodies.ts ASTRONOMICAL_DATA ────────────────────────
body_features = parse_astronomical_data(BODIES_TS)
if not body_features:
    print("ERROR: could not parse ASTRONOMICAL_DATA from bodies.ts", file=sys.stderr)
    sys.exit(2)

# ── ML model ──────────────────────────────────────────────────────────────
predictor = CelestialPredictor()
if predictor.model is None:
    print("ERROR: could not load model. Run: npm run ai:train", file=sys.stderr)
    sys.exit(2)

meta    = predictor.model_metadata or {}
classes = predictor.classes_()

print(f"Model: {meta.get('model_type','?')}  "
      f"CV={meta.get('cv_accuracy_mean', 0):.3f} ± {meta.get('cv_accuracy_std', 0):.3f}")
print(f"Classifying {len(body_features)} bodies with GLB files...\n")
print(f"{'Body':<22} {'Expected':<16} {'Predicted':<16} {'OK':<5} {'Conf'}")
print("─" * 76)

total      = 0
mismatches = 0

for name in sorted(body_features):
    if not (MODELS_DIR / f"{name}.glb").exists():
        continue  # no GLB → skip silently

    total += 1
    proba = predictor.predict_proba(*body_features[name])
    if proba is None:
        continue

    sorted_idx = np.argsort(proba)[::-1]
    predicted  = classes[sorted_idx[0]]
    confidence = float(proba[sorted_idx[0]])
    exp        = expected.get(name, "?")
    ok         = predicted.lower() == exp.lower()

    if not ok:
        mismatches += 1
        alts = "  alts: " + " ".join(
            f"{classes[i]}({proba[i]:.2f})" for i in sorted_idx[1:3]
        )
    else:
        alts = ""

    print(f"{name:<22} {exp:<16} {predicted:<16} {'✓' if ok else '✗':<5} {confidence:.3f}{alts}")

print(f"\n{'─' * 76}")
print(f"Checked {total} bodies — {mismatches} mismatch(es), {total - mismatches} correct")

if mismatches:
    print("\nTIP: Run  npm run ai:train  to retrain the classifier.")
    sys.exit(1)

sys.exit(0)
