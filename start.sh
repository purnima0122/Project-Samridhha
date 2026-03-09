#!/bin/zsh
# ============================================================
#  Runs Frontend, Backend (NestJS)
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

# ─── 1. Backend (NestJS — port 3000) ────────────────────────
echo "\n${GREEN}[1/2]${NC} Starting Backend NestJS (port 3000)..."
cd "$PROJECT_ROOT/backend-nest"
npm run start:dev &
PIDS+=($!)
echo "  ${GREEN}✓${NC} Backend PID: $PIDS[-1]"

# ─── 2. Frontend (Expo — port 8081) ─────────────────────────
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
echo "  Backend API:  ${GREEN}http://localhost:3000${NC}"
echo "  Frontend:     ${GREEN}http://localhost:8081${NC}"
echo "  Data-Server:  ${GREEN}https://samridhha-data.manasi.com.np${NC}"
echo "  Data-Server Docs: ${GREEN}https://samridhha-data.manasi.com.np/apidocs${NC}"
echo ""
echo "  ${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for all background processes
wait