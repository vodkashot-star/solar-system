"""
Train celestial object classifier
Trains a DecisionTreeClassifier on celestial data with CLI options
"""
import argparse
import sys
import pandas as pd
import numpy as np
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description="Train a celestial object classifier")
    parser.add_argument("--dataset", default=str(PROJECT_ROOT / "data" / "celestial_objects.csv"),
                        help="Path to training CSV")
    parser.add_argument("--output", default=str(PROJECT_ROOT / "models" / "celestial_classifier.pkl"),
                        help="Path to save trained model")
    parser.add_argument("--test-size", type=float, default=0.3, help="Test split ratio")
    parser.add_argument("--max-depth", type=int, default=5, help="Decision tree max depth")
    parser.add_argument("--debug", action="store_true", help="Verbose output")
    args = parser.parse_args()

    csv_path = Path(args.dataset)
    if not csv_path.exists():
        print(f"Dataset not found: {csv_path}", file=sys.stderr)
        sys.exit(1)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Loading dataset from {csv_path}")
    df = pd.read_csv(csv_path)
    print(f"Samples: {len(df)}, Classes: {df['type'].nunique()}")
    print(f"Class distribution: {df['type'].value_counts().to_dict()}")

    X = df[["orbital_period", "axial_tilt", "mass"]]
    y = df["type"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=42
    )

    model = DecisionTreeClassifier(random_state=42, max_depth=args.max_depth)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    accuracy = accuracy_score(y_test, preds)

    print(f"Accuracy: {accuracy:.2%}")
    if args.debug:
        print("\nClassification report:")
        print(classification_report(y_test, preds, zero_division=0))
        print("\nFeature importances:")
        for name, imp in zip(["orbital_period", "axial_tilt", "mass"], model.feature_importances_):
            print(f"  {name}: {imp:.3f}")

    joblib.dump(model, str(output_path))
    print(f"Model saved to {output_path}")


if __name__ == "__main__":
    main()
