#!/bin/zsh
# ============================================================
#  STOCKLEARN — Start All Services
#  Runs Frontend, Backend (NestJS), and Data Server together
# ============================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "${CYAN}============================================${NC}"
echo "${CYAN}  STOCKLEARN — Starting All Services${NC}"
echo "${CYAN}============================================${NC}"

# Track PIDs for cleanup
PIDS=()

cleanup() {
    echo ""
    echo "${YELLOW}Shutting down all services...${NC}"
    for pid in $PIDS; do
        kill "$pid" 2>/dev/null && echo "  Stopped PID $pid"
    done
    wait 2>/dev/null
    echo "${GREEN}All services stopped.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# ─── 1. Data Server (Python/Flask — port 4000) ──────────────
echo "\n${GREEN}[1/3]${NC} Starting Data Server (port 4000)..."
cd "$PROJECT_ROOT/Data-Server"
conda run -n kuaic python run.py &
PIDS+=($!)
echo "  ${GREEN}✓${NC} Data Server PID: $PIDS[-1]"

# ─── 2. Backend (NestJS — port 3000) ────────────────────────
echo "\n${GREEN}[2/3]${NC} Starting Backend NestJS (port 3000)..."
cd "$PROJECT_ROOT/backend-nest"
npm run start:dev &
PIDS+=($!)
echo "  ${GREEN}✓${NC} Backend PID: $PIDS[-1]"

# ─── 3. Frontend (Expo — port 8081) ─────────────────────────
echo "\n${GREEN}[3/3]${NC} Starting Frontend Expo..."
cd "$PROJECT_ROOT/StockLaern"
npx expo start --web &
PIDS+=($!)
echo "  ${GREEN}✓${NC} Frontend PID: $PIDS[-1]"

# ─── Summary ────────────────────────────────────────────────
echo ""
echo "${CYAN}============================================${NC}"
echo "${CYAN}  All services started!${NC}"
echo "${CYAN}============================================${NC}"
echo "  Data Server:  ${GREEN}http://localhost:4000${NC}"
echo "  Swagger Docs: ${GREEN}http://localhost:4000/apidocs${NC}"
echo "  Backend API:  ${GREEN}http://localhost:3000${NC}"
echo "  Frontend:     ${GREEN}http://localhost:8081${NC}"
echo ""
echo "  ${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for all background processes
wait
