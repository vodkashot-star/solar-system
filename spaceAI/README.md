# SpaceAI

**Educational ML system for celestial classification.** Predicts body type (Planet, Moon, Star, DwarfPlanet, Asteroid, Comet, Interstellar, Spacecraft) from 11 physical/orbital features. Ships as a training-only Python microservice; production inference runs from a precomputed JSON cache served by Express.

## Quick Start

```bash
# From repo root (all ai:* scripts use spaceAI/venv — plain python has no deps)
npm run ai:train       # train RandomForest classifier
npm run ai:serve       # FastAPI dev server on :8000
npm run ai:bot         # Telegram station-AI bot

# Or from spaceAI/
cd spaceAI
./venv/bin/pip install -r requirements.txt
./venv/bin/python run.py train
./venv/bin/python run.py serve
```

## CLI Reference

| Command | Action |
|---------|--------|
| `python run.py train [--model-type rf\|svc\|logreg] [--tune]` | Train classifier |
| `python run.py cv` | 3-fold cross-validation on saved model |
| `python run.py test` | Evaluate on held-out 20% split |
| `python run.py query --features <11 floats> [--proba]` | Classify one object |
| `python run.py classify [--dataset <csv>] [--output <csv>]` | Batch classify dataset |
| `python run.py recommend --object-idx <n> [--top-k <n>]` | Find similar objects |
| `python run.py train-regression [--target mass\|temp]` | Train regressors |
| `python run.py predict-mass --features <11 floats>` | Predict mass ± CI |
| `python run.py predict-temperature --features <11 floats>` | Predict temperature ± CI |
| `python run.py serve [--port <n>] [--reload]` | Start FastAPI on :8000 (default port ← `SPACEAI_PORT` env, default 8000) |

### npm Wrappers

All wrappers run via `spaceAI/venv` (`./venv/bin/python`) — the system python has no numpy/sklearn.

| npm script | Maps to |
|------------|---------|
| `npm run ai:train` | `cd spaceAI && ./venv/bin/python run.py train` |
| `npm run ai:train-regression` | Train mass + temperature regressors |
| `npm run ai:retrain` | Retrain with user corrections from DB |
| `npm run ai:cv` | Cross-validate the saved model |
| `npm run ai:test` | `./venv/bin/python -m pytest tests/` (50 tests) |
| `npm run ai:serve` | `./venv/bin/python run.py serve` (add `-- --reload` for hot reload) |
| `npm run ai:bot` | `./venv/bin/python telegram_bot.py` (Telegram bot, needs `.env` tokens) |
| `npm run ai:check` | Validate GLBs against the trained classifier |

## 11 Features

