# Integration Guide

Connecting SpaceAI models to the Cosmic Voyage game.

## Integration Architecture

```
Game ←→ Express API ←→ FastAPI (/classify) ←→ Trained Model
```

## Prerequisites

- Trained model saved in `models/` (run `python run.py train`)
- Python environment with dependencies installed

## Game Integration Steps

### 1. Train the Model

```bash
cd spaceAI
python run.py train
```

### 2. Start the FastAPI Server

```bash
python run.py serve
# Runs on http://localhost:8000
```

### 3. Call from Express / Node.js

```typescript
app.get("/api/classify/:bodyId", async (req, res) => {
  const { orbitalPeriod, axialTilt, mass, radius, eccentricity } = getFeatures(req.params.bodyId);
  const url = `http://localhost:8000/classify/${req.params.bodyId}` +
    `?orbital_period=${orbitalPeriod}&axial_tilt=${axialTilt}` +
    `&mass=${mass}&radius=${radius}&eccentricity=${eccentricity}`;
  const response = await fetch(url);
  const analysis = await response.json();
  res.json(analysis);
});
```

### 4. API Response Format

```json
{
  "classification": "Planet",
  "confidence": 0.92,
  "alternatives": [
    { "type": "DwarfPlanet", "score": 0.05 },
    { "type": "Moon", "score": 0.02 }
  ],
  "features": [
    { "name": "orbital_period", "value": 365.25, "importance": 0.28 },
    { "name": "axial_tilt", "value": 23.44, "importance": 0.15 },
    { "name": "mass", "value": 1.0, "importance": 0.32 },
    { "name": "radius", "value": 1.0, "importance": 0.18 },
    { "name": "eccentricity", "value": 0.017, "importance": 0.07 }
  ],
  "similarObjects": [
    { "bodyId": "venus", "similarity": 0.87 },
    { "bodyId": "mars", "similarity": 0.82 },
    { "bodyId": "mercury", "similarity": 0.74 }
  ]
}
```

### 5. Batch Classification (CLI)

```bash
python run.py classify --output predictions.csv
```

### 6. Discovery Recommendations (CLI)

```bash
python run.py recommend --object-idx 2 --top-k 3
```

## CLI Quick Reference

| Command | Purpose | Example |
|---------|---------|---------|
| `run.py train` | Train RandomForest classifier | `python run.py train` |
| `run.py test` | Evaluate on test split | `python run.py test` |
| `run.py query` | Single object classification | `--features 365 23 1 1 0.017` |
| `run.py classify` | Batch CSV classification | `--output results.csv` |
| `run.py recommend` | Find similar objects | `--object-idx 0 --top-k 5` |
| `run.py serve` | Start FastAPI server | `--port 8080 --reload` |

## TypeScript Type Mapping

The FastAPI response maps to the `AIAnalysis` type in the client:

```typescript
type AIAnalysis = {
  classification: string;
  confidence: number;
  alternatives: Array<{ type: string; score: number }>;
  features: Array<{ name: string; value: number; importance: number }>;
  similarObjects: Array<{ bodyId: string; similarity: number }>;
};
```

## Performance Tips

- Pre-compute predictions for all bodies at build time
- Cache frequent queries
- The RandomForest classifier is fast (< 5ms per prediction)
- Model loads once at server startup
