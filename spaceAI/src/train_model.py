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
import shutil
import sys
import warnings
from datetime import datetime
from pathlib import Path

warnings.filterwarnings("ignore", message="The `probability` parameter was deprecated")
warnings.filterwarnings("ignore", message="Precision is ill-defined")

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone, is_classifier
from sklearn.calibration import CalibratedClassifierCV
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


def _get_classifier(model_type, calibrate=False):
    clf = CLASSIFIERS.get(model_type)
    if clf is None:
        print(f"Unknown model type: {model_type}. Choose from: {list(CLASSIFIERS.keys())}", file=sys.stderr)
        sys.exit(1)
    if not calibrate:
        return clf
    # Probability calibration (Platt/sigmoid) sharpens the soft RF vote
    # fractions into well-calibrated confidence scores. Rare classes must be
    # oversampled upstream (see _oversample_rare_classes) because
    # CalibratedClassifierCV demands >= cv folds worth of each class.
    return CalibratedClassifierCV(estimator=clone(clf), method="sigmoid", cv=3)


def _oversample_rare_classes(X, y, min_count=5):
    """Duplicate rows of classes with fewer than `min_count` samples so
    stratified calibration folds stay valid at every level (inner
    CalibratedClassifierCV cv=3, eval split 80/20, outer GridSearch/CV
    folds). Returns oversampled X, y."""
    counts = y.value_counts()
    rare = counts[counts < min_count]
    if rare.empty:
        return X, y
    y_np = y.to_numpy()
    rng = np.random.default_rng(42)
    add_idx: list[int] = []
    for cls in rare.index:
        cls_pos = np.where(y_np == cls)[0]
        reps = min_count - len(cls_pos)
        add_idx.extend(rng.choice(cls_pos, reps, replace=True).tolist())
    X = pd.concat([X, X.iloc[add_idx]], ignore_index=True)
    y = pd.concat([y, y.iloc[add_idx]], ignore_index=True)
    return X, y


def _unwrap_estimator(clf):
    """CalibratedClassifierCV keeps fitted fold models in
    `calibrated_classifiers_` (`.estimator` stays an unfitted template)."""
    if hasattr(clf, "calibrated_classifiers_"):
        return clf.calibrated_classifiers_[0].estimator
    return getattr(clf, "estimator", clf)


def _get_feature_importances(pipeline):
    clf = pipeline.named_steps.get("clf")
    if clf is None:
        return None
    clf = _unwrap_estimator(clf)
    if hasattr(clf, "feature_importances_"):
        return clf.feature_importances_.tolist()
    if hasattr(clf, "coef_"):
        return clf.coef_.tolist()
    return None


ENGINEERED_FEATURES = [
    "log_mass", "log_radius", "log_semi_major_axis",
    "density_times_radius", "mass_over_radius3", "gravity_times_radius",
]


def _engineer_features(df):
    """Add engineered feature columns (log transforms, ratios) in place."""
    df["log_mass"] = np.log10(df["mass"].clip(lower=1e-15) + 1e-15)
    df["log_radius"] = np.log10(df["radius"].clip(lower=1e-15) + 1e-15)
    df["log_semi_major_axis"] = np.log10(df["semi_major_axis"].clip(lower=1e-10) + 1e-10)
    df["density_times_radius"] = df["density"] * df["radius"]
    denom = df["radius"].clip(lower=1e-15) ** 3
    df["mass_over_radius3"] = df["mass"] / (denom + 1e-30)
    df["gravity_times_radius"] = df["gravity"] * df["radius"]
    return df


def _build_cv(y):
    """Return appropriate cross-validator based on minimum class size."""
    min_class_size = y.value_counts().min()
    if min_class_size >= 3:
        return StratifiedKFold(n_splits=3, shuffle=True, random_state=42), True
    return KFold(n_splits=3, shuffle=True, random_state=42), False


def _archive_version(pipe, meta, n_corrections=0, verbose=True):
    """
    Create a ModelVersion DB record and archive the model files.
    Called after successful training.
    """
    from src.database import ModelVersion, init_db, get_session

    model_type = meta.get("model_type", "unknown")
    tune = meta.get("tuned", False)
    augment = meta.get("augmented", False)
    n_samples = meta.get("n_samples", 0)

    init_db()
    with get_session() as session:
        session.query(ModelVersion).update({"active": False})

        version = ModelVersion(
            model_type=model_type,
            accuracy=meta.get("test_accuracy"),
            cv_score=meta.get("cv_accuracy_mean"),
            n_corrections=n_corrections,
            tuned=tune,
            augmented=augment,
            n_samples=n_samples,
            active=True,
        )
        session.add(version)
        session.flush()

        archive_dir = MODEL_PATH.parent / "archives" / f"v{version.id}"
        archive_dir.mkdir(parents=True, exist_ok=True)

        shutil.copy2(MODEL_PATH, archive_dir / "celestial_classifier.pkl")
        shutil.copy2(META_PATH, archive_dir / "celestial_classifier.meta.json")

        version.model_path = str(archive_dir / "celestial_classifier.pkl")
        version.meta_path = str(archive_dir / "celestial_classifier.meta.json")

        session.commit()
        version_id = version.id

    if verbose:
        print(f"Archived version {version_id} to {archive_dir}")


