"""Model accuracy and integrity tests."""
import pytest
import pandas as pd
import joblib
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

FEATURES = [
    "orbital_period", "axial_tilt", "mass", "radius", "eccentricity",
    "density", "gravity", "temperature", "semi_major_axis", "inclination", "rotation_period",
]


def _load_pipeline():
    path = PROJECT_ROOT / "models" / "celestial_classifier.pkl"
    if not path.exists():
        pytest.skip("No trained model found. Run: python run.py train")
    return joblib.load(str(path))


def test_model_exists():
    assert (PROJECT_ROOT / "models" / "celestial_classifier.pkl").exists()


def test_model_metadata_exists():
    assert (PROJECT_ROOT / "models" / "celestial_classifier.meta.json").exists()


def test_model_accuracy_above_threshold():
    pipeline = _load_pipeline()
    df = pd.read_csv(PROJECT_ROOT / "data" / "celestial_objects.csv").fillna(0)
    X, y = df[FEATURES], df["body_type"]

    from sklearn.model_selection import train_test_split
    _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    acc = pipeline.score(X_test, y_test)
    assert acc >= 0.50, f"Accuracy {acc:.3f} < 0.50"


def test_model_has_expected_classes():
    pipeline = _load_pipeline()
    classes = pipeline.classes_.tolist()
    expected = {"Planet", "Moon", "Star", "DwarfPlanet", "Asteroid", "Comet", "Interstellar"}
    assert expected.issubset(set(classes)), f"Missing classes: {expected - set(classes)}"


def test_model_is_pipeline():
    pipeline = _load_pipeline()
    from sklearn.pipeline import Pipeline
    assert isinstance(pipeline, Pipeline)


def test_model_has_scaler_and_clf():
    pipeline = _load_pipeline()
    assert "scaler" in pipeline.named_steps
    assert "clf" in pipeline.named_steps


def test_model_metadata_has_required_fields():
    import json
    meta_path = PROJECT_ROOT / "models" / "celestial_classifier.meta.json"
    if not meta_path.exists():
        pytest.skip("No metadata file")
    meta = json.loads(meta_path.read_text())
    for field in ("model_type", "test_accuracy", "cv_accuracy_mean", "training_date"):
        assert field in meta, f"Missing field: {field}"
