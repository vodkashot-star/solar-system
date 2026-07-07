"""
Train regression models for predicting continuous celestial properties.
Saves to models/{target}_regressor.pkl with metadata.

Follows the same eval/prod-fit separation as train_model.py:
  1. Fit on train split  → honest held-out MAE / R²
  2. Fit fresh clone on full dataset → production model saved to disk

Usage:
    python src/train_regression.py                   # Train all targets
    python src/train_regression.py --target mass      # Single target
    python run.py train-regression                   # Via CLI
"""
import json
import sys
from datetime import datetime
from pathlib import Path

import joblib
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from predict import DATA_PATH, FEATURES

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR    = PROJECT_ROOT / "models"

TARGETS = {
    "mass":        {"unit": "Earth masses"},
    "temperature": {"unit": "K"},
}

# Each target excludes itself from the feature set to avoid trivial regression
EXCLUDED = {
    "mass":        ["mass"],
    "temperature": ["temperature"],
}


def train(target: str, verbose: bool = True) -> Pipeline:
    if target not in TARGETS:
        print(f"Unknown target '{target}'. Choose from: {list(TARGETS)}", file=sys.stderr)
        sys.exit(1)

    df = pd.read_csv(DATA_PATH).fillna(0)
    exclude      = EXCLUDED[target]
    feature_cols = [c for c in FEATURES if c not in exclude]

    X = df[feature_cols]
    y = df[target]

    # Only train on rows with a known (non-zero) target value
    mask = y != 0
    X, y = X[mask], y[mask]

    if verbose:
        print(f"Training {target} regressor on {len(y)} samples, {len(feature_cols)} features")

    base_pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("reg", RandomForestRegressor(n_estimators=100, random_state=42)),
    ])

    # ── Step 1: eval on held-out split ────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    eval_pipe = clone(base_pipe)
    eval_pipe.fit(X_train, y_train)
    y_pred = eval_pipe.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2  = r2_score(y_test, y_pred)

    if verbose:
        print(f"  MAE: {mae:.4f} {TARGETS[target]['unit']}")
        print(f"  R²:  {r2:.4f}")

    # ── Step 2: production model — fit on full dataset ────────────────────
    prod_pipe = clone(base_pipe)
    prod_pipe.fit(X, y)

    meta = {
        "target":        target,
        "unit":          TARGETS[target]["unit"],
        "n_samples":     int(len(y)),
        "n_features":    len(feature_cols),
        "test_mae":      round(float(mae), 4),
        "test_r2":       round(float(r2), 4),
        "training_date": datetime.now().isoformat(),
    }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODEL_DIR / f"{target}_regressor.pkl"
    meta_path  = model_path.with_suffix(".meta.json")

    joblib.dump(prod_pipe, model_path)
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    if verbose:
        print(f"Saved to {model_path}")

    return prod_pipe


def train_all(verbose: bool = True) -> None:
    for target in TARGETS:
        train(target, verbose=verbose)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Train regression models")
    parser.add_argument("--target", choices=list(TARGETS), help="Target (default: all)")
    args = parser.parse_args()
    if args.target:
        train(args.target)
    else:
        train_all()