def _train_from_df(df, model_type="rf", tune=False, augment=False, verbose=True, n_corrections=0, calibrate=False):
    """
    Core training routine.

    Evaluation steps (in order):
      1. Fit on train split  → honest held-out test accuracy
      2. CV on unfitted clone → uncontaminated generalisation estimate
      3. Fit fresh clone on full dataset → production model saved to disk
    """
    if augment:
        df = _engineer_features(df)

    feature_cols = FEATURES + (ENGINEERED_FEATURES if augment else [])
    X = df[feature_cols].fillna(0)
    y = df[TARGET]

    classes = sorted(y.unique().tolist())
    class_dist = y.value_counts().to_dict()
    if verbose:
        print(f"Loaded {len(df)} rows, classes: {classes}")
        print(f"Distribution: {class_dist}")
        if augment:
            print(f"Features: {len(FEATURES)} base + {len(ENGINEERED_FEATURES)} engineered = {len(feature_cols)} total")

    if calibrate:
        before = len(y)
        X, y = _oversample_rare_classes(X, y)
        if len(y) != before and verbose:
            print(f"[calibrate] Oversampled rare classes: {before} → {len(y)} rows (stratified folds stay valid)")

    base_pipe = Pipeline([("scaler", StandardScaler()), ("clf", _get_classifier(model_type, calibrate=calibrate))])
    cv, use_stratified = _build_cv(y)

    if not use_stratified and verbose:
        print(f"Note: class '{y.value_counts().idxmin()}' has {y.value_counts().min()} sample(s). Using KFold.")

    # Optionally wrap in GridSearchCV for hyperparameter tuning
    if tune:
        from sklearn.model_selection import GridSearchCV
        grid = PARAM_GRIDS.get(model_type, {})
        if calibrate:
            # CalibratedClassifierCV nests the base estimator under `estimator__`
            grid = {k.replace("clf__", "clf__estimator__", 1): v for k, v in grid.items()}
        tuned_pipe = GridSearchCV(base_pipe, grid, cv=cv, scoring="accuracy")
        if verbose:
            print(f"Tuning with grid: {grid}")
    else:
        tuned_pipe = base_pipe

    # ── Step 1: eval on held-out test split ────────────────────────────────
    stratify_y = y if y.value_counts().min() >= 2 else None
    if stratify_y is None and verbose:
        print(f"Note: class '{y.value_counts().idxmin()}' has {y.value_counts().min()} sample(s). Using non-stratified split.")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=stratify_y, random_state=42
    )

    eval_pipe = clone(tuned_pipe)
    eval_pipe.fit(X_train, y_train)
    y_pred = eval_pipe.predict(X_test)
    test_acc = accuracy_score(y_test, y_pred)

    best_params = eval_pipe.best_params_ if tune and hasattr(eval_pipe, "best_params_") else None

    if verbose:
        print(f"\nTest accuracy (held-out): {test_acc:.4f}")
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred))
        if best_params:
            print(f"Best params: {best_params}")

    # ── Step 2: CV on a fresh unfitted clone ───────────────────────────────
    cv_pipe = clone(eval_pipe.best_estimator_ if tune and hasattr(eval_pipe, "best_estimator_") else eval_pipe)
    cv_scores = cross_val_score(cv_pipe, X, y, cv=cv, scoring="accuracy")

    if verbose:
        print(f"\nCV accuracy: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    # ── Step 3: production model — fit on full dataset ─────────────────────
    prod_pipe = clone(eval_pipe.best_estimator_ if tune and hasattr(eval_pipe, "best_estimator_") else eval_pipe)
    prod_pipe.fit(X, y)

    meta = {
        "model_type": model_type,
        "tuned": tune,
        "augmented": augment,
        "calibrated": calibrate,
        "n_features": len(feature_cols),
        "test_accuracy": round(test_acc, 4),
        "cv_accuracy_mean": round(float(cv_scores.mean()), 4),
        "cv_accuracy_std": round(float(cv_scores.std()), 4),
        "cv_scores": [round(s, 4) for s in cv_scores.tolist()],
        "best_params": best_params,
        "classes": classes,
        "n_samples": len(y),
        "n_train_samples": len(y_train),
        "class_distribution": {str(k): v for k, v in class_dist.items()},
        "feature_importances": _get_feature_importances(prod_pipe),
        "training_date": datetime.now().isoformat(),
    }

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(prod_pipe, MODEL_PATH)

    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=2)

    if verbose:
        print(f"\nProduction model saved to {MODEL_PATH}")
        print(f"Metadata saved to {META_PATH}")

    try:
        _archive_version(prod_pipe, meta, n_corrections=n_corrections, verbose=verbose)
    except Exception as e:
        if verbose:
            print(f"Note: model archiving skipped ({e})")

    return prod_pipe


