# Architecture

System overview and component relationships.

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   Express Server (server/routes.ts)           │
│  GET /api/ai/precomputed         ← reads ai_cache.json       │
│  GET /api/ai/classify/:bodyId    ← lookup in cache           │
│  POST /api/ai/classify/:bodyId/correct  ← in-memory store     │
│  Loads cache at startup from spaceAI/data/ai_cache.json      │
│  Corrections stored in-memory (restart loses them)           │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│               spaceAI/ (Python — training only)               │
│                                                              │
│  run.py train  →  trains model → saves .pkl + ai_cache.json  │
│  run.py serve  →  FastAPI :8000 (dev only, not for runtime)  │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              CelestialPredictor (src/predict.py)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   predict    │  │ predict_proba│  │predict_batch │       │
│  │  (1 object)  │  │  (probs)     │  │  (CSV bulk)  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  + load_meta(), model_metadata, feature_importances()        │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│           Cache Layer (src/cache.py + precompute.py)          │
│  data/ai_cache.json — persistent; precompute_all() runs       │
│  during training, classifies all bodies, writes to file       │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              Trained Models (.pkl)                             │
│  │ classifier: StandardScaler → RF/SVC/LogisticRegression    │
│  │ regressor:  StandardScaler → RandomForestRegressor         │
│  │ metadata:   celestial_classifier.meta.json (acc, CV, …)   │
│  11 features (orbital_period, axial_tilt, mass, radius, …)    │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                     Data Layer                                │
│  data/celestial_objects.csv  (46 objects, 7 body types)       │
│  data/stars.csv / planets.csv / galaxies.csv (reference)      │
└──────────────────────────────────────────────────────────────┘
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
python run.py serve                  # start FastAPI server (dev only)
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

- Parses `client/src/components/solar-system/bodies.ts` for `ASTRONOMICAL_DATA`
- Calls `CelestialPredictor` for all bodies during training
- Returns dict keyed by bodyId

### Regression Module (`src/train_regression.py`)

- Trains `RandomForestRegressor` (StandardScaler pipeline) for mass and temperature
- Per-tree variance used for confidence intervals
- Models saved to `models/mass_regressor.pkl`, `models/temperature_regressor.pkl`

### FastAPI Server (`api.py`)

Development-only REST endpoints (started via `python run.py serve`):

- `GET /health` — health check
- `GET /precomputed` — all cached classifications
- `GET /classify/{body_id}` — classify one object
- `POST /predict/mass` — mass regression with confidence interval
- `POST /predict/temperature` — temperature regression with confidence interval

## Data Flow

1. **Training**: `python run.py train` → trains model → writes `ai_cache.json` to `data/`
2. **Deployment**: Express reads `ai_cache.json` at startup, serves from memory
3. **Precomputed**: Client fetches `GET /api/ai/precomputed` once on mount
4. **Fallback classification**: Per-body `GET /api/ai/classify/{body_id}` if not cached
5. **Corrections**: `POST /api/ai/classify/{body_id}/correct` stored in-memory
6. **Retraining**: `npm run ai:retrain` (or `python run.py retrain`) incorporates corrections
7. **Regression**: Feature vector → scaled → RandomForestRegressor → prediction ± CI
8. **Similarity**: Cosine distance computed against all known objects

## Extensions

Add new model types by:

1. Adding data to `data/`
2. Training via `run.py train --model-type <type>` or `run.py train-regression`
3. Saving model to `models/`
4. Updating `CelestialPredictor` to load the new model
5. Regenerating cache with `python run.py train` → commit updated `ai_cache.json`
