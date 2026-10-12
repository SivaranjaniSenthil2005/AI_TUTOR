#!/usr/bin/env bash
# scripts/dev_all.sh - Start AI Tutor Backend & Frontend together
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "Starting AI Tutor (Standard 10 RAG & Gaze)"
echo "=========================================="

echo "[1/3] Checking environment..."
python3 "$ROOT_DIR/scripts/check_env.py" || python "$ROOT_DIR/scripts/check_env.py"

cleanup() {
  echo "Shutting down AI Tutor processes..."
  kill $(jobs -p) 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[2/3] Starting Backend (FastAPI on 127.0.0.1:8000)..."
cd "$ROOT_DIR/backend"
if [ -d ".venv" ]; then
  source .venv/bin/activate
fi
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 &

echo "[3/3] Starting Frontend (Next.js on 127.0.0.1:3000)..."
cd "$ROOT_DIR/frontend"
npm run dev
