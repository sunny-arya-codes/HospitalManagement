#!/usr/bin/env bash
# ─────────────────────────────────────────────────
# Hospital Management System — Quick Start Script
# Starts the Flask backend and a simple HTTP frontend
# ─────────────────────────────────────────────────
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/Backend"
FRONTEND_DIR="$ROOT_DIR/Frontend"
VENV="$BACKEND_DIR/venv"

cleanup() {
  echo ""
  echo "🛑 Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  exit 0
}
trap cleanup INT TERM

# ── 1. Virtual environment ────────────────────────
if [ ! -d "$VENV" ]; then
  echo "📦 Creating Python virtual environment..."
  python3 -m venv "$VENV"
fi

echo "📦 Installing / updating backend dependencies..."
"$VENV/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"

# ── 2. Start Flask backend (now also serving frontend) ──
echo "🚀 Starting Hospital Management System on http://localhost:8000 ..."
"$VENV/bin/python" "$BACKEND_DIR/app.py" &
BACKEND_PID=$!

echo ""
echo "✅ Hospital Management System is running!"
echo "   Access the app  → http://localhost:8000"
echo ""
echo "   Admin login: admin / Admin@123"
echo ""
echo "Press Ctrl+C to stop the server."

wait
