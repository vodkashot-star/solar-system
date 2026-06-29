"""
Train RandomForest classifier on enriched celestial dataset and save model.
Features: orbital_period, axial_tilt, mass, radius, eccentricity
"""
import sys
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = PROJECT_ROOT / "data" / "celestial_objects.csv"
MODEL_PATH = PROJECT_ROOT / "models" / "celestial_classifier.pkl"

FEATURES = ["orbital_period", "axial_tilt", "mass", "radius", "eccentricity"]
TARGET = "body_type"


def train():
    df = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df)} rows, classes: {df[TARGET].unique().tolist()}")

    X = df[FEATURES].fillna(0)
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", RandomForestClassifier(
            n_estimators=100,
            max_depth=None,
            random_state=42,
            class_weight="balanced",
        )),
    ])

    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, MODEL_PATH)
    print(f"\nModel saved to {MODEL_PATH}")
    return pipeline


if __name__ == "__main__":
    train()
