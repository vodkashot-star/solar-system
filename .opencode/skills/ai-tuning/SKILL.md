---
name: ai-tuning
description: Use when tuning the spaceAI ML microservice — retraining, user corrections loop, misclassifications, model accuracy, hyperparameters, cache sync between ai_cache.json and Postgres, or running ai:* commands (numpy/venv issues included).
---

# AI Tuning (spaceAI)

Microservice on :8000 (FastAPI). All npm `ai:*` scripts must run through the
project venv — **plain `python` has no numpy**:
`cd spaceAI && ./venv/bin/python run.py <cmd>` (package.json already wired).

## Commands

| Command | Action |
|---------|--------|
| `npm run ai:train` | Train RF/SVC/LogReg/ensemble on full dataset |
| `npm run ai:train-regression` | Train regression models (`prediction_logs`) |
| `npm run ai:retrain` | Retrain including user corrections (DB + pending queue) |
| `npm run ai:cv` | StratifiedKFold(3) cross-validation |
| `npm run ai:test` | pytest suite |
| `./venv/bin/python run.py classify` | Classify all dataset objects |

`run.py` subcommands with flags: `train/retrain --model-type rf|svc|logreg|ensemble
--tune` (GridSearchCV) `--augment`.

## Tuning workflow (misclassifications)

1. Reproduce: `curl http://localhost:5000/api/ai/classify/<bodyId>` (Express
   merged-cache path) vs direct FastAPI `curl http://localhost:8000/classify/<bodyId>`.
2. Correct: POST `/api/ai/correct` (Express writes Postgres `corrections` +
   forwards to FastAPI SQLite; if :8000 offline, queued to
   `spaceAI/data/pending_corrections.json`, drained on FastAPI startup).
3. Retrain: `npm run ai:retrain` — `train_with_corrections()` in
   `src/train_model.py`.
4. Cache sync: Express loads `data/ai_cache.json` at startup. After retrain,
   **regenerate the cache** (`run.py classify` writes it) and restart Express
   (or wait for cache TTL) — else stale classifications keep serving.

## Critical training quirk — never remove

`train_model.py` calls `prod_pipe.fit(X, y)` on the FULL dataset **after** the
evaluation split, so rare classes appear in `pipeline.classes_`. Deleting or
moving that fit breaks classification of rare classes (rare classes crash
`predict` with unseen-label errors).

## Key paths

- `spaceAI/src/train_model.py` — `DATA_PATH`, `FEATURES` (11 features), `TARGET`,
  `train()`, `train_with_corrections()`, `cross_validate()`
- `spaceAI/data/ai_cache.json` — precomputed cache merged by Express at runtime
- `spaceAI/data/spaceai.db` — SQLite corrections store
- `server/routes.ts` — `getMergedAICache()` (DB→file→static, 60s TTL),
  correction invalidation must clear the merged cache

## Gotchas

- Venv is `spaceAI/venv` (python3.14). A rebooted box shows
  `ModuleNotFoundError: No module named 'numpy'` if scripts fell back to system
  python — use the venv path, never `python`.
- `npm run ai:test` uses the venv too (pytest).
- FastAPI dev run: `npm run ai:serve` (uvicorn on 0.0.0.0:8000). Not needed in
  production — Express serves from cache file.
