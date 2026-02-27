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

for cmd in solana solana-test-validator anchor npm spl-token; do
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

USDC_MINT_KEYPAIR="anchor/keys/usdc-mint-address.json"
if [[ ! -f "$USDC_MINT_KEYPAIR" ]]; then
  MISSING+=("USDC mint keypair not found at $USDC_MINT_KEYPAIR")
fi

USDC_AUTHORITY_KEYPAIR="anchor/keys/usdc-mint-authority.json"
if [[ ! -f "$USDC_AUTHORITY_KEYPAIR" ]]; then
  MISSING+=("USDC mint authority keypair not found at $USDC_AUTHORITY_KEYPAIR")
fi

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo -e "${RED}Missing prerequisites:${NC}"
  for item in "${MISSING[@]}"; do
    echo -e "  - $item"
  done
  exit 1
fi
echo -e "${GREEN}  All prerequisites met.${NC}"

# ── Build Anchor program with testing feature ───────────────────────
echo -e "${BOLD}Building Anchor program with --features testing...${NC}"
(cd anchor && anchor build -- --features testing)
echo -e "${GREEN}  Build complete.${NC}"

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
solana config set --url http://localhost:8899 >/dev/null 2>&1
solana airdrop 5 --url http://localhost:8899 >/dev/null

# Also airdrop to the USDC mint authority (needs SOL for creating accounts)
USDC_AUTHORITY_PUBKEY=$(solana-keygen pubkey "$USDC_AUTHORITY_KEYPAIR")
solana airdrop 2 "$USDC_AUTHORITY_PUBKEY" --url http://localhost:8899 >/dev/null 2>&1 || true

echo -e "${GREEN}  Airdropped SOL to admin and USDC authority.${NC}"

# ── Deploy program ──────────────────────────────────────────────────
echo -e "${BOLD}Deploying program...${NC}"
solana program deploy \
  --url http://localhost:8899 \
  --keypair "$WALLET" \
  --program-id anchor/target/deploy/clearance-keypair.json \
  anchor/target/deploy/clearance.so
echo -e "${GREEN}  Program deployed.${NC}"

# ── Create USDC mint on localnet ────────────────────────────────────
echo -e "${BOLD}Creating USDC mint on localnet...${NC}"
USDC_MINT_ADDRESS=$(solana-keygen pubkey "$USDC_MINT_KEYPAIR")

# Create token with the deterministic keypair so the address is predictable
spl-token create-token \
  --url http://localhost:8899 \
  --mint-authority "$USDC_AUTHORITY_KEYPAIR" \
  --decimals 6 \
  "$USDC_MINT_KEYPAIR" \
  --fee-payer "$WALLET" \
  2>/dev/null || echo -e "  ${YELLOW}(USDC mint may already exist, continuing)${NC}"

echo -e "${GREEN}  USDC Mint: ${USDC_MINT_ADDRESS}${NC}"

# ── Mint initial USDC to admin wallet(s) ────────────────────────────
echo -e "${BOLD}Minting USDC to admin wallet(s)...${NC}"
DEPLOYER_PUBKEY=$(solana-keygen pubkey "$WALLET")

# Helper: ensure a wallet has a USDC token account and is funded
fund_usdc_wallet() {
  local OWNER_PUBKEY="$1"
  local LABEL="$2"
  local AMOUNT="${3:-1000}"

  # Create ATA for the owner (idempotent)
  spl-token create-account \
    --url http://localhost:8899 \
    --fee-payer "$WALLET" \
    --owner "$OWNER_PUBKEY" \
    "$USDC_MINT_ADDRESS" \
    2>/dev/null || true

  # Mint tokens — default recipient is the fee payer's (deployer's) ATA
  spl-token mint \
    --url http://localhost:8899 \
    --mint-authority "$USDC_AUTHORITY_KEYPAIR" \
    --fee-payer "$WALLET" \
    "$USDC_MINT_ADDRESS" "$AMOUNT" \
    2>/dev/null

  if [[ "$OWNER_PUBKEY" != "$DEPLOYER_PUBKEY" ]]; then
    # Transfer from deployer's ATA to the target wallet's ATA
    spl-token transfer \
      --url http://localhost:8899 \
      --owner "$WALLET" \
      --fee-payer "$WALLET" \
      --fund-recipient \
      --allow-unfunded-recipient \
      "$USDC_MINT_ADDRESS" "$AMOUNT" "$OWNER_PUBKEY" \
      2>/dev/null || true
  fi

  echo -e "${GREEN}  Minted ${AMOUNT} USDC to ${LABEL} (${OWNER_PUBKEY}).${NC}"
}

# Fund deployer wallet
fund_usdc_wallet "$DEPLOYER_PUBKEY" "deployer"

