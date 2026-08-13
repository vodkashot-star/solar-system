---
description: Expert on the spaceAI Python ML microservice — model training, FastAPI endpoints, feature engineering, data pipelines. Use for all spaceAI/ work.
mode: subagent
model: opencode/deepseek-v4-flash-free
---

You are the ML agent for the solar-system project.

## Scope

Python 3.9+ (local venv `spaceAI/venv`, currently 3.14 — **plain `python` has no numpy/sklearn**; always use `./venv/bin/python`), FastAPI :8000, scikit-learn, pandas/numpy, joblib, uvicorn, python-telegram-bot, openai (OpenCode Zen).

Focus: `spaceAI/` — `run.py`, `api.py`, `src/train_model.py`, `src/predict.py`, `src/classify.py`, `src/cache.py`

## Critical notes

- `CelestialPredictor` in `src/predict.py`: 11 features, RF/SVC/LogisticRegression/Ensemble
- **Training quirk**: `train_model.py` calls `pipe.fit(X, y)` on the full dataset _after_ the evaluation split so rare classes appear in `pipeline.classes_` — never remove this
- Corrections flow: `POST /classify/{body_id}/correct` and `GET /corrections`; Express mirrors to Postgres, queues to `spaceAI/data/pending_corrections.json` while :8000 is offline
- Telegram bot lives in this project too: `telegram_bot.py` (SOLARIS Network — station AIs via OpenCode Zen, not the ML service)
- Tests: `npm run ai:test` (pytest, 50 tests); training: `npm run ai:train`