| Feature | Unit | Description |
|---------|------|-------------|
| `orbital_period` | days | Time for one full orbit |
| `axial_tilt` | degrees | Tilt of rotation axis |
| `mass` | Earth masses | Mass relative to Earth |
| `radius` | Earth radii | Radius relative to Earth |
| `eccentricity` | 0–1+ | Orbit shape (0 = circle, >1 = hyperbolic) |
| `density` | g/cm³ | Mean density |
| `gravity` | m/s² | Surface gravity |
| `temperature` | K | Surface/effective temperature |
| `semi_major_axis` | AU | Average distance from Sun |
| `inclination` | degrees | Orbital inclination |
| `rotation_period` | hours | Length of day (negative = retrograde) |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│              Express Server (server/routes.ts)             │
│  GET /api/ai/precomputed      ← reads ai_cache.json       │
│  GET /api/ai/classify/:bodyId ← lookup in cache           │
│  POST /api/classify/:bodyId/correct ← in-memory store     │
│  Loads cache at startup from spaceAI/data/ai_cache.json   │
└──────────────────────┬────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│              spaceAI/ (Python — training only)              │
│  run.py train  →  trains model → saves .pkl + ai_cache    │
│  run.py serve  →  FastAPI :8000 (dev only)                │
└──────────────────────┬────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│           CelestialPredictor (src/predict.py)              │
│  predict(), predict_proba(), predict_batch(), classes_()   │
│  feature_importances(), load_meta(), model_metadata        │
└──────────────────────┬────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│        Cache Layer (src/cache.py + precompute.py)          │
│  data/ai_cache.json — persistent precomputed cache         │
│  precompute_all() classifies all bodies during training    │
└──────────────────────┬────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│         Trained Models (.pkl)                              │
│  classifier: StandardScaler → RF/SVC/LogisticRegression   │
│  regressor:  StandardScaler → RandomForestRegressor        │
│  metadata:   celestial_classifier.meta.json                │
└──────────────────────┬────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                  Data Layer                                │
│  data/celestial_objects.csv (47 objects, 8 body types)     │
└──────────────────────────────────────────────────────────┘
```

### Components

- **`run.py`** — Unified CLI for all ML operations (training, CV, test, query, serve)
- **`src/predict.py`** — `CelestialPredictor` class: single/batch prediction, probabilities, feature importances, metadata
- **`src/cache.py`** — Read/write `data/ai_cache.json`
- **`src/precompute.py`** — Parses `bodies.ts` `ASTRONOMICAL_DATA`, classifies all bodies during training
- **`src/train_model.py`** — Pipeline(StandardScaler, classifier) with `class_weight="balanced"`, GridSearchCV, cross-validation
- **`src/train_regression.py`** — RandomForestRegressor for mass + temperature with per-tree variance confidence intervals
- **`api.py`** — FastAPI dev server (training-only, not for production)
- **`telegram_bot.py`** — SOLARIS Network Telegram station-AI bot (see below)

### Data Flow

1. **Training**: `python run.py train` → trains model → writes `data/ai_cache.json`
2. **Deployment**: Express reads `ai_cache.json` at startup, serves from memory
3. **Frontend**: Fetches `GET /api/ai/precomputed` once on mount; falls back to per-body `GET /api/ai/classify/{body_id}`
4. **Corrections**: Express writes Postgres (`corrections` table) + forwards to FastAPI; if :8000 is offline, corrections queue to `spaceAI/data/pending_corrections.json` and FastAPI drains it on startup; `npm run ai:retrain` incorporates them
5. **Regression**: Feature vector → scaled → RandomForestRegressor → prediction ± CI
6. **Similarity**: Cosine distance against all known objects

## Model Training

### Training

```bash
python run.py train                          # Default RandomForest
python run.py train --model-type svc         # SVC
python run.py train --model-type logreg --tune  # Tuned LogisticRegression
```

Reads `data/celestial_objects.csv`, trains `Pipeline(StandardScaler, classifier)` with `class_weight="balanced"`, saves to `models/celestial_classifier.pkl` + `celestial_classifier.meta.json`.

**Model types:**
| Type | Algorithm | Tuning params |
|------|-----------|---------------|
| `rf` (default) | RandomForestClassifier | n_estimators [50,100], max_depth [3,5,10], min_samples_leaf [2,5] |
| `svc` | SVC (probability=True) | C [0.1,1,10], gamma ['scale','auto'], kernel ['rbf','linear'] |
| `logreg` | LogisticRegression | C [0.1,1,10], solver ['lbfgs','liblinear'], max_iter [200,500] |

### Hyperparameter Tuning

```bash
python run.py train --tune
```

Runs GridSearchCV with StratifiedKFold(3). Falls back to KFold(3) when a class has fewer samples than `n_splits`. Prints best params and best CV score.

### Cross-Validation

```bash
python run.py cv
```

Loads saved model, runs StratifiedKFold(3) on full dataset. Per-fold accuracy + mean ± std.

### Evaluation

```bash
python run.py test
```

Accuracy + precision/recall/F1 on held-out 20% test split.

### Model Details

- **Algorithm**: RandomForestClassifier (default, 50–100 estimators, depth 3–10) — alternatives: SVC, LogisticRegression, Ensemble (RF + GB + SVC soft voting)
- **Preprocessing**: StandardScaler (zero mean, unit variance)
- **Class balancing**: `class_weight="balanced"`
- **Cross-validation**: StratifiedKFold(3) (fallback to KFold(3) for small classes)
- **Train/test split**: 80/20, `random_state=42`, stratified sampling
- **Serialization**: joblib `.pkl` + JSON metadata (accuracy, CV scores, training date, feature importances)
- **Training quirk**: `train_model.py` calls `pipe.fit(X, y)` on full dataset _after_ evaluation split so rare classes appear in `pipeline.classes_`. Never remove this final fit.

## Dataset

### `celestial_objects.csv`

Primary training dataset — 47 rows, 12 columns:

| Column | Type | Description |
|--------|------|-------------|
| `name` | string | Object name |
| `orbital_period` | float | Days to complete one orbit |
| `axial_tilt` | float | Tilt angle in degrees |
| `mass` | float | Mass relative to Earth |
| `radius` | float | Radius relative to Earth |
| `eccentricity` | float | Orbit shape (0=circle, <1=ellipse) |
| `density` | float | Mean density in g/cm³ |
| `gravity` | float | Surface gravity in m/s² |
| `temperature` | float | Surface/effective temperature (K) |
| `semi_major_axis` | float | Average distance from Sun in AU |
| `inclination` | float | Orbital inclination in degrees |
| `rotation_period` | float | Length of day in hours (negative = retrograde) |
| `body_type` | string | Classification label |

All 11 feature columns used by model. Target column: `body_type`.

### Data Cleaning

- Missing values filled with 0 during training
- All masses use Earth mass ratios, distances in AU

## Uncertainty & Corrections

- **Uncertainty**: Normalized entropy per prediction (0 = certain, 1 = uniform); threshold at 0.4 triggers "Uncertain" badge in the UI
- **Corrections**: `POST /api/classify/{body_id}/correct` — Express persists to Postgres and mirrors to FastAPI's SQLite store (`spaceai.db`); offline FastAPI → queued to `data/pending_corrections.json` and drained on startup. `npm run ai:retrain` incorporates everything into the next model

## Telegram Bot

`telegram_bot.py` serves the **SOLARIS Network** — a python-telegram-bot
polling app (@SolarisCommandBot) that routes chats to station AIs:

| Station | Body | Persona |
|---------|------|---------|
| A.R.E.S. Flight Command | earth | Mission control |
| Dr. Vance | moon | Lunar Gateway scientist |
| Deep-Space Drone 09 | makemake | Kuiper Belt probe |

- Brain: OpenCode Zen `deepseek-v4-flash-free` via `AsyncOpenAI` (`base_url https://opencode.ai/zen/v1`, `max_tokens=150`); replies limited to 3 sentences. Rate-limit (429) failover to `nemotron-3-ultra-free` (`OPENCODE_FALLBACK_MODEL` env) before "Relay Busy" flavor text
- Needs `TELEGRAM_BOT_TOKEN` + `OPENCODE_API_KEY` (+ `DATABASE_URL` for persistence) in root `.env` (template in `.env.example`); loads `../.env` itself via python-dotenv
- 429 / `FreeUsageLimitError` → "Relay Busy" flavor text; other model errors → "*Signal lost...*"; Markdown rejection → plain-text fallback
- **Persistence (psycopg2, fail-silent)**: `/start` registers the player in `player_characters` (stationed at Earth); station routing reads `current_body_id` → `celestial_bodies.name` (`STATION_AIS` keys); all messages persisted to `chat_logs` (`is_ai` flag, station body FK)
- IPv4-first `socket.getaddrinfo` patch for hosts with no IPv6 route (this box)
- Run: `npm run ai:bot`; daemon: `setsid nohup npm run ai:bot > /tmp/aibot.log 2>&1 &`
- Scope: chat memory summarization is upcoming (schema already supports it)
- **`/travel <body>`** (web↔Telegram sync): resolves the destination against `celestial_bodies` (exact name, else LIKE closest matches), then `PATCH /api/player/<id>/location` on Express (single source of truth — bot + web share the same Postgres) with a direct psycopg2 `current_body_id` upsert as the offline fallback; station arrivals announce the `STATION_AIS` character, otherwise "You have arrived at <name>."; DB/API down → "*Signal lost...*"

## Integration Notes

- Express loads `data/ai_cache.json` at startup — no FastAPI runtime needed in production
- Frontend fetches `/api/ai/precomputed` once on mount; falls back to per-body `GET /api/ai/classify/:bodyId`
- `shared/schema.ts` mirrors spaceAI's SQLAlchemy models as Drizzle `pgTable` (6 tables: bodies, ai_cache, prediction_logs, corrections, player_characters, chat_logs)
- `scripts/validate_models.py` checks generated GLBs against trained classifier
- `telegram_bot.py` talks to OpenCode Zen, not the ML service — AI classification and chat brains are separate systems

## Troubleshooting

See [docs/troubleshooting.md](docs/troubleshooting.md) for common issues.
