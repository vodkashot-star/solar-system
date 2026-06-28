# Integration Guide

Connecting SpaceAI models to the Cosmic Voyage game.

## Integration Architecture

```
Game ←→ Express API ←→ Python Inference ←→ Trained Model
```

## Prerequisites

- Trained model saved in `models/` (run `python src/train_model.py`)
- Python environment with `poetry install`

## Game Integration Steps

### 1. Train the Model

```bash
cd spaceAI
python src/train_model.py
```

### 2. Call Predictions from Node.js / Express

```typescript
// In your Express server route
import { execSync } from "child_process";

app.get("/api/classify/:bodyId", (req, res) => {
  const features = getFeaturesForBody(req.params.bodyId);
  const result = execSync(
    `python spaceAI/src/predict.py --orbital-period ${features.orbitalPeriod} --axial-tilt ${features.axialTilt} --mass ${features.mass}`,
  ).toString();
  res.json({ prediction: result.trim(), features });
});
```

### 3. API Response Format (from predict.py)

```
Prediction: Planet
```

With `--debug` flag, returns probabilities and feature importances to stderr.

### 4. Batch Classification

```bash
# Classify all objects in the dataset
python src/classify.py --dataset data/celestial_objects.csv --output predictions.csv
```

### 5. Discovery Recommendations

```bash
# Find 3 most similar objects
python src/recommend.py --dataset data/celestial_objects.csv --object-idx 2 --top-k 3
```

## Available Scripts

| Script | Purpose | CLI Example |
|--------|---------|-------------|
| `src/predict.py` | Single object classification | `--orbital-period 365 --axial-tilt 23.5 --mass 5.97e24` |
| `src/classify.py` | Batch CSV classification | `--dataset data/celestial_objects.csv` |
| `src/recommend.py` | Discovery recommendations | `--dataset data/celestial_objects.csv --object-idx 0` |

## TypeScript Type Mapping

The output of `predict.py` maps to the `AIAnalysis` type in the client:

```typescript
type AIAnalysis = {
  classification: string;    // predict.py output
  confidence: number;        // from predict_proba()
  alternatives: Array<{      // from predict_proba() top-3
    type: string;
    score: number;
  }>;
  features: Array<{          // from feature_importances_
    name: string;
    value: number;
    importance: number;
  }>;
  similarObjects: Array<{    // from recommend.py
    bodyId: string;
    similarity: number;
  }>;
};
```

## Performance Tips

- Pre-compute predictions for all bodies at build time
- Cache frequent queries
- Use async I/O for game integration
- The DecisionTree classifier is fast (< 1ms per prediction)

## Debug Mode

```bash
# Show class probabilities and feature importances
python src/predict.py --orbital-period 687 --axial-tilt 25.2 --mass 6.42e23 --debug
```
