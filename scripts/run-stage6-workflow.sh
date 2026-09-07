#!/bin/bash
# scripts/run-stage6-workflow.sh
# 
# Complete Stage 6 evaluation workflow helper
# Stages the server, runs tests, and collects scores

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3000}"

echo "====== Stage 6 Evaluation Workflow ======"
echo "Project: Wayfinder Japan"
echo "Date: $(date)"
echo ""

# Check for .env
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo "ERROR: .env file not found. Copy .env.example and add GEMINI_API_KEY."
    exit 1
fi

# Verify GEMINI_API_KEY
if ! grep -q "GEMINI_API_KEY" "$PROJECT_ROOT/.env"; then
    echo "ERROR: GEMINI_API_KEY not set in .env"
    exit 1
fi

echo "[1/4] Loading environment..."
export $(cat "$PROJECT_ROOT/.env" | grep -v '^#')

echo "[2/4] Starting server on port $PORT..."
cd "$PROJECT_ROOT"
node server.mjs > /tmp/wayfinder-server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to start
sleep 3
if ! curl -s http://localhost:$PORT/api/health > /dev/null; then
    echo "ERROR: Server failed to start"
    kill $SERVER_PID 2>/dev/null || true
    cat /tmp/wayfinder-server.log
    exit 1
fi
echo "✓ Server running"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "[4/4] Cleanup: Stopping server..."
    kill $SERVER_PID 2>/dev/null || true
    echo "✓ Done"
}

trap cleanup EXIT

echo "[3/4] Running evaluation pipeline..."
echo ""

# Run the evaluator
node scripts/evaluate-stage6.mjs "$@"

echo ""
echo "====== Workflow Complete ======"
echo "Results saved to: results/"
echo "CSV Summary: results/stage6_evaluation_matrix.csv"
echo "Full Summary: results/stage6_evaluation_summary.json"
echo ""
echo "Next steps:"
echo "  - Review results/ directory for raw output proof"
echo "  - Open results/stage6_evaluation_matrix.csv in Excel/Sheets"
echo "  - Use results/stage6_evaluation_summary.json for the report"
