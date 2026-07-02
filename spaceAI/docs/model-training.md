# Model Training Guide

Building and evaluating machine learning models for celestial data.

## Quick Start

```bash
python run.py train                        # Train default RandomForest
python run.py train --model-type svc       # Train SVC instead
python run.py train --model-type logreg --tune  # Tune LogisticRegression
python run.py cv                           # Cross-validate saved model
python run.py test                         # Evaluate on test split
```

## Training Workflow

### 1. Train

```bash
python run.py train
python run.py train --model-type svc --tune
python run.py train --model-type logreg
```

Reads `data/celestial_objects.csv`, trains a Pipeline(StandardScaler, classifier)
with `class_weight="balanced"`, saves to `models/celestial_classifier.pkl` plus
metadata to `models/celestial_classifier.meta.json`.

**Model types:**
| Type | Algorithm | Tuning params |
|------|-----------|---------------|
| `rf` (default) | RandomForestClassifier | n_estimators [50,100], max_depth [3,5,10], min_samples_leaf [2,5] |
| `svc` | SVC (probability=True) | C [0.1,1,10], gamma ['scale','auto'], kernel ['rbf','linear'] |
| `logreg` | LogisticRegression | C [0.1,1,10], solver ['lbfgs','liblinear'], max_iter [200,500] |

### 2. Hyperparameter Tuning

```bash
python run.py train --tune
```

Runs GridSearchCV with StratifiedKFold(3). Falls back to KFold(3) when a class
has fewer samples than `n_splits` (e.g. Star class with 1 sample). Prints best
params and best CV score after tuning.

### 3. Cross-Validation

```bash
python run.py cv
```

Loads the saved model and runs StratifiedKFold(3) on the full dataset, printing
per-fold accuracy and mean ± std. Useful for verifying model stability.

### 4. Evaluate

```bash
python run.py test
```

Accuracy + precision/recall/F1 on the held-out 20% test split.

### 5. Test Predictions

```bash
python run.py query --features 365.25 23.44 1.0 1.0 0.017 5.51 9.81 288 1 0 24 --proba
python run.py classify --output predictions.csv
```

### 6. Regression

```bash
# Train regressors (mass + temperature)
python run.py train-regression

# Predict with confidence intervals
python run.py predict-mass --features 365.25 23.44 1.0 1.0 0.017 5.51 9.81 288 1 0 24
python run.py predict-temperature --features 365.25 23.44 1.0 1.0 0.017 5.51 9.81 288 1 0 24
```

Uses RandomForestRegressor (100 estimators, StandardScaler pipeline).
Confidence interval derived from per-tree prediction variance.
Quality is limited by small dataset (44 mass samples, 27 temperature samples)
with extreme outliers (Sun at 333,000 Earth masses).

### 7. Discover Similar Objects

```bash
python run.py recommend --object-idx 2 --top-k 3
```

## Feature Columns

| Feature | Unit | Description |
|---------|------|-------------|
| `orbital_period` | days | Time for one full orbit |
| `axial_tilt` | degrees | Tilt of rotation axis |
| `mass` | Earth masses | Body mass relative to Earth |
| `radius` | Earth radii | Body radius relative to Earth |
| `eccentricity` | 0–1+ | Orbit shape (0 = circle, >1 = hyperbolic) |
| `density` | g/cm³ | Mean density |
| `gravity` | m/s² | Surface gravity |
| `temperature` | K | Surface/effective temperature |
| `semi_major_axis` | AU | Average distance from Sun |
| `inclination` | degrees | Orbital inclination |
| `rotation_period` | hours | Length of day (negative = retrograde) |

## Model Details

- **Algorithm**: RandomForestClassifier (default, 50–100 estimators, depth 3–10)
  — alternatives: SVC, LogisticRegression
- **Preprocessing**: StandardScaler (zero mean, unit variance)
- **Class balancing**: `class_weight="balanced"`
- **Cross-validation**: StratifiedKFold(3) (fallback to KFold(3) for small classes)
- **Train/test split**: 80/20, `random_state=42`, with class-stratified sampling
  (falls back to non-stratified when Star class has < 2 samples)
- **Serialization**: joblib `.pkl` + JSON metadata
- **Metadata**: model type, accuracy, CV scores, training date, feature importances
