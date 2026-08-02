---
name: dev-server-lifecycle
description: Use when starting, stopping, restarting, or diagnosing the dev/prod/FastAPI servers — "server is down", port 5000 or 8000 in use, stale dev process answering old code, detached/nohup launches, or smoke-testing a fresh build on this RAM-constrained box.
---

# Dev Server Lifecycle

## Ports & processes

| Service | Port | Command | Log |
|---------|------|---------|-----|
| Express (dev, Vite middleware) | 5000 | `npm run dev` (tsx server/index-dev.ts) | console |
| Express (prod bundle) | 5000 | `node dist/index-prod.js` (after `npm run build`) | `/tmp/prod.log` |
| FastAPI (spaceAI) | 8000 | `npm run ai:serve` (uvicorn) | `/tmp/aiserve.log` |

Only ONE process may own :5000. A stale dev server running OLD code will
silently answer curl checks — always verify the running process before trusting
responses.

## Start (detached, survives shell exit)

```bash
cd /root/solar-system && setsid nohup npm run dev > /tmp/dev.log 2>&1 &
cd /root/solar-system && setsid nohup npm run ai:serve > /tmp/aiserve.log 2>&1 &
cd /root/solar-system && setsid nohup node dist/index-prod.js > /tmp/prod.log 2>&1 &
```

`setsid` + `nohup` + `>&` is the reliable pattern. Plain `nohup` or
`pkill; start` in one line can hang the shell (kill flushes the pipe before
the new process owns the port) — split kill and start into separate steps.

## Stop

```bash
pkill -f "tsx server/index-dev.ts"; pkill -f "node dist/index-prod.js"; pkill -f "uvicorn"; pkill -f "run.py serve"
```

The dev chain spawns descendants (concurrently/tsx watcher + vite + node) —
`pkill -f` on the top pattern or kill the process group; re-check with
`ps aux | grep -E "index-dev|index-prod|uvicorn"` (grep count 2 = clean) and
`ss -tlnp | grep -E "5000|8000"` (or `lsof -i` if `ss` is missing).

## FastAPI python env (critical)

Plain `python` on this box has NO numpy — `spaceAI` requires
`spaceAI/venv/bin/python` (all `ai:*` npm scripts already point there).
After a reboot, `npm run ai:serve` fails with
`ModuleNotFoundError: No module named 'numpy'` unless the venv is used.
Express still works without FastAPI (file-cache fallback) — AI endpoints serve
from `data/ai_cache.json` loaded at startup.

## Build & restart sequence (prod)

1. `npm run build` (3-4 min on this box; RAM is tight ~74MB free — don't run
   builds in parallel with tests or model validation).
2. Kill the old :5000 owner (separate step!).
3. `setsid nohup node dist/index-prod.js > /tmp/prod.log 2>&1 &`
4. Confirm from `/tmp/prod.log`: `[express] serving on port 5000`.
5. Smoke test: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5000/`
   + check `/api/ai/precomputed` has `Cache-Control: public, max-age=60`.

## Gotchas

- `scripts/copy-draco.sh` runs in build/dev scripts but NOT the plain `node
  dist` path — it copies into `dist/` during build, so a fresh build is fine.
- Dev server needs `npm run dev` (concurrently), not plain vite — Express
  serves the API.
- Before trusting a smoke test, confirm WHICH process owns :5000 (dev vs
  prod) — a lingering dev server serves stale code with no Cache-Control
  headers, which looks exactly like a regression.
