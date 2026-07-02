# Troubleshooting

Common issues and solutions when working with SpaceAI.

## Installation Issues

### "Module not found" errors

```bash
pip install -r requirements.txt
```

### FastAPI / uvicorn not installed

```bash
pip install fastapi uvicorn
```

## Model Issues

### "Model not found" when running query/classify/serve

```bash
# Train the model first
python run.py train
```

### Poor prediction accuracy

1. Check data quality in `data/celestial_objects.csv`
2. Verify features are properly scaled
3. Collect more training data

### Model loading fails

```python
import os
print(os.path.exists('models/celestial_classifier.pkl'))

import sklearn
print(sklearn.__version__)
```

## API Issues

### FastAPI server won't start

```bash
# Check if port is in use
lsof -i :8000

# Use a different port
python run.py serve --port 8080
```

### CORS errors from browser

The FastAPI server has CORS middleware configured for all origins. If issues
persist, check `api.py` CORS settings.

### 503 "Model not loaded"

Train the model before starting the server:

```bash
python run.py train && python run.py serve
```

## Data Issues

### Missing values in datasets

```python
# Handled automatically during training (fillna(0))
# Or clean manually:
df = df.dropna()
```

### File not found errors

Verify paths from project root:

```bash
ls data/celestial_objects.csv
```

## Performance Issues

### Slow inference

- RandomForest is fast (< 5ms per prediction)
- Model loads once at server startup
- Cache frequent queries if needed

### High memory usage

```python
# Reduce data types
df = df.astype({'column': 'float32'})
```

## Getting Help

1. Run with verbose output where available
2. Review error messages carefully
3. Verify data format matches [data-format.md](data-format.md)
4. Test individual components: `run.py train` → `run.py test` → `run.py query`
