#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

info() { echo -e "${CYAN}[info]${NC} $1"; }
ok() { echo -e "${GREEN}[ok]${NC} $1"; }
fail() { echo -e "${RED}[error]${NC} $1"; exit 1; }

for cmd in python3 node docker; do
  command -v "$cmd" >/dev/null 2>&1 || fail "$cmd is required but not installed"
done

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

if [ ! -f backend/.env ]; then
  if [ -f backend/.env.example ]; then
    cp backend/.env.example backend/.env
    info "Copied backend/.env.example to backend/.env — edit with your Okta config"
  else
    fail "No backend/.env.example found"
  fi
fi

info "Starting DynamoDB Local..."
docker compose up -d dynamodb-local

if [ ! -d backend/venv ]; then
  info "Creating Python virtual environment..."
  python3 -m venv backend/venv
fi

info "Installing backend dependencies..."
backend/venv/bin/pip install -q -r backend/requirements.txt

if [ ! -d frontend/node_modules ]; then
  info "Installing frontend dependencies..."
  (cd frontend && npm install)
fi

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-local}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-local}"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  info "Shutting down..."
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  docker compose down dynamodb-local
  ok "Stopped"
}

trap cleanup EXIT INT TERM

info "Starting backend on http://localhost:8001"
(cd backend && ./venv/bin/uvicorn main:app --reload --port 8001) &
BACKEND_PID=$!

info "Starting frontend on http://localhost:5173"
(cd frontend && npx vite --host) &
FRONTEND_PID=$!

ok "Development servers running"
echo ""
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:8001"
echo "  DynamoDB:  http://localhost:8002"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

wait
