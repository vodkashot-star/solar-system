# Model Training Guide

Building and evaluating machine learning models for celestial data.

## Types of Models

### Classification (current)
Predicts categorical labels (Planet, Moon, Asteroid, DwarfPlanet, Star, Comet, InterstellarObject) from 5 physical features.

### Regression (future)
Predict continuous values (e.g., orbital period, mass).

## Quick Start

```bash
python run.py train    # Train and save model
python run.py test     # Evaluate on test split
```

## Training Workflow

### 1. Train the Model

```bash
# Trains RandomForest with StandardScaler pipeline
python run.py train
```

This reads `data/celestial_objects.csv`, trains a RandomForestClassifier (100 estimators, balanced classes) with a StandardScaler, and saves to `models/celestial_classifier.pkl`.

### 2. Evaluate

```bash
python run.py test
```

Outputs accuracy score and a full precision/recall/F1 classification report on the held-out 20% test split.

### 3. Test Predictions

```bash
# Single prediction (5 features: orbital_period axial_tilt mass radius eccentricity)
python run.py query --features 365.25 23.44 1.0 1.0 0.017

# With class probabilities
python run.py query --features 687 25.19 0.107 0.532 0.094 --proba

# Batch classification from CSV
python run.py classify --output predictions.csv
```

### 4. Discover Similar Objects

```bash
# Find 3 objects most similar to Earth (index 2)
python run.py recommend --object-idx 2 --top-k 3

# Custom query
python run.py recommend --features 88 0.034 0.055 --top-k 3
```

## Feature Columns

All training and prediction use these 5 features:

| Feature | Unit | Description |
|---------|------|-------------|
| `orbital_period` | days | Time for one full orbit |
| `axial_tilt` | degrees | Tilt of rotation axis |
| `mass` | Earth masses | Body mass relative to Earth |
| `radius` | Earth radii | Body radius relative to Earth |
| `eccentricity` | 0–1 | Orbit shape (0 = circle) |

## Model Details

- **Algorithm**: RandomForestClassifier (100 estimators)
- **Preprocessing**: StandardScaler (zero mean, unit variance)
- **Class balancing**: `class_weight="balanced"`
- **Train/test split**: 80/20, `random_state=42`
- **Serialization**: joblib `.pkl`

## Model Persistence

Models are saved to `models/` directory as `.pkl` files using joblib.
