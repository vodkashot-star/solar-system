# Model Training Guide

Building and evaluating machine learning models for celestial data.

## Types of Models

### Classification
Predict categorical labels (e.g., Planet, Moon, Asteroid, DwarfPlanet).

**Use cases:**
- Celestial object type identification
- Comparing new objects against known categories

### Regression (future)
Predict continuous values (e.g., orbital period, mass).

## Training Workflow

### 1. Train Model

```bash
# From the spaceAI/ directory:

# Quick training (auto-creates dataset if missing)
python src/setup_and_train.py

# Full training with options
python src/train_model.py --dataset data/celestial_objects.csv --output models/my_model.pkl

# Adjust tree depth and test split
python src/train_model.py --max-depth 3 --test-size 0.2 --debug
```

### 2. Evaluate

```bash
# Show classification report and feature importances
python src/train_model.py --debug
```

### 3. Test Predictions

```bash
# Single prediction
python src/predict.py --orbital-period 687 --axial-tilt 25.2 --mass 6.42e23 --debug

# Batch classification from CSV
python src/classify.py --dataset data/celestial_objects.csv --output predictions.csv
```

### 4. Discover Similar Objects

```bash
# Recommend similar to first object in dataset
python src/recommend.py --dataset data/celestial_objects.csv --object-idx 0 --top-k 3
```

## Training Scripts

| Script | Use Case | Command |
|--------|----------|---------|
| `setup_and_train.py` | Quick start, auto-creates dataset | `python src/setup_and_train.py` |
| `train_model.py` | Full training with CLI options | `python src/train_model.py --dataset ...` |

## Prediction Scripts

| Script | Use Case | Command |
|--------|----------|---------|
| `predict.py` | Single/batch object classification | `python src/predict.py --orbital-period ...` |
| `classify.py` | Batch classify from CSV dataset | `python src/classify.py --dataset ...` |
| `recommend.py` | Find similar celestial objects | `python src/recommend.py --dataset ...` |

## Feature Columns

All training and prediction use these features:
- `orbital_period` - Days (float)
- `axial_tilt` - Degrees (float)
- `mass` - Earth masses (float)

## Model Persistence

Models are saved to `models/` directory as `.pkl` files using joblib.
