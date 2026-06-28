"""
Setup and train celestial classifier
Quick-start script: creates a sample dataset and trains a DecisionTreeClassifier
"""
import argparse
import sys
import pandas as pd
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import joblib
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description="Quick-start training for celestial classifier")
    parser.add_argument("--output", default=str(PROJECT_ROOT / "models" / "celestial_classifier_dt.pkl"),
                        help="Path to save trained model")
    parser.add_argument("--debug", action="store_true", help="Verbose output")
    args = parser.parse_args()

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    data_dir = PROJECT_ROOT / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    csv_path = data_dir / "celestial_objects.csv"
    if not csv_path.exists():
        print("Creating sample dataset...")
        data = {
            "orbital_period": [365, 27.3, 687, 4332, 11.9, 248],
            "axial_tilt": [23.5, 6.7, 25.2, 3.1, 0.0, 119.6],
            "mass": [5.97e24, 7.35e22, 6.42e23, 1.90e27, 3.30e23, 1.31e22],
            "type": ["Planet", "Moon", "Planet", "Planet", "Asteroid", "DwarfPlanet"],
        }
        df = pd.DataFrame(data)
        df.to_csv(csv_path, index=False)
        print(f"Dataset created: {csv_path}")
    else:
        print(f"Loading existing dataset from {csv_path}")
        df = pd.read_csv(csv_path)

    X = df[["orbital_period", "axial_tilt", "mass"]]
    y = df["type"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
    model = DecisionTreeClassifier(random_state=42)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    accuracy = accuracy_score(y_test, preds)

    joblib.dump(model, str(output_path))

    print(f"Accuracy: {accuracy:.2%}")
    print(f"Model saved: {output_path}")
    print(f"Samples: {len(df)}, Classes: {df['type'].nunique()}")
    if args.debug:
        print(f"Object types: {df['type'].value_counts().to_dict()}")


if __name__ == "__main__":
    main()