def train(model_type="rf", tune=False, augment=False, verbose=True, calibrate=False):
    df = pd.read_csv(DATA_PATH).fillna(0)
    return _train_from_df(df, model_type=model_type, tune=tune, augment=augment, verbose=verbose, n_corrections=0, calibrate=calibrate)


def cross_validate(verbose=True):
    if not MODEL_PATH.exists():
        print(f"No model found at {MODEL_PATH}. Train first.", file=sys.stderr)
        sys.exit(1)

    pipeline = joblib.load(str(MODEL_PATH))
    if not is_classifier(pipeline):
        print("Loaded object is not a classifier pipeline.", file=sys.stderr)
        sys.exit(1)

    meta = {}
    if META_PATH.exists():
        with open(META_PATH) as f:
            meta = json.load(f)

    df = pd.read_csv(DATA_PATH)
    if meta.get("augmented"):
        df = _engineer_features(df)

    feature_cols = FEATURES + (ENGINEERED_FEATURES if meta.get("augmented") else [])
    X = df[feature_cols].fillna(0)
    y = df[TARGET]

    # Calibrated models were trained on oversampled data (see
    # _oversample_rare_classes) — CV must use the same distribution or the
    # inner CalibratedClassifierCV(cv=3) folds crash on rare classes.
    clf = pipeline.named_steps.get("clf")
    calibrated = isinstance(clf, CalibratedClassifierCV) or bool(meta.get("calibrated"))
    if calibrated:
        before = len(y)
        X, y = _oversample_rare_classes(X, y)
        if verbose and len(y) != before:
            print(f"Note: model is calibrated — oversampling rare classes for CV: {before} → {len(y)} rows (matches training)")

    cv, use_stratified = _build_cv(y)
    if not use_stratified and verbose:
        print(f"Note: class '{y.value_counts().idxmin()}' has {y.value_counts().min()} sample(s). Using KFold.")

    # Clone before CV so the saved model's internal state is not mutated
    scores = cross_val_score(clone(pipeline), X, y, cv=cv, scoring="accuracy")

    if verbose:
        print("Stratified 3-fold CV accuracy:")
        for i, s in enumerate(scores, 1):
            print(f"  Fold {i}: {s:.4f}")
        print(f"  Mean:   {scores.mean():.4f}")
        print(f"  Std:    {scores.std():.4f}")

    return scores


def train_with_corrections(model_type="rf", tune=False, augment=False, verbose=True, calibrate=False):
    # Use src.database to be consistent with the rest of the codebase
    from src.database import Correction as CorrectionModel, get_session, init_db
    from predict import FEATURES as _FEATURES

    df = pd.read_csv(DATA_PATH).fillna(0)

    init_db()
    with get_session() as session:
        corrections = session.query(CorrectionModel).all()

    n_corrections = len(corrections)
    if corrections and verbose:
        print(f"Incorporating {n_corrections} user corrections")

    for c in corrections:
        feat_dict = dict(zip(_FEATURES, c.features[:11]))
        feat_dict["name"] = f"{c.body_id}_corrected"
        feat_dict[TARGET] = c.corrected_type
        df = pd.concat([df, pd.DataFrame([feat_dict])], ignore_index=True)

    return _train_from_df(df, model_type=model_type, tune=tune, augment=augment, verbose=verbose, n_corrections=n_corrections, calibrate=calibrate)


def rollback(version_id, verbose=True):
    """
    Restore an archived model version to the active production path.
    """
    from src.database import ModelVersion, get_session, init_db

    init_db()
    with get_session() as session:
        version = session.query(ModelVersion).filter_by(id=version_id).first()
        if version is None:
            print(f"Version {version_id} not found", file=sys.stderr)
            sys.exit(1)

        archive_pkl = Path(version.model_path) if version.model_path else None
        archive_meta = Path(version.meta_path) if version.meta_path else None

        if not archive_pkl or not archive_pkl.exists():
            print(f"Archived model for version {version_id} not found at {archive_pkl}", file=sys.stderr)
            sys.exit(1)

        shutil.copy2(archive_pkl, MODEL_PATH)
        if archive_meta and archive_meta.exists():
            shutil.copy2(archive_meta, META_PATH)

        session.query(ModelVersion).update({"active": False})
        version.active = True
        session.commit()
        model_type = version.model_type
        accuracy = version.accuracy

    if verbose:
        print(f"Restored version {version_id} ({model_type}, accuracy={accuracy})")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Train or cross-validate celestial classifier")
    parser.add_argument("--model-type", choices=list(CLASSIFIERS.keys()), default="rf")
    parser.add_argument("--tune", action="store_true", help="Run GridSearchCV")
    parser.add_argument("--augment", action="store_true", help="Enable feature engineering")
    parser.add_argument("--calibrate", action="store_true", help="Wrap classifier in CalibratedClassifierCV (sigmoid)")
    parser.add_argument("--cv", action="store_true", help="Run cross-validation on saved model")
    args = parser.parse_args()

    if args.cv:
        cross_validate()
    else:
        train(model_type=args.model_type, tune=args.tune, augment=args.augment, calibrate=args.calibrate)
