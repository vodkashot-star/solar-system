"""
Celestial object prediction using trained RandomForest pipeline.
Features: orbital_period, axial_tilt, mass, radius, eccentricity
"""
import sys
import joblib
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODEL = PROJECT_ROOT / "models" / "celestial_classifier.pkl"
FEATURES = ["orbital_period", "axial_tilt", "mass", "radius", "eccentricity"]


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

    def _X(self, orbital_period, axial_tilt, mass, radius, eccentricity):
        import pandas as pd
        return pd.DataFrame(
            [[orbital_period, axial_tilt, mass, radius, eccentricity]],
            columns=FEATURES,
        )

    def predict(self, orbital_period, axial_tilt, mass, radius, eccentricity):
        if self.model is None:
            return None
        return self.model.predict(self._X(orbital_period, axial_tilt, mass, radius, eccentricity))[0]

    def predict_proba(self, orbital_period, axial_tilt, mass, radius, eccentricity):
        if self.model is None or not hasattr(self.model, "predict_proba"):
            return None
        return self.model.predict_proba(self._X(orbital_period, axial_tilt, mass, radius, eccentricity))[0]

    def classes_(self):
        if self.model is None:
            return []
        return self.model.classes_.tolist()

    def predict_batch(self, rows):
        if self.model is None:
            return [None] * len(rows)
        import pandas as pd
        X = pd.DataFrame(rows, columns=FEATURES)
        return self.model.predict(X).tolist()

    def feature_importances(self):
        if self.model is None:
            return None
        clf = self.model.named_steps.get("clf")
        if clf is None or not hasattr(clf, "feature_importances_"):
            return None
        return clf.feature_importances_.tolist()
