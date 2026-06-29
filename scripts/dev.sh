#!/usr/bin/env bash
set -euo pipefail

SPACEAI_DIR="$(cd "$(dirname "$0")/../spaceAI" && pwd)"
VENV="$SPACEAI_DIR/venv/bin/activate"
MODEL="$SPACEAI_DIR/models/celestial_classifier.pkl"

# ── Cleanup: kill both child processes on exit ─────────────────────────────
FASTAPI_PID=""
NODE_PID=""
cleanup() {
  echo ""
  [[ -n "$FASTAPI_PID" ]] && kill "$FASTAPI_PID" 2>/dev/null && echo "[dev] FastAPI stopped"
  [[ -n "$NODE_PID"    ]] && kill "$NODE_PID"    2>/dev/null && echo "[dev] Node stopped"
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── Pre-flight ─────────────────────────────────────────────────────────────
if [[ ! -f "$VENV" ]]; then
  echo "[dev] ERROR: venv not found at $VENV"
  echo "      Run: cd spaceAI && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

# Train model if missing
if [[ ! -f "$MODEL" ]]; then
  echo "[dev] Model not found — training now..."
  source "$VENV"
  python "$SPACEAI_DIR/src/train_model.py"
fi

# ── Start FastAPI ──────────────────────────────────────────────────────────
echo "[dev] Starting FastAPI on :8000..."
source "$VENV"
uvicorn api:app --app-dir "$SPACEAI_DIR" --host 127.0.0.1 --port 8000 --log-level warning &
FASTAPI_PID=$!

# Wait for FastAPI to be ready (up to 10s)
for i in $(seq 1 20); do
  if curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; then
    echo "[dev] FastAPI ready"
    break
  fi
  sleep 0.5
  if [[ $i -eq 20 ]]; then
    echo "[dev] ERROR: FastAPI did not start within 10s"
    cleanup
  fi
done

# ── Start Node ─────────────────────────────────────────────────────────────
echo "[dev] Starting Express on :5000..."
npm run dev &
NODE_PID=$!

# ── Monitor: restart or notify if either process dies ─────────────────────
while true; do
  sleep 5

  if ! kill -0 "$FASTAPI_PID" 2>/dev/null; then
    echo "[dev] WARNING: FastAPI (pid $FASTAPI_PID) died — Express will return 503 for AI requests"
    echo "[dev] Restarting FastAPI..."
    source "$VENV"
    uvicorn api:app --app-dir "$SPACEAI_DIR" --host 127.0.0.1 --port 8000 --log-level warning &
    FASTAPI_PID=$!
  fi

  if ! kill -0 "$NODE_PID" 2>/dev/null; then
    echo "[dev] ERROR: Node server (pid $NODE_PID) died — exiting"
    cleanup
  fi
done
