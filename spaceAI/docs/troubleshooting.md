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

### AI classifications not appearing (404)

The Express server loads `spaceAI/data/ai_cache.json` at startup. If the file
doesn't exist or is empty, classifications won't appear:

```bash
# Train/regenerate the cache
npm run ai:train
```

### Corrections lost after restart

Corrections are persisted to PostgreSQL by Express, so nothing is lost on
restart. If FastAPI was offline when a correction was submitted, it is queued
to `spaceAI/data/pending_corrections.json` and drained into the FastAPI SQLite
store when :8000 comes back up. Run retrain after corrections to fold them
into the model + cache:

```bash
npm run ai:retrain   # incorporates corrections into the model + cache
```

## Telegram Bot Issues

### "Invalid token" on startup

The bot loads secrets from the **root** `.env` (it runs with cwd=`spaceAI/` and
loads `../.env` via python-dotenv). If `.env` is missing it falls back to the
placeholder token in `telegram_bot.py` and Telegram rejects it. Check:

```bash
grep -E "TELEGRAM_BOT_TOKEN|OPENCODE_API_KEY" ../.env   # from spaceAI/
```

### Bot won't reach api.telegram.org / opencode.ai (hangs)

This box has no IPv6 route but DNS returns AAAA records first. The bot patches
`socket.getaddrinfo` to prefer IPv4 at startup; any manual `curl` tests need
`curl -4` (a plain curl will hang until timeout).

### "Relay Busy" replies

The OpenCode Zen free tier rate-limits (HTTP 429). The bot replies with
"Relay Busy" flavor text and recovers automatically — no action needed. If it
persists, check your usage/quota on the OpenCode Zen dashboard.

### Restarting the daemon

```bash
pkill -f "telegram_bot[.]py"                    # escape the dot or it kills its own shell
setsid nohup npm run ai:bot > /tmp/aibot.log 2>&1 &
ps -eo pid,etime,cmd | grep "telegram_bot[.]py"
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
3. Verify data format matches the [Data Format section](../README.md#dataset)
4. Test individual components: `run.py train` → `run.py test` → `run.py query`
