"""
Train celestial classifier with configurable model type, hyperparameter tuning,
and cross-validation. Saves pipeline + metadata JSON.

Usage:
    python src/train_model.py                                    # RandomForest (default)
    python src/train_model.py --model-type svc                   # SVC
    python src/train_model.py --model-type logreg --tune          # LogisticRegression + GridSearch
    python src/train_model.py --cv                                # CV report on saved model
"""
import json
import sys
import warnings
from datetime import datetime
from pathlib import Path

warnings.filterwarnings("ignore", message="The `probability` parameter was deprecated")
warnings.filterwarnings("ignore", message="Precision is ill-defined")

import joblib
import numpy as np
import pandas as pd
from sklearn.base import is_classifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import KFold, StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from predict import DATA_PATH, FEATURES

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = PROJECT_ROOT / "models" / "celestial_classifier.pkl"
META_PATH = MODEL_PATH.with_suffix(".meta.json")
TARGET = "body_type"

CLASSIFIERS = {
    "rf": RandomForestClassifier(
        n_estimators=100, random_state=42, class_weight="balanced", min_samples_leaf=2,
    ),
    "svc": SVC(random_state=42, class_weight="balanced", probability=True),
    "logreg": LogisticRegression(random_state=42, class_weight="balanced", max_iter=1000),
    "ensemble": VotingClassifier(
        estimators=[
            ("rf", RandomForestClassifier(n_estimators=100, random_state=42, class_weight="balanced", min_samples_leaf=2)),
            ("gb", GradientBoostingClassifier(n_estimators=100, random_state=42)),
            ("svc", SVC(random_state=42, class_weight="balanced", probability=True)),
        ],
        voting="soft",
        weights=[0.4, 0.4, 0.2],
    ),
}

PARAM_GRIDS = {
    "rf": {
        "clf__n_estimators": [50, 100],
        "clf__max_depth": [3, 5, 10],
        "clf__min_samples_leaf": [1, 2],
    },
    "svc": {
        "clf__C": [0.1, 1, 10],
        "clf__gamma": ["scale", "auto"],
    },
    "logreg": {
        "clf__C": [0.01, 0.1, 1, 10],
    },
    "ensemble": {
        "clf__rf__n_estimators": [50, 100],
        "clf__gb__n_estimators": [50, 100],
        "clf__svc__C": [0.1, 1, 10],
    },
}


def _get_classifier(model_type):
    clf = CLASSIFIERS.get(model_type)
    if clf is None:
        print(f"Unknown model type: {model_type}. Choose from: {list(CLASSIFIERS.keys())}", file=sys.stderr)
        sys.exit(1)
    return clf


def _get_feature_importances(pipeline):
    from sklearn.model_selection import GridSearchCV
    if isinstance(pipeline, GridSearchCV):
        pipeline = pipeline.best_estimator_
    clf = pipeline.named_steps.get("clf")
    if hasattr(clf, "feature_importances_"):
        return clf.feature_importances_.tolist()
    if hasattr(clf, "coef_"):
        return clf.coef_.tolist()
    return None


def train(model_type="rf", tune=False, verbose=True):
    df = pd.read_csv(DATA_PATH)
    X = df[FEATURES].fillna(0)
    y = df[TARGET]

    classes = sorted(y.unique().tolist())
    class_dist = y.value_counts().to_dict()
    if verbose:
        print(f"Loaded {len(df)} rows, classes: {classes}")
        print(f"Distribution: {class_dist}")

    clf = _get_classifier(model_type)
    pipe = Pipeline([("scaler", StandardScaler()), ("clf", clf)])

    min_class_size = y.value_counts().min()
    use_stratified = min_class_size >= 3
    cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42) if use_stratified else KFold(n_splits=3, shuffle=True, random_state=42)
    if not use_stratified and verbose:
        print(f"Note: class '{y.value_counts().idxmin()}' has {min_class_size} sample(s). Using KFold instead of StratifiedKFold.")

    if tune:
        from sklearn.model_selection import GridSearchCV
        grid = PARAM_GRIDS.get(model_type, {})
        pipe = GridSearchCV(pipe, grid, cv=cv, scoring="accuracy")
        if verbose:
            print(f"Tuning with grid: {grid}")

    stratify_y = y if min_class_size >= 2 else None
    if stratify_y is None and verbose:
        print(f"Note: class '{y.value_counts().idxmin()}' has {min_class_size} sample(s). Using non-stratified train/test split.")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=stratify_y, random_state=42
    )
    pipe.fit(X_train, y_train)

    y_pred = pipe.predict(X_test)
    test_acc = accuracy_score(y_test, y_pred)

    if verbose:
        print(f"\nTest accuracy: {test_acc:.4f}")
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred))
        if tune and hasattr(pipe, "best_params_"):
            print(f"Best params: {pipe.best_params_}")

    cv_scores = cross_val_score(pipe, X, y, cv=cv)
    meta = {
        "model_type": model_type,
        "tuned": tune,
        "test_accuracy": round(test_acc, 4),
        "cv_accuracy_mean": round(float(cv_scores.mean()), 4),
        "cv_accuracy_std": round(float(cv_scores.std()), 4),
        "cv_scores": [round(s, 4) for s in cv_scores.tolist()],
        "best_params": pipe.best_params_ if tune and hasattr(pipe, "best_params_") else None,
        "classes": classes,
        "n_samples": len(y),
        "class_distribution": {str(k): v for k, v in class_dist.items()},
        "feature_importances": _get_feature_importances(pipe),
        "training_date": datetime.now().isoformat(),
    }

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    if tune and hasattr(pipe, "best_estimator_"):
        joblib.dump(pipe.best_estimator_, MODEL_PATH)
    else:
        joblib.dump(pipe, MODEL_PATH)

    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=2)

    if verbose:
        print(f"\nModel saved to {MODEL_PATH}")
        print(f"Metadata saved to {META_PATH}")

    return pipe


