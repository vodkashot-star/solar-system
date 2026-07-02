# Architecture

System overview and component relationships.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Cosmic Voyage Game                       │
│                    (Integration Layer)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  FastAPI Server (api.py)                      │
│  GET /health                                                 │
│  GET /precomputed              ← cached classifications     │
│  GET /classify/{body_id}?orbital_period=&axial_tilt=&...    │
│  POST /predict/mass            ← regression (mass)          │
│  POST /predict/temperature     ← regression (temperature)   │
│  Returns: AIAnalysis { classification, confidence,          │
│            alternatives, features, similarObjects }          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              CelestialPredictor (src/predict.py)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   predict    │  │ predict_proba│  │predict_batch │      │
│  │  (1 object)  │  │  (probs)     │  │  (CSV bulk)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  + load_meta(), model_metadata, feature_importances()       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│           Cache Layer (src/cache.py + precompute.py)         │
│  data/ai_cache.json — persistent; precompute_all() runs     │
│  at startup via FastAPI lifespan, classifies all 29 bodies  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Trained Models (.pkl)                            │
│  │ classifier: StandardScaler → RF/SVC/LogisticRegression   │
│  │ regressor:  StandardScaler → RandomForestRegressor        │
│  │ metadata:   celestial_classifier.meta.json (acc, CV, …)  │
│  11 features (orbital_period, axial_tilt, mass, radius, …)   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                               │
│  data/celestial_objects.csv  (46 objects, 7 body types)      │
│  data/stars.csv / planets.csv / galaxies.csv (reference)     │
└─────────────────────────────────────────────────────────────┘
```

## Components

### Unified CLI (`run.py`)

Single entry point for all ML operations:

```bash
python run.py train [--model-type rf|svc|logreg] [--tune]
python run.py cv                     # cross-validation on saved model
python run.py test                   # evaluate on test split
python run.py classify               # batch classify CSV dataset
python run.py query                  # single object prediction
python run.py recommend              # cosine-similarity search
python run.py train-regression       # train mass + temperature regressors
python run.py predict-mass           # predict mass with confidence interval
python run.py predict-temperature    # predict temperature with confidence interval
python run.py serve                  # start FastAPI server
```

### Prediction Module (`src/predict.py`)

`CelestialPredictor` class provides:

- `predict()` — single classification
- `predict_proba()` — class probabilities
- `predict_batch()` — bulk CSV prediction
- `classes_()` — class labels
- `feature_importances()` — per-feature importance scores
- `load_meta()` / `model_metadata` — accuracy, CV scores, training date

### Cache Module (`src/cache.py`)

- `read_cache()` / `write_cache()` — persist `data/ai_cache.json`
- `PrecomputedBody` dataclass for typed entries

### Precompute Module (`src/precompute.py`)

- Parses `bodies.ts:ASTRONOMICAL_DATA` via regex
- Calls `CelestialPredictor` for all 29 bodies at startup
- Returns dict keyed by bodyId

### Regression Module (`src/train_regression.py`)

- Trains `RandomForestRegressor` (StandardScaler pipeline) for mass and temperature
- Per-tree variance used for confidence intervals
- Models saved to `models/mass_regressor.pkl`, `models/temperature_regressor.pkl`

### FastAPI Server (`api.py`)

REST endpoints:

- `GET /health` — health check
- `GET /precomputed` — all cached classifications (dict of bodyId → AIAnalysis)
- `GET /classify/{body_id}` — classify one object, returns `AIAnalysis` JSON
- `POST /predict/mass` — mass regression with confidence interval
- `POST /predict/temperature` — temperature regression with confidence interval

## Data Flow

1. **Startup**: FastAPI lifespan calls `precompute_all()` → cache results to disk
2. **Precomputed**: Client fetches `GET /precomputed` once on mount
3. **Fallback classication**: Per-body `GET /classify/{body_id}` if not cached
4. **Regression**: Feature vector → scaled → RandomForestRegressor → prediction ± CI
5. **Similarity**: Cosine distance computed against all known objects

## Extensions

Add new model types by:

1. Adding data to `data/`
2. Training via `run.py train --model-type <type>` or `run.py train-regression`
3. Saving model to `models/`
4. Updating `CelestialPredictor` to load the new model
