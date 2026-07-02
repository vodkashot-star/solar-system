"""FastAPI endpoint tests using TestClient."""
import pytest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
import sys
sys.path.insert(0, str(PROJECT_ROOT))

from api import app
from fastapi.testclient import TestClient

client = TestClient(app)

# Seed DB cache with precomputed classifications (needed by test_precomputed)
from src.precompute import precompute_all
precompute_all()

EARTH_PARAMS = (
    "?orbital_period=365.25&axial_tilt=23.44&mass=1.0&radius=1.0"
    "&eccentricity=0.017&density=5.51&gravity=9.81&temperature=288"
    "&semi_major_axis=1&inclination=0&rotation_period=24"
)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_precomputed():
    r = client.get("/precomputed")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, dict)
    assert len(data) > 0


def test_classify_earth():
    r = client.get(f"/classify/earth{EARTH_PARAMS}")
    assert r.status_code == 200
    data = r.json()
    assert data["classification"] == "Planet"
    assert data["confidence"] > 0.3
    assert "features" in data
    assert "similarObjects" in data
    assert "alternatives" in data


def test_classify_returns_alternatives():
    r = client.get(f"/classify/earth{EARTH_PARAMS}")
    data = r.json()
    assert len(data["alternatives"]) >= 2


def test_classify_returns_features():
    r = client.get(f"/classify/earth{EARTH_PARAMS}")
    data = r.json()
    assert len(data["features"]) == 11


def test_classify_returns_similar_objects():
    r = client.get(f"/classify/earth{EARTH_PARAMS}")
    data = r.json()
    assert len(data["similarObjects"]) >= 1


def test_classify_missing_params_returns_422():
    r = client.get("/classify/earth?orbital_period=365.25")
    assert r.status_code == 422


def test_classify_no_params_returns_422():
    r = client.get("/classify/earth")
    assert r.status_code == 422


def test_classify_sun():
    r = client.get(
        "/classify/sun?orbital_period=0&axial_tilt=7.25&mass=333000"
        "&radius=109&eccentricity=0&density=1.41&gravity=274"
        "&temperature=5778&semi_major_axis=0&inclination=0&rotation_period=660"
    )
    assert r.status_code == 200
    assert r.json()["classification"] == "Star"


def test_classify_mars():
    r = client.get(
        "/classify/mars?orbital_period=687&axial_tilt=25.19&mass=0.107"
        "&radius=0.532&eccentricity=0.094&density=3.93&gravity=3.71"
        "&temperature=210&semi_major_axis=1.52&inclination=1.85&rotation_period=24.6"
    )
    assert r.status_code == 200
    assert r.json()["classification"] == "Planet"


def test_predict_mass_endpoint():
    r = client.post("/predict/mass", json={"features": [365.25, 23.44, 1.0, 1.0, 0.017,
                                                        5.51, 9.81, 288, 1, 0, 24]})
    if r.status_code == 503:
        pytest.skip("Mass regressor not trained")
    assert r.status_code == 200
    data = r.json()
    assert "prediction" in data
    assert "confidence_interval" in data


def test_predict_temperature_endpoint():
    r = client.post("/predict/temperature", json={"features": [365.25, 23.44, 1.0, 1.0, 0.017,
                                                               5.51, 9.81, 288, 1, 0, 24]})
    if r.status_code == 503:
        pytest.skip("Temperature regressor not trained")
    assert r.status_code == 200
    data = r.json()
    assert "prediction" in data
    assert "confidence_interval" in data


def test_predict_mass_empty_features():
    r = client.post("/predict/mass", json={"features": []})
    assert r.status_code in (200, 503)


def test_classify_response_shape():
    r = client.get(f"/classify/earth{EARTH_PARAMS}")
    data = r.json()
    assert list(data.keys()) == ["classification", "confidence", "alternatives", "features", "similarObjects"]
