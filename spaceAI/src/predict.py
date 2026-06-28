"""
Celestial Object Prediction Service
Loads trained ML model and makes predictions on celestial objects
"""
import argparse
import joblib
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODEL = PROJECT_ROOT / "models" / "celestial_classifier.pkl"


class CelestialPredictor:
    def __init__(self, model_path=None):
        model_path = model_path or DEFAULT_MODEL
        if not Path(model_path).exists():
            alt = Path(model_path).parent / "celestial_classifier_dt.pkl"
            if alt.exists():
                model_path = alt
        try:
            self.model = joblib.load(str(model_path))
            print(f"Model loaded from {model_path}", file=sys.stderr)
        except FileNotFoundError:
            print(f"Model not found at {model_path}", file=sys.stderr)
            print("Train a model first: poetry run python src/train_model.py", file=sys.stderr)
            self.model = None

    def predict(self, orbital_period, axial_tilt, mass):
        if self.model is None:
            return None
        return self.model.predict([[orbital_period, axial_tilt, mass]])[0]

    def predict_batch(self, data_list):
        if self.model is None:
            return None
        return self.model.predict(data_list).tolist()

    def predict_proba(self, orbital_period, axial_tilt, mass):
        if self.model is None or not hasattr(self.model, "predict_proba"):
            return None
        return self.model.predict_proba([[orbital_period, axial_tilt, mass]])[0]

    def feature_importances(self):
        if self.model is None or not hasattr(self.model, "feature_importances_"):
            return None
        return self.model.feature_importances_.tolist()

    def classes_(self):
        if self.model is None:
            return []
        return self.model.classes_.tolist()


def main():
    parser = argparse.ArgumentParser(description="Classify a celestial object")
    parser.add_argument("--orbital-period", type=float, default=365, help="Orbital period in days")
    parser.add_argument("--axial-tilt", type=float, default=23.5, help="Axial tilt in degrees")
    parser.add_argument("--mass", type=float, default=5.97e24, help="Mass in kg")
    parser.add_argument("--model", default=str(DEFAULT_MODEL), help="Path to .pkl model")
    parser.add_argument("--debug", action="store_true", help="Show prediction details")
    args = parser.parse_args()

    predictor = CelestialPredictor(args.model)
    if predictor.model is None:
        sys.exit(1)

    result = predictor.predict(args.orbital_period, args.axial_tilt, args.mass)
    print(f"Prediction: {result}")

    if args.debug:
        probs = predictor.predict_proba(args.orbital_period, args.axial_tilt, args.mass)
        if probs is not None:
            print("\nClass probabilities:")
            for cls, prob in zip(predictor.classes_(), probs):
                print(f"  {cls}: {prob:.3f}")
        fi = predictor.feature_importances()
        if fi is not None:
            features = ["orbital_period", "axial_tilt", "mass"]
            print("\nFeature importances:")
            for name, imp in zip(features, fi):
                print(f"  {name}: {imp:.3f}")


if __name__ == "__main__":
    main()
