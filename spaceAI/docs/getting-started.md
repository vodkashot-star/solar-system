# Getting Started with SpaceAI

Quick setup to run your first ML pipeline for celestial classification.

## Prerequisites

- Python 3.10+
- Poetry (dependency management)
- Jupyter Notebook (optional, for interactive development)

## Installation

```bash
# Install dependencies
poetry install

# Activate the virtual environment
poetry shell
```

## Quick Start

### 1. Explore the Data

```bash
ls -la data/
```

Datasets include:
- `celestial_objects.csv` - Celestial body features with classification labels
- `stars.csv` - Stellar parameters for reference
- `planets.csv` - Planetary orbital data for reference
- `galaxies.csv` - Galactic features for reference

### 2. Train a Model (Command Line)

```bash
# From the spaceAI/ directory
python src/train_model.py

# Train with custom dataset and output
python src/train_model.py --dataset data/celestial_objects.csv --output models/my_model.pkl

# Show training details
python src/train_model.py --debug
```

### 3. Test Predictions

```bash
# Classify a single object
python src/predict.py --orbital-period 365 --axial-tilt 23.5 --mass 5.97e24

# Show class probabilities and feature importances
python src/predict.py --orbital-period 687 --axial-tilt 25.2 --mass 6.42e23 --debug

# Classify a batch from CSV
python src/classify.py --dataset data/celestial_objects.csv
```

### 4. Find Similar Objects

```bash
# Recommend similar objects from dataset
python src/recommend.py --dataset data/celestial_objects.csv --object-idx 0

# Recommend using custom features
python src/recommend.py --features 365 23.5 5.97e24 --top-k 3 --debug
```

### 5. Train a Model (Jupyter)

```bash
# Launch Jupyter notebook server
jupyter notebook notebooks/
```

Open `train_celestial_classifier.ipynb` to explore data and train interactively.

## Directory Structure

```
spaceAI/
├── data/         # CSV datasets
├── models/       # Saved .pkl models
├── notebooks/    # Jupyter experiments
├── src/          # Training and prediction scripts
└── docs/         # This documentation
```

## Next Steps

- Read [Data Format](data-format.md) to understand dataset columns
- Try [Model Training](model-training.md) for hands-on learning
- See [Integration](integration.md) to connect to the game
