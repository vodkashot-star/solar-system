#!/usr/bin/env python3
"""
SpaceAI CLI — Unified script for training, testing, querying, and serving.

Usage:
    python run.py train              Train RandomForest classifier
    python run.py test               Evaluate model on test split
    python run.py classify           Classify all objects in dataset
    python run.py query --features 88 0.034 0.055 0.383 0.205
    python run.py recommend --object-idx 1
    python run.py serve              Start FastAPI server on :8000
    python run.py serve --port 8080  Start on custom port
"""

import argparse
import sys
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
SRC = PROJECT_ROOT / "src"
sys.path.insert(0, str(SRC))


def cmd_train(args):
    from train_model import train
    train()


def cmd_test(args):
    import pandas as pd
    import joblib
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, accuracy_score
    from train_model import DATA_PATH, FEATURES, TARGET

    df = pd.read_csv(DATA_PATH)
    X = df[FEATURES].fillna(0)
    y = df[TARGET]

    _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model_path = PROJECT_ROOT / "models" / "celestial_classifier.pkl"
    if not model_path.exists():
        print("No trained model found. Run: python run.py train", file=sys.stderr)
        sys.exit(1)

    pipeline = joblib.load(str(model_path))
    y_pred = pipeline.predict(X_test)

    print(f"Test samples: {len(y_test)}")
    print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}\n")
    print(classification_report(y_test, y_pred))


def cmd_classify(args):
    import pandas as pd
    from predict import CelestialPredictor

    predictor = CelestialPredictor()
    if predictor.model is None:
        sys.exit(1)

    dataset = args.dataset or str(PROJECT_ROOT / "data" / "celestial_objects.csv")
    df = pd.read_csv(dataset)

    features = ["orbital_period", "axial_tilt", "mass", "radius", "eccentricity"]
    missing = [c for c in features if c not in df.columns]
    if missing:
        print(f"Missing columns: {missing}", file=sys.stderr)
        sys.exit(1)

    X = df[features]
    preds = predictor.predict_batch(X.values.tolist())
    df["prediction"] = preds

    cols = ["name"] + features + ["body_type", "prediction"]
    cols = [c for c in cols if c in df.columns]
    print(df[cols].to_string(index=False))

    if args.output:
        df.to_csv(args.output, index=False)
        print(f"\nSaved to {args.output}")


def cmd_query(args):
    from predict import CelestialPredictor

    predictor = CelestialPredictor()
    if predictor.model is None:
        sys.exit(1)

    orbital, tilt, mass, radius, ecc = args.features
    pred = predictor.predict(orbital, tilt, mass, radius, ecc)
    print(f"Classification: {pred}")

    if args.proba:
        probs = predictor.predict_proba(orbital, tilt, mass, radius, ecc)
        if probs is not None:
            print("\nProbabilities:")
            for cls, p in zip(predictor.classes_(), probs):
                print(f"  {cls}: {p:.4f}")


def cmd_recommend(args):
    import pandas as pd
    from recommend import recommend, cosine_similarity

    dataset = args.dataset or str(PROJECT_ROOT / "data" / "celestial_objects.csv")
    df = pd.read_csv(dataset)

    features = ["orbital_period", "axial_tilt", "mass"]
    missing = [c for c in features if c not in df.columns]
    if missing:
        print(f"Missing columns: {missing}", file=sys.stderr)
        sys.exit(1)

    objects = df[features].values.tolist()
    names = df.get("name", df.index.astype(str)).tolist()

    if args.features:
        query = list(args.features)
        query_name = "Query"
        query_idx = 0
        objects = [query] + objects
        names = [query_name] + names
    else:
        query_idx = args.object_idx or 0
        if query_idx >= len(objects):
            print(f"Index {query_idx} out of range (max {len(objects)-1})", file=sys.stderr)
            sys.exit(1)

    recs = recommend(objects, query_idx, args.top_k)

    print(f"{'Rank':<6} {'Name':<20} {'Similarity':<10}")
    print("-" * 36)
    for rank, (idx, sim) in enumerate(recs, 1):
        print(f"{rank:<6} {names[idx]:<20} {sim:.4f}")


def cmd_serve(args):
    import uvicorn
    uvicorn.run(
        "api:app",
        host="0.0.0.0",
        port=args.port,
        reload=args.reload,
    )


def main():
    parser = argparse.ArgumentParser(
        description="SpaceAI — Celestial classification and prediction",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # train
    sub.add_parser("train", help="Train RandomForest classifier")

    # test
    sub.add_parser("test", help="Evaluate model on held-out test set")

    # classify
    p_classify = sub.add_parser("classify", help="Classify all objects in dataset")
    p_classify.add_argument("--dataset", help="Path to CSV")
    p_classify.add_argument("--output", help="Save results to CSV")

    # query
    p_query = sub.add_parser("query", help="Classify a single object by features")
    p_query.add_argument("--features", nargs=5, type=float,
                         metavar=("ORBITAL", "TILT", "MASS", "RADIUS", "ECC"),
                         required=True, help="5 feature values")
    p_query.add_argument("--proba", action="store_true", help="Show class probabilities")

    # recommend
    p_rec = sub.add_parser("recommend", help="Find similar celestial objects")
    p_rec.add_argument("--dataset", help="Path to CSV")
    p_rec.add_argument("--object-idx", type=int, default=0, help="Index of reference object")
    p_rec.add_argument("--features", nargs=3, type=float,
                       metavar=("ORBITAL", "TILT", "MASS"), help="Custom query features")
    p_rec.add_argument("--top-k", type=int, default=3, help="Number of results")

    # serve
    p_serve = sub.add_parser("serve", help="Start FastAPI server")
    p_serve.add_argument("--port", type=int, default=8000)
    p_serve.add_argument("--reload", action="store_true", help="Auto-reload on changes")

    args = parser.parse_args()

    {
        "train": cmd_train,
        "test": cmd_test,
        "classify": cmd_classify,
        "query": cmd_query,
        "recommend": cmd_recommend,
        "serve": cmd_serve,
    }[args.command](args)


if __name__ == "__main__":
    main()
