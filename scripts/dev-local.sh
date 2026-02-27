#!/usr/bin/env bash
set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

VALIDATOR_PID=""
NEXTJS_PID=""

# ── Cleanup ─────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down...${NC}"
  if [[ -n "$NEXTJS_PID" ]] && kill -0 "$NEXTJS_PID" 2>/dev/null; then
    kill "$NEXTJS_PID" 2>/dev/null
    wait "$NEXTJS_PID" 2>/dev/null || true
    echo -e "  Stopped Next.js dev server (PID $NEXTJS_PID)"
  fi
  if [[ -n "$VALIDATOR_PID" ]] && kill -0 "$VALIDATOR_PID" 2>/dev/null; then
    kill "$VALIDATOR_PID" 2>/dev/null
    wait "$VALIDATOR_PID" 2>/dev/null || true
    echo -e "  Stopped solana-test-validator (PID $VALIDATOR_PID)"
  fi
  echo -e "${GREEN}Clean shutdown complete.${NC}"
}
trap cleanup EXIT INT TERM

# ── Prerequisites ───────────────────────────────────────────────────
echo -e "${BOLD}Checking prerequisites...${NC}"
MISSING=()

for cmd in solana solana-test-validator anchor npm; do
  if ! command -v "$cmd" &>/dev/null; then
    MISSING+=("$cmd not found in PATH")
  fi
done

WALLET="$HOME/.config/solana/id.json"
if [[ ! -f "$WALLET" ]]; then
  MISSING+=("Wallet not found at $WALLET (run: solana-keygen new)")
fi

FIXTURE="anchor/tests/fixtures/mpl_core.so"
if [[ ! -f "$FIXTURE" ]]; then
  MISSING+=("Metaplex Core fixture not found at $FIXTURE")
fi

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo -e "${RED}Missing prerequisites:${NC}"
  for item in "${MISSING[@]}"; do
    echo -e "  - $item"
  done
  exit 1
fi
echo -e "${GREEN}  All prerequisites met.${NC}"

# ── Build Anchor program (conditional) ──────────────────────────────
if [[ -f "anchor/target/deploy/clearance.so" ]]; then
  echo -e "${CYAN}Anchor program already built, skipping build.${NC}"
else
  echo -e "${BOLD}Building Anchor program...${NC}"
  (cd anchor && anchor build)
  echo -e "${GREEN}  Build complete.${NC}"
fi

# ── Start local validator ───────────────────────────────────────────
echo -e "${BOLD}Starting solana-test-validator...${NC}"
solana-test-validator \
  --reset \
  --ledger test-ledger \
  --bpf-program CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d "$FIXTURE" \
  --quiet &
VALIDATOR_PID=$!

# ── Wait for validator ──────────────────────────────────────────────
echo -n "  Waiting for validator"
TIMEOUT=30
ELAPSED=0
while ! solana cluster-version --url http://localhost:8899 &>/dev/null; do
  if [[ $ELAPSED -ge $TIMEOUT ]]; then
    echo ""
    echo -e "${RED}Validator failed to start within ${TIMEOUT}s.${NC}"
    exit 1
  fi
  echo -n "."
  sleep 1
  ((ELAPSED++))
done
echo ""
echo -e "${GREEN}  Validator ready.${NC}"

# ── Configure CLI + Airdrop ─────────────────────────────────────────
echo -e "${BOLD}Configuring Solana CLI and airdropping SOL...${NC}"
solana config set --url http://localhost:8899 --quiet
solana airdrop 5 --url http://localhost:8899 >/dev/null
echo -e "${GREEN}  Airdropped 5 SOL.${NC}"

# ── Deploy program ──────────────────────────────────────────────────
echo -e "${BOLD}Deploying program...${NC}"
solana program deploy \
  --url http://localhost:8899 \
  --keypair "$WALLET" \
  --program-id anchor/target/deploy/clearance-keypair.json \
  anchor/target/deploy/clearance.so
echo -e "${GREEN}  Program deployed.${NC}"

# ── Start Next.js dev server ────────────────────────────────────────
echo -e "${BOLD}Starting Next.js dev server...${NC}"
NEXT_PUBLIC_SOLANA_RPC_URL=http://localhost:8899 npm run dev &
NEXTJS_PID=$!

# ── Summary ─────────────────────────────────────────────────────────
PROGRAM_ID=$(solana-keygen pubkey anchor/target/deploy/clearance-keypair.json 2>/dev/null || echo "D3pfeCb4sgYoHWXcYbeKtQbUSJBoDPorp6kETv1SexxU")
WALLET_ADDR=$(solana-keygen pubkey "$WALLET" 2>/dev/null || echo "unknown")

echo ""
echo -e "${BOLD}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Clearance local dev environment is running!${NC}"
echo -e "${BOLD}════════════════════════════════════════════════${NC}"
echo -e "  App:        ${CYAN}http://localhost:3000${NC}"
echo -e "  RPC:        ${CYAN}http://localhost:8899${NC}"
echo -e "  Program ID: ${CYAN}${PROGRAM_ID}${NC}"
echo -e "  Wallet:     ${CYAN}${WALLET_ADDR}${NC}"
echo ""
echo -e "  ${YELLOW}Select \"local\" cluster in the app header dropdown.${NC}"
echo -e "  ${YELLOW}Press Ctrl+C to stop all services.${NC}"
echo ""

# Keep script alive until interrupted
wait
