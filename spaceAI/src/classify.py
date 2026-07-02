"""
Celestial object classification script
Loads a trained model and classifies objects from CSV or stdin
"""
import argparse
import sys
import pandas as pd
from pathlib import Path
from predict import CelestialPredictor

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description="Classify celestial objects")
    parser.add_argument("--dataset", default=None, help="Path to CSV dataset")
    parser.add_argument("--model", default=None, help="Path to .pkl model")
    parser.add_argument("--output", default=None, help="Path to save results CSV")
    parser.add_argument("--debug", action="store_true", help="Verbose output")
    args = parser.parse_args()

    predictor = CelestialPredictor(args.model)
    if predictor.model is None:
        sys.exit(1)

    if args.dataset:
        df = pd.read_csv(args.dataset)
        from predict import FEATURES
        missing = [c for c in FEATURES if c not in df.columns]
        if missing:
            print(f"Missing columns: {missing}", file=sys.stderr)
            print(f"Available: {list(df.columns)}", file=sys.stderr)
            sys.exit(1)

        X = df[FEATURES]
        preds = predictor.predict_batch(X.values.tolist())
        df["prediction"] = preds
        print(df[FEATURES + ["prediction"]].to_string(index=False))

        if args.output:
            df.to_csv(args.output, index=False)
            print(f"\nSaved to {args.output}", file=sys.stderr)
    else:
        print("No dataset provided. Use --dataset or pipe features via stdin.", file=sys.stderr)
        print("Example: python src/classify.py --dataset data/celestial_objects.csv", file=sys.stderr)


if __name__ == "__main__":
    main()
