# SpaceAI

**Educational AI system for celestial classification and orbital prediction**

SpaceAI is a machine learning bridge between astronomy education and interactive game integration. It provides tools to classify celestial objects and predict orbital behavior using real astronomical data.

## Structure

```
spaceAI/
├── run.py              # Unified CLI (train, test, classify, query, recommend, serve)
├── api.py              # FastAPI server
├── data/               # CSV datasets
├── models/             # Trained .pkl models
├── notebooks/          # Jupyter experiments
├── src/                # Training and prediction modules
│   ├── train_model.py  # RandomForest classifier training
│   ├── predict.py      # CelestialPredictor class
│   ├── classify.py     # Batch CSV classification
│   └── recommend.py    # Cosine-similarity recommendations
└── docs/               # Documentation
```

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Train the classifier
python run.py train

# Test on held-out data
python run.py test

# Classify a single object
python run.py query --features 365.25 23.44 1.0 1.0 0.017 --proba

# Find similar objects
python run.py recommend --object-idx 2

# Start FastAPI server
python run.py serve
```

## Features

- **Classification**: Predicts body type (Planet, Moon, DwarfPlanet, Star, etc.) from 5 orbital/physical features
- **Similarity**: Finds most similar celestial objects via cosine distance
- **API**: FastAPI endpoint at `GET /classify/{body_id}` returning confidence, alternatives, feature importances, and similar objects
- **5 features**: `orbital_period`, `axial_tilt`, `mass`, `radius`, `eccentricity`

## Model

RandomForest classifier (100 estimators, balanced classes) with StandardScaler pipeline, trained on 47 celestial objects. Saved as `models/celestial_classifier.pkl` via joblib.

## Integration

Models trained here power educational features in the main Cosmic Voyage game:
- Celestial object classification
- Discovery recommendations via cosine similarity
- Feature importance explanations
