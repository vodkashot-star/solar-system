# Getting Started with SpaceAI

Quick setup to run the ML pipeline for celestial classification.

## Prerequisites

- Python 3.10+
- pip

## Installation

```bash
cd spaceAI
pip install -r requirements.txt
```

## Quick Start

### 1. Train the Model

```bash
python run.py train
```

Trains a RandomForest classifier on `data/celestial_objects.csv` and saves to `models/celestial_classifier.pkl`.

### 2. Evaluate the Model

```bash
python run.py test
```

Prints accuracy and a full classification report on the held-out 20% test split.

### 3. Classify a Single Object

```bash
# Format: orbital_period axial_tilt mass radius eccentricity
python run.py query --features 365.25 23.44 1.0 1.0 0.017

# Show class probabilities
python run.py query --features 687 25.19 0.107 0.532 0.094 --proba
```

### 4. Classify All Objects in Dataset

```bash
python run.py classify
python run.py classify --output predictions.csv
```

### 5. Find Similar Objects

```bash
# Find 3 objects most similar to Earth (index 2)
python run.py recommend --object-idx 2

# Custom query features
python run.py recommend --features 365.25 23.44 1.0 --top-k 5
```

### 6. Start the API Server

```bash
python run.py serve              # Default port 8000
python run.py serve --port 8080  # Custom port
python run.py serve --reload     # Auto-reload on changes
```

## Directory Structure

```
spaceAI/
├── run.py              # Unified CLI
├── api.py              # FastAPI server
├── data/               # CSV datasets
├── models/             # Saved .pkl models
├── notebooks/          # Jupyter experiments
├── src/                # Training and prediction modules
└── docs/               # This documentation
```

## Next Steps

- Read [Data Format](data-format.md) to understand dataset columns
- Try [Model Training](model-training.md) for hands-on learning
- See [Integration](integration.md) to connect to the game
