# Troubleshooting

Common issues and solutions when working with SpaceAI.

## Installation Issues

### "Module not found" errors
```bash
# Reinstall dependencies
poetry install --no-cache
```

### Jupyter not starting
```bash
# Reinstall Jupyter
poetry add jupyter
```

## Data Issues

### Missing values in datasets
```python
# Handle NaN values
df = df.dropna()  # or df.fillna(df.mean())
```

### File not found errors
Verify paths from project root:
```bash
ls data/stars.csv
```

## Model Issues

### Poor prediction accuracy
1. Check data quality (outliers, NaN values)
2. Try different model types
3. Tune hyperparameters
4. Collect more training data

### Model loading fails
```python
# Verify model file exists
import os
print(os.path.exists('models/model.pkl'))

# Check Python version compatibility
import sklearn
print(sklearn.__version__)
```

## Performance Issues

### Slow inference
- Use smaller models for real-time
- Cache predictions
- Batch requests

### High memory usage
```python
# Reduce data types
df = df.astype({'column': 'float32'})
```

## Game Integration Issues

### API returns empty results
Check feature order matches training features:
```bash
python src/classify.py --debug --features '{"temp": 5800, "mass": 1.0}'
```

### Connection timeouts
- Increase timeout values
- Use async calls
- Implement retry logic

## Getting Help

1. Check logs: `export DEBUG=true`
2. Review error messages carefully
3. Verify data format matches docs
4. Test individual components first