# Fund USDC mint authority (used as vault admin by setup-demo + Next.js)
if [[ "$USDC_AUTHORITY_PUBKEY" != "$DEPLOYER_PUBKEY" ]]; then
  solana airdrop 2 "$USDC_AUTHORITY_PUBKEY" --url http://localhost:8899 >/dev/null 2>&1 || true
  fund_usdc_wallet "$USDC_AUTHORITY_PUBKEY" "USDC authority"
fi

# If .env.local has a different vault admin, also fund it
VAULT_ADMIN_PUBKEY=""
if [[ -f ".env.local" ]]; then
  MINT_AUTH_KEY=$(grep '^SOLANA_MINT_AUTHORITY_SECRET_KEY=' .env.local | sed 's/^[^=]*=//' | tr -d '"')
  if [[ -n "$MINT_AUTH_KEY" ]]; then
    VAULT_ADMIN_PUBKEY=$(node -e "
      const { Keypair } = require('@solana/web3.js');
      const secret = JSON.parse('${MINT_AUTH_KEY}');
      console.log(Keypair.fromSecretKey(Uint8Array.from(secret)).publicKey.toBase58());
    " 2>/dev/null || echo "")
  fi
fi
if [[ -n "$VAULT_ADMIN_PUBKEY" && "$VAULT_ADMIN_PUBKEY" != "$DEPLOYER_PUBKEY" && "$VAULT_ADMIN_PUBKEY" != "$USDC_AUTHORITY_PUBKEY" ]]; then
  solana airdrop 5 "$VAULT_ADMIN_PUBKEY" --url http://localhost:8899 >/dev/null 2>&1 || true
  fund_usdc_wallet "$VAULT_ADMIN_PUBKEY" ".env.local vault admin"
fi

ADMIN_PUBKEY="$USDC_AUTHORITY_PUBKEY"

# Read the mint authority secret key from the keypair file (used for setup-demo + Next.js)
MINT_AUTH_SECRET="$(cat "$USDC_AUTHORITY_KEYPAIR")"

# Read DATABASE_URL from .env.local (dotenv/config only loads .env, which has the Prisma Accelerate URL)
LOCAL_DB_URL=""
if [[ -f ".env.local" ]]; then
  LOCAL_DB_URL=$(grep '^DATABASE_URL=' .env.local | sed 's/^[^=]*=//' | tr -d '"')
fi
if [[ -z "$LOCAL_DB_URL" ]]; then
  echo -e "${RED}  DATABASE_URL not found in .env.local${NC}"
  exit 1
fi

# ── Prisma DB sync ─────────────────────────────────────────────────
echo -e "${BOLD}Syncing Prisma schema...${NC}"
npx prisma db push --url "$LOCAL_DB_URL" || echo -e "  ${YELLOW}Prisma sync failed (check DATABASE_URL)${NC}"
echo -e "${GREEN}  Database ready.${NC}"

# ── Bootstrap demo session ─────────────────────────────────────────
echo -e "${BOLD}Bootstrapping demo session...${NC}"
DATABASE_URL="$LOCAL_DB_URL" \
  SOLANA_MINT_AUTHORITY_SECRET_KEY="$MINT_AUTH_SECRET" \
  USDC_MINT_ADDRESS="$USDC_MINT_ADDRESS" \
  NEXT_PUBLIC_SOLANA_RPC_URL=http://localhost:8899 \
  VRF_TESTING_MODE=true \
  npx tsx scripts/setup-demo.ts
echo -e "${GREEN}  Demo session bootstrapped.${NC}"

# ── Start Next.js dev server ────────────────────────────────────────
echo -e "${BOLD}Starting Next.js dev server...${NC}"
SOLANA_MINT_AUTHORITY_SECRET_KEY="$MINT_AUTH_SECRET" \
  NEXT_PUBLIC_SOLANA_RPC_URL=http://localhost:8899 \
  USDC_MINT_ADDRESS="$USDC_MINT_ADDRESS" \
  VRF_TESTING_MODE=true \
  npm run dev &
NEXTJS_PID=$!

# ── Summary ─────────────────────────────────────────────────────────
PROGRAM_ID=$(solana-keygen pubkey anchor/target/deploy/clearance-keypair.json 2>/dev/null || echo "unknown")

echo ""
echo -e "${BOLD}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Clearance local dev environment is running!${NC}"
echo -e "${BOLD}════════════════════════════════════════════════${NC}"
echo -e "  App:          ${CYAN}http://localhost:3000${NC}"
echo -e "  RPC:          ${CYAN}http://localhost:8899${NC}"
echo -e "  Program ID:   ${CYAN}${PROGRAM_ID}${NC}"
echo -e "  Admin Wallet: ${CYAN}${ADMIN_PUBKEY}${NC}"
echo -e "  USDC Mint:    ${CYAN}${USDC_MINT_ADDRESS}${NC}"
echo -e "  VRF Mode:     ${CYAN}testing (auto-resolve)${NC}"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo -e "    1. Select \"local\" cluster in the app header dropdown"
echo -e "    2. Press Ctrl+C to stop all services"
echo ""

# Keep script alive until interrupted
wait
