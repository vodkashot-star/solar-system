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
│  GET /classify/{body_id}?orbital_period=&axial_tilt=&...    │
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
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Trained Model (.pkl)                             │
│  StandardScaler → RandomForestClassifier (100 estimators)    │
│  Features: orbital_period, axial_tilt, mass, radius, ecc    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                               │
│  data/celestial_objects.csv  (47 objects, 7 body types)      │
│  data/stars.csv / planets.csv / galaxies.csv (reference)     │
└─────────────────────────────────────────────────────────────┘
```

## Components

### Unified CLI (`run.py`)

Single entry point for all ML operations:

```bash
python run.py train         # Train RandomForest classifier
python run.py test          # Evaluate on test split
python run.py classify      # Batch classify CSV dataset
python run.py query         # Single object prediction
python run.py recommend     # Cosine-similarity search
python run.py serve         # Start FastAPI server
```

### Prediction Module (`src/predict.py`)

`CelestialPredictor` class provides:
- `predict()` — single classification
- `predict_proba()` — class probabilities
- `predict_batch()` — bulk CSV prediction
- `classes_()` — class labels
- `feature_importances()` — per-feature importance scores

### FastAPI Server (`api.py`)

REST endpoint returning `AIAnalysis` JSON:
- `classification` — predicted body type
- `confidence` — probability of top class
- `alternatives` — top-3 runner-up classes
- `features` — input values with importance scores
- `similarObjects` — top-3 cosine-similar objects from dataset

## Data Flow

1. Client sends feature vector to `/classify/{body_id}`
2. API loads model from `models/celestial_classifier.pkl`
3. `CelestialPredictor` scales features and runs inference
4. Cosine similarity computed against all known objects
5. Results formatted as `AIAnalysis` JSON and returned

## Extensions

Add new model types by:
1. Adding data to `data/`
2. Training in `notebooks/` or via `run.py train`
3. Saving model to `models/`
4. Updating `CelestialPredictor` to load the new model
