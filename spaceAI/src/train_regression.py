"""
Train regression models for predicting continuous celestial properties.
Saves to models/{target}_regressor.pkl with metadata.

Usage:
    python src/train_regression.py                         # Train all targets
    python src/train_regression.py --target mass            # Single target
"""
import json
import sys
from datetime import datetime
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from predict import DATA_PATH, FEATURES

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = PROJECT_ROOT / "models"

TARGETS = {
    "mass": {"unit": "Earth masses"},
    "temperature": {"unit": "K"},
}

EXCLUDED = {
    "mass": ["mass"],
    "temperature": ["temperature"],
}


def train(target: str, verbose: bool = True):
    df = pd.read_csv(DATA_PATH).fillna(0)
    exclude = EXCLUDED.get(target, [])
    feature_cols = [c for c in FEATURES if c not in exclude]

    X = df[feature_cols]
    y = df[target]

    mask = y != 0  # Only train on bodies with known values
    X, y = X[mask], y[mask]

    if verbose:
        print(f"Training {target} regressor on {len(y)} samples, {len(feature_cols)} features")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("reg", RandomForestRegressor(n_estimators=100, random_state=42)),
    ])

    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    meta = {
        "target": target,
        "unit": TARGETS[target]["unit"],
        "n_samples": int(len(y)),
        "n_features": len(feature_cols),
        "test_mae": round(float(mae), 4),
        "test_r2": round(float(r2), 4),
        "training_date": datetime.now().isoformat(),
    }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODEL_DIR / f"{target}_regressor.pkl"
    meta_path = model_path.with_suffix(".meta.json")

    joblib.dump(pipeline, model_path)
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    if verbose:
        print(f"  MAE: {mae:.4f} {TARGETS[target]['unit']}")
        print(f"  R²:  {r2:.4f}")
        print(f"Saved to {model_path}")

    return pipeline


def train_all(verbose=True):
    for target in TARGETS:
        train(target, verbose=verbose)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Train regression models")
    parser.add_argument("--target", choices=list(TARGETS.keys()), help="Target to train (default: all)")
    args = parser.parse_args()

    if args.target:
        train(args.target)
    else:
        train_all()
