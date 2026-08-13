"""
Celestial object prediction using trained Pipeline.
Features: orbital_period, axial_tilt, mass, radius, eccentricity,
          density, gravity, temperature, semi_major_axis, inclination, rotation_period
"""
import json
import sys
import joblib
import numpy as np
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = PROJECT_ROOT / "data" / "celestial_objects.csv"
DEFAULT_MODEL = PROJECT_ROOT / "models" / "celestial_classifier.pkl"
DEFAULT_META = DEFAULT_MODEL.with_suffix(".meta.json")
FEATURES = [
    "orbital_period", "axial_tilt", "mass", "radius", "eccentricity",
    "density", "gravity", "temperature", "semi_major_axis", "inclination", "rotation_period",
]


class CelestialPredictor:
    def __init__(self, model_path=None):
        path = Path(model_path or DEFAULT_MODEL)
        if not path.exists():
            alt = path.parent / "celestial_classifier_dt.pkl"
            path = alt if alt.exists() else path
        try:
            self.model = joblib.load(str(path))
        except FileNotFoundError:
            print(f"Model not found at {path}. Run: python src/train_model.py", file=sys.stderr)
            self.model = None

    def _X(self, orbital_period, axial_tilt, mass, radius, eccentricity,
           density=0, gravity=0, temperature=0, semi_major_axis=0, inclination=0, rotation_period=0):
        import pandas as pd
        return pd.DataFrame(
            [[orbital_period, axial_tilt, mass, radius, eccentricity,
              density, gravity, temperature, semi_major_axis, inclination, rotation_period]],
            columns=FEATURES,
        )

    def predict(self, orbital_period, axial_tilt, mass, radius, eccentricity,
                density=0, gravity=0, temperature=0, semi_major_axis=0, inclination=0, rotation_period=0):
        if self.model is None:
            return None
        return self.model.predict(self._X(orbital_period, axial_tilt, mass, radius, eccentricity,
                                          density, gravity, temperature, semi_major_axis, inclination, rotation_period))[0]

    def predict_proba(self, orbital_period, axial_tilt, mass, radius, eccentricity,
                      density=0, gravity=0, temperature=0, semi_major_axis=0, inclination=0, rotation_period=0):
        if self.model is None or not hasattr(self.model, "predict_proba"):
            return None
        return self.model.predict_proba(self._X(orbital_period, axial_tilt, mass, radius, eccentricity,
                                                density, gravity, temperature, semi_major_axis, inclination, rotation_period))[0]

    def classes_(self):
        if self.model is None:
            return []
        return self.model.classes_.tolist()

    def predict_batch(self, rows):
        if self.model is None:
            return [None] * len(rows)
        import pandas as pd
        rows_fixed = []
        for r in rows:
            if len(r) < 11:
                r = list(r) + [0] * (11 - len(r))
            rows_fixed.append(r[:11])
        X = pd.DataFrame(rows_fixed, columns=FEATURES)
        return self.model.predict(X).tolist()

    def predict_uncertainty(self, orbital_period, axial_tilt, mass, radius, eccentricity,
                            density=0, gravity=0, temperature=0, semi_major_axis=0, inclination=0, rotation_period=0):
        proba = self.predict_proba(
            orbital_period, axial_tilt, mass, radius, eccentricity,
            density, gravity, temperature, semi_major_axis, inclination, rotation_period,
        )
        if proba is None:
            return None
        proba_arr = np.clip(np.array(proba), 1e-12, 1.0)
        entropy = -np.sum(proba_arr * np.log(proba_arr))
        n = len(proba_arr)
        max_entropy = np.log(n)
        return float(entropy / max_entropy) if max_entropy > 0 else 0.0

    def feature_importances(self):
        if self.model is None:
            return None
        clf = self.model.named_steps.get("clf")
        if clf is None:
            return None
        # CalibratedClassifierCV keeps fitted fold models in
        # `calibrated_classifiers_` (`.estimator` stays an unfitted template)
        if hasattr(clf, "calibrated_classifiers_"):
            clf = clf.calibrated_classifiers_[0].estimator
        else:
            # Unwrap single-estimator wrappers — but only if the inner model is
            # actually fitted. Forests also expose `.estimator` as an *unfitted*
            # base-tree template, so gating on the fitted attrs keeps the
            # RandomForest itself (its own `feature_importances_` lives there).
            inner = getattr(clf, "estimator", None)
            if inner is not None and (
                hasattr(inner, "feature_importances_") or hasattr(inner, "coef_")
            ):
                clf = inner
        if hasattr(clf, "feature_importances_"):
            return clf.feature_importances_.tolist()
        if hasattr(clf, "coef_"):
            return clf.coef_.tolist()
        return None

    def load_meta(self):
        path = DEFAULT_META
        if not path.exists():
            return None
        with open(path) as f:
            return json.load(f)

    @property
    def model_metadata(self):
        return self.load_meta()
