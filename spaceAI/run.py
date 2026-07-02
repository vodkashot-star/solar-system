#!/usr/bin/env python3
"""
SpaceAI CLI — Unified script for training, testing, querying, and serving.

Usage:
    python run.py train                                    RandomForest (default)
    python run.py train --model-type svc                   SVC
    python run.py train --model-type logreg --tune          Tuned LogisticRegression
    python run.py cv                                       Cross-validate saved model
    python run.py test                                     Evaluate model on test split
    python run.py classify                                 Classify all objects in dataset
    python run.py query --features <11 floats>             Single classification
    python run.py recommend --object-idx 1                 Similar objects
    python run.py train-regression [--target mass|temp]    Train regression model
    python run.py predict-mass --features <11 floats>      Predict mass from features
    python run.py predict-temperature --features <11 f>    Predict temperature
    python run.py serve                                    Start FastAPI server
"""

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
SRC = PROJECT_ROOT / "src"
sys.path.insert(0, str(SRC))


def cmd_train(args):
    from train_model import train
    train(model_type=args.model_type, tune=args.tune)


def cmd_cv(args):
    from train_model import cross_validate
    cross_validate()


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
    from predict import CelestialPredictor, FEATURES

    predictor = CelestialPredictor()
    if predictor.model is None:
        sys.exit(1)

    dataset = args.dataset or str(PROJECT_ROOT / "data" / "celestial_objects.csv")
    df = pd.read_csv(dataset)

    missing = [c for c in FEATURES if c not in df.columns]
    if missing:
        print(f"Missing columns: {missing}", file=sys.stderr)
        sys.exit(1)

    X = df[FEATURES]
    preds = predictor.predict_batch(X.values.tolist())
    df["prediction"] = preds

    cols = ["name"] + FEATURES + ["body_type", "prediction"]
    cols = [c for c in cols if c in df.columns]
    print(df[cols].to_string(index=False))

    if args.output:
        df.to_csv(args.output, index=False)
        print(f"\nSaved to {args.output}")


def cmd_query(args):
    from predict import CelestialPredictor, FEATURES

    predictor = CelestialPredictor()
    if predictor.model is None:
        sys.exit(1)

    vals = args.features
    if len(vals) < 11:
        vals = list(vals) + [0] * (11 - len(vals))
    pred = predictor.predict(*vals)
    print(f"Classification: {pred}")

    if args.proba:
        probs = predictor.predict_proba(*vals)
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


def cmd_train_regression(args):
    from train_regression import train_all, train as train_target
    if args.target:
        train_target(args.target)
    else:
        train_all()


def cmd_predict_mass(args):
    import joblib
    import pandas as pd
    from train_regression import FEATURES
    from sklearn.pipeline import Pipeline

    model = joblib.load(str(PROJECT_ROOT / "models" / "mass_regressor.pkl"))
    exclude = ["mass"]
    feature_cols = [c for c in FEATURES if c not in exclude]
    vals = (list(args.features) + [0] * 11)[:11]
    feature_vals = [v for i, v in enumerate(vals) if FEATURES[i] not in exclude]
    X = pd.DataFrame([feature_vals], columns=feature_cols)
    pred = float(model.predict(X)[0])
    print(f"Predicted mass: {pred:.4f} Earth masses")


def cmd_predict_temperature(args):
    import joblib
    import pandas as pd
    from train_regression import FEATURES
    from sklearn.pipeline import Pipeline

    model = joblib.load(str(PROJECT_ROOT / "models" / "temperature_regressor.pkl"))
    exclude = ["temperature"]
    feature_cols = [c for c in FEATURES if c not in exclude]
    vals = (list(args.features) + [0] * 11)[:11]
    feature_vals = [v for i, v in enumerate(vals) if FEATURES[i] not in exclude]
    X = pd.DataFrame([feature_vals], columns=feature_cols)
    pred = float(model.predict(X)[0])
    print(f"Predicted temperature: {pred:.2f} K")


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
    p_train = sub.add_parser("train", help="Train classifier")
    p_train.add_argument("--model-type", choices=["rf", "svc", "logreg"], default="rf",
                         help="Classifier type (default: rf)")
    p_train.add_argument("--tune", action="store_true",
                         help="Run GridSearchCV with StratifiedKFold(3)")

    # cv
    sub.add_parser("cv", help="Cross-validate saved model with StratifiedKFold(3)")

    # test
    sub.add_parser("test", help="Evaluate model on held-out test set")

    # classify
    p_classify = sub.add_parser("classify", help="Classify all objects in dataset")
    p_classify.add_argument("--dataset", help="Path to CSV")
    p_classify.add_argument("--output", help="Save results to CSV")

    # query
    p_query = sub.add_parser("query", help="Classify a single object by features")
    p_query.add_argument("--features", nargs="+", type=float,
                         metavar="VAL",
                         required=True, help="11 feature values (orbital_period axial_tilt mass radius eccentricity density gravity temperature semi_major_axis inclination rotation_period)")
    p_query.add_argument("--proba", action="store_true", help="Show class probabilities")

    # recommend
    p_rec = sub.add_parser("recommend", help="Find similar celestial objects")
    p_rec.add_argument("--dataset", help="Path to CSV")
    p_rec.add_argument("--object-idx", type=int, default=0, help="Index of reference object")
    p_rec.add_argument("--features", nargs=3, type=float,
                       metavar=("ORBITAL", "TILT", "MASS"), help="Custom query features")
    p_rec.add_argument("--top-k", type=int, default=3, help="Number of results")

    # train-regression
    p_tr = sub.add_parser("train-regression", help="Train regression models")
    p_tr.add_argument("--target", choices=["mass", "temperature"], help="Target (default: all)")

    # predict-mass
    p_pm = sub.add_parser("predict-mass", help="Predict mass from features")
    p_pm.add_argument("--features", nargs="+", type=float, metavar="VAL", required=True,
                      help="11 feature values")

    # predict-temperature
    p_pt = sub.add_parser("predict-temperature", help="Predict temperature from features")
    p_pt.add_argument("--features", nargs="+", type=float, metavar="VAL", required=True,
                      help="11 feature values")

    # serve
    p_serve = sub.add_parser("serve", help="Start FastAPI server")
    p_serve.add_argument("--port", type=int, default=8000)
    p_serve.add_argument("--reload", action="store_true", help="Auto-reload on changes")

    args = parser.parse_args()

    {
        "train": cmd_train,
        "cv": cmd_cv,
        "test": cmd_test,
        "classify": cmd_classify,
        "query": cmd_query,
        "recommend": cmd_recommend,
        "train-regression": cmd_train_regression,
        "predict-mass": cmd_predict_mass,
        "predict-temperature": cmd_predict_temperature,
        "serve": cmd_serve,
    }[args.command](args)


if __name__ == "__main__":
    main()
