"""Unit tests for CelestialPredictor."""
import pytest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
import sys
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from predict import CelestialPredictor, FEATURES


@pytest.fixture
def predictor():
    p = CelestialPredictor()
    if p.model is None:
        pytest.skip("No trained model found")
    return p


def test_predictor_loads(predictor):
    assert predictor.model is not None


def test_feature_list_has_11_entries():
    assert len(FEATURES) == 11


def test_feature_list_no_duplicates():
    assert len(FEATURES) == len(set(FEATURES))


def test_predict_returns_string(predictor):
    result = predictor.predict(365.25, 23.44, 1.0, 1.0, 0.017, 5.51, 9.81, 288, 1, 0, 24)
    assert isinstance(result, str)


def test_predict_with_defaults(predictor):
    result = predictor.predict(365.25, 23.44, 1.0, 1.0, 0.017)
    assert isinstance(result, str)


def test_predict_proba_returns_array(predictor):
    proba = predictor.predict_proba(365.25, 23.44, 1.0, 1.0, 0.017, 5.51, 9.81, 288, 1, 0, 24)
    assert proba is not None
    assert len(proba) > 0


def test_predict_proba_sums_to_one(predictor):
    proba = predictor.predict_proba(365.25, 23.44, 1.0, 1.0, 0.017, 5.51, 9.81, 288, 1, 0, 24)
    assert abs(sum(proba) - 1.0) < 1e-6


def test_classes_returns_list(predictor):
    classes = predictor.classes_()
    assert isinstance(classes, list)
    assert len(classes) >= 5


def test_earth_predicted_as_planet(predictor):
    pred = predictor.predict(365.25, 23.44, 1.0, 1.0, 0.017, 5.51, 9.81, 288, 1, 0, 24)
    assert pred == "Planet"


def test_sun_predicted_as_star(predictor):
    pred = predictor.predict(0, 7.25, 333000, 109, 0, 1.41, 274, 5778, 0, 0, 660)
    assert pred == "Star"


def test_predict_batch_returns_list(predictor):
    rows = [
        [365.25, 23.44, 1.0, 1.0, 0.017, 5.51, 9.81, 288, 1, 0, 24],
        [687, 25.19, 0.107, 0.532, 0.094, 3.93, 3.71, 210, 1.52, 1.85, 24.6],
    ]
    results = predictor.predict_batch(rows)
    assert len(results) == 2
    assert all(isinstance(r, str) for r in results)


def test_predict_batch_pads_short_rows(predictor):
    rows = [[365.25, 23.44, 1.0, 1.0, 0.017]]
    results = predictor.predict_batch(rows)
    assert len(results) == 1
    assert isinstance(results[0], str)


def test_feature_importances_not_none(predictor):
    imps = predictor.feature_importances()
    assert imps is not None
    assert len(imps) == 11


def test_feature_importances_sum_to_one(predictor):
    imps = predictor.feature_importances()
    if imps:
        assert abs(sum(imps) - 1.0) < 0.1


def test_model_metadata_returns_dict(predictor):
    meta = predictor.model_metadata
    assert meta is not None
    assert "model_type" in meta
