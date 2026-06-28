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
│                     Python API Layer                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  classify   │ │  predict    │ │ recommend   │           │
│  │    .py      │ │    .py      │ │    .py      │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Trained Models                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  .pkl/.h5   │ │  .pkl/.h5   │ │  .pkl/.h5   │           │
│  │ classification│ regression │  ensemble   │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  stars.csv  │ │ planets.csv │ │galaxies.csv │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### Data Layer
- `data/stars.csv` - Stellar parameters
- `data/planets.csv` - Planetary orbits
- `data/galaxies.csv` - Galactic features

### Model Layer
- Trained scikit-learn models (.pkl)
- Keras/TensorFlow models (.h5)
- Model metadata in `models/`

### API Layer
- REST endpoints (via Flask/FastAPI if needed)
- CLI scripts for batch processing
- Python importable modules

## Data Flow

1. Game requests classification/prediction
2. API loads model from `models/`
3. Feature vector prepared from game state
4. Model inference executed
5. Results formatted for game consumption
6. Response sent back to game

## Extensions

Add new model types by:
1. Adding data to `data/`
2. Creating training script in `notebooks/`
3. Saving model to `models/`
4. Adding API endpoint in `src/`
