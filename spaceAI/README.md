# SpaceAI

**Educational AI system for celestial classification**

SpaceAI is a machine learning bridge between astronomy education and interactive
game integration. It classifies celestial objects from 11 physical/orbital features.

## Quick Start

```bash
# From repo root (recommended)
npm run ai:train
npm run ai:serve

# Or from spaceAI/ directory
cd spaceAI
pip install -r requirements.txt
python run.py train
python run.py serve
```

## Features

- **Classification**: Predicts body type (Planet, Moon, Star, DwarfPlanet, Asteroid, Comet, Interstellar, Spacecraft)
  from 11 features; supports RF, SVC, LogisticRegression, and Ensemble (RF + GB + SVC with soft voting)
- **Uncertainty**: Normalized entropy per prediction (0 = certain, 1 = uniform); threshold at 0.4 triggers "Uncertain" badge in the UI
- **User corrections**: `POST /classify/{body_id}/correct` stores corrections; `python run.py retrain` incorporates them into the next model
- **Hyperparameter tuning**: `--tune` flag runs GridSearchCV with StratifiedKFold(3)
- **Cross-validation**: `python run.py cv` runs 3-fold CV on saved model
- **Regression**: Predicts mass and temperature via RandomForestRegressor with confidence intervals
- **Precomputed cache**: All bodies classified via `python run.py train`, cached to `data/ai_cache.json`, loaded by Express at startup, served via `GET /api/ai/precomputed`
- **Similarity**: Finds similar objects via cosine distance across all features
- **API**: Express serves `GET /api/ai/classify/{body_id}` returning class, confidence, uncertainty,
  alternatives, feature importances, and similar objects (from precomputed cache)
- **Model**: Pipeline(StandardScaler, classifier) trained on 51 celestial objects
  — saves `celestial_classifier.pkl` + `celestial_classifier.meta.json`

## CLI

| Command | Action |
|---------|--------|
| `python run.py train` | Train classifier (add `--model-type svc`, `--tune`) |
| `python run.py cv` | Run 3-fold cross-validation on saved model |
| `python run.py test` | Evaluate on held-out split |
| `python run.py query --features <11 floats>` | Classify one object |
| `python run.py classify` | Batch classify all dataset rows |
| `python run.py recommend --object-idx <n>` | Find similar objects |
| `python run.py train-regression` | Train mass + temperature regressors |
| `python run.py predict-mass --features <11 floats>` | Predict mass with CI |
| `python run.py predict-temperature --features <11 floats>` | Predict temperature with CI |
| `python run.py serve` | Start FastAPI on :8000 |

## 11 Features

`orbital_period`, `axial_tilt`, `mass`, `radius`, `eccentricity`, `density`,
`gravity`, `temperature`, `semi_major_axis`, `inclination`, `rotation_period`

## Integration

- Express loads `data/ai_cache.json` at startup, serves `GET /api/ai/precomputed` and `GET /api/ai/classify/:bodyId` directly — no FastAPI runtime needed
- Frontend fetches `/api/ai/precomputed` once on mount; falls back to per-body `/api/ai/classify/:bodyId`
- Corrections stored in-memory by Express; `npm run ai:retrain` incorporates them into the next model
- `scripts/validate_models.py` checks generated GLBs against classifier
