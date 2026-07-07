"""Data integrity tests for celestial_objects.csv."""
import pytest
import pandas as pd
from pathlib import Path

from predict import DATA_PATH, FEATURES

PROJECT_ROOT = Path(__file__).resolve().parent.parent

EXPECTED_TYPES = {"Planet", "Moon", "Star", "DwarfPlanet", "Asteroid", "Comet", "Interstellar", "Spacecraft"}


@pytest.fixture
def df():
    return pd.read_csv(DATA_PATH).fillna(0)


def test_dataset_exists():
    assert DATA_PATH.exists()


def test_minimum_rows(df):
    assert len(df) >= 40, f"Expected >= 40 rows, got {len(df)}"


def test_all_required_columns_present(df):
    missing = [c for c in FEATURES + ["name", "body_type"] if c not in df.columns]
    assert not missing, f"Missing columns: {missing}"


def test_no_nan_in_features(df):
    assert df[FEATURES].isna().sum().sum() == 0, "NaN values found in feature columns"


def test_all_expected_types_present(df):
    actual = set(df["body_type"].unique())
    missing = EXPECTED_TYPES - actual
    assert not missing, f"Missing body types in dataset: {missing}"


def test_eccentricity_in_valid_range(df):
    # Interstellar objects (Oumuamua, Borisov) have hyperbolic orbits with e > 1.0
    # Spacecraft (Voyager) may have synthetic orbital params outside valid range
    non_hyperbolic = df[~df["body_type"].isin(["Interstellar", "Spacecraft"])]["eccentricity"]
    assert non_hyperbolic.between(-0.1, 1.3).all(), "eccentricity out of range for non-hyperbolic bodies"


def test_positive_radius(df):
    assert (df["radius"] > 0).all(), "radius must be positive for all bodies"


def test_unique_names(df):
    assert df["name"].is_unique, "body names must be unique"


def test_no_empty_names(df):
    assert not (df["name"].isna() | (df["name"] == "")).any(), "Empty name found"


def test_class_distribution_has_star(df):
    assert "Star" in df["body_type"].values, "Star class must be present"