def cross_validate(verbose=True):
    if not MODEL_PATH.exists():
        print(f"No model found at {MODEL_PATH}. Train first.", file=sys.stderr)
        sys.exit(1)

    pipeline = joblib.load(str(MODEL_PATH))
    if not is_classifier(pipeline):
        print("Loaded object is not a classifier pipeline.", file=sys.stderr)
        sys.exit(1)

    df = pd.read_csv(DATA_PATH)
    X = df[FEATURES].fillna(0)
    y = df[TARGET]

    min_class_size = y.value_counts().min()
    use_stratified = min_class_size >= 3
    cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42) if use_stratified else KFold(n_splits=3, shuffle=True, random_state=42)
    if not use_stratified and verbose:
        print(f"Note: class '{y.value_counts().idxmin()}' has {min_class_size} sample(s). Using KFold.")
    scores = cross_val_score(pipeline, X, y, cv=cv, scoring="accuracy")

    if verbose:
        print(f"Stratified 3-fold CV accuracy:")
        for i, s in enumerate(scores, 1):
            print(f"  Fold {i}: {s:.4f}")
        print(f"  Mean:   {scores.mean():.4f}")
        print(f"  Std:    {scores.std():.4f}")

    return scores


def train_with_corrections(model_type="rf", tune=False, verbose=True):
    import pandas as pd
    from database import Correction as CorrectionModel, get_session, init_db
    from predict import FEATURES

    df = pd.read_csv(DATA_PATH).fillna(0)

    init_db()
    with get_session() as session:
        corrections = session.query(CorrectionModel).all()

    if corrections and verbose:
        print(f"Incorporating {len(corrections)} user corrections")

    for c in corrections:
        feat_dict = dict(zip(FEATURES, c.features[:11]))
        feat_dict["name"] = f"{c.body_id}_corrected"
        feat_dict["body_type"] = c.corrected_type
        df = pd.concat([df, pd.DataFrame([feat_dict])], ignore_index=True)

    return _train_from_df(df, model_type=model_type, tune=tune, verbose=verbose)


def _train_from_df(df, model_type="rf", tune=False, verbose=True):
    X = df[FEATURES].fillna(0)
    y = df[TARGET]

    classes = sorted(y.unique().tolist())
    class_dist = y.value_counts().to_dict()
    if verbose:
        print(f"Loaded {len(df)} rows, classes: {classes}")
        print(f"Distribution: {class_dist}")

    clf = _get_classifier(model_type)
    pipe = Pipeline([("scaler", StandardScaler()), ("clf", clf)])

    min_class_size = y.value_counts().min()
    use_stratified = min_class_size >= 3
    cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42) if use_stratified else KFold(n_splits=3, shuffle=True, random_state=42)
    if not use_stratified and verbose:
        print(f"Note: class '{y.value_counts().idxmin()}' has {min_class_size} sample(s). Using KFold instead of StratifiedKFold.")

    if tune:
        from sklearn.model_selection import GridSearchCV
        grid = PARAM_GRIDS.get(model_type, {})
        pipe = GridSearchCV(pipe, grid, cv=cv, scoring="accuracy")
        if verbose:
            print(f"Tuning with grid: {grid}")

    stratify_y = y if min_class_size >= 2 else None
    if stratify_y is None and verbose:
        print(f"Note: class '{y.value_counts().idxmin()}' has {min_class_size} sample(s). Using non-stratified train/test split.")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=stratify_y, random_state=42
    )
    pipe.fit(X_train, y_train)

    y_pred = pipe.predict(X_test)
    test_acc = accuracy_score(y_test, y_pred)

    if verbose:
        print(f"\nTest accuracy: {test_acc:.4f}")
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred))
        if tune and hasattr(pipe, "best_params_"):
            print(f"Best params: {pipe.best_params_}")

    cv_scores = cross_val_score(pipe, X, y, cv=cv)
    meta = {
        "model_type": model_type,
        "tuned": tune,
        "test_accuracy": round(test_acc, 4),
        "cv_accuracy_mean": round(float(cv_scores.mean()), 4),
        "cv_accuracy_std": round(float(cv_scores.std()), 4),
        "cv_scores": [round(s, 4) for s in cv_scores.tolist()],
        "best_params": pipe.best_params_ if tune and hasattr(pipe, "best_params_") else None,
        "classes": classes,
        "n_samples": len(y),
        "n_corrections": len([c for c in y.index if "_corrected" in str(c)]),
        "class_distribution": {str(k): v for k, v in class_dist.items()},
        "feature_importances": _get_feature_importances(pipe),
        "training_date": datetime.now().isoformat(),
    }

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    if tune and hasattr(pipe, "best_estimator_"):
        joblib.dump(pipe.best_estimator_, MODEL_PATH)
    else:
        joblib.dump(pipe, MODEL_PATH)

    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=2)

    if verbose:
        print(f"\nModel saved to {MODEL_PATH}")
        print(f"Metadata saved to {META_PATH}")

    return pipe


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Train or cross-validate celestial classifier")
    parser.add_argument("--model-type", choices=list(CLASSIFIERS.keys()), default="rf")
    parser.add_argument("--tune", action="store_true", help="Run GridSearchCV")
    parser.add_argument("--cv", action="store_true", help="Run cross-validation on saved model")
    args = parser.parse_args()

    if args.cv:
        cross_validate()
    else:
        train(model_type=args.model_type, tune=args.tune)
