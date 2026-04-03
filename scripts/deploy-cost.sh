#!/usr/bin/env bash
# Estimates deployment cost for the Anchor program.
# Uses the Solana rent formula: (data_len + 128) * 3480 * 2 lamports
# Outputs everything in SOL.

set -e

# Resolve paths relative to the repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PROGRAM_SO="$REPO_ROOT/anchor/target/deploy/spotrtv.so"
IDL_JSON="$REPO_ROOT/anchor/target/idl/spotrtv.json"

# Constants (Solana rent parameters)
LAMPORTS_PER_BYTE_YEAR=3480
YEARS=2
ACCOUNT_OVERHEAD=128
LAMPORTS_PER_SOL=1000000000
TX_FEE_LAMPORTS=5000
AVG_CHUNK_BYTES=1024   # Approximate bytes written per chunk tx during deploy

# Helper: compute rent in SOL for a given data length
# Usage: rent_sol <bytes>
rent_sol() {
  local bytes=$1
  local lamports=$(( (bytes + ACCOUNT_OVERHEAD) * LAMPORTS_PER_BYTE_YEAR * YEARS ))
  # Print as SOL with 8 decimals
  awk -v l="$lamports" -v d="$LAMPORTS_PER_SOL" 'BEGIN { printf "%.8f", l / d }'
}

# Helper: add two decimal values with 8 decimals
add_sol() {
  awk -v a="$1" -v b="$2" 'BEGIN { printf "%.8f", a + b }'
}

# Helper: pretty-print a row
row() {
  printf "  %-32s %15s SOL\n" "$1" "$2"
}

# Check program .so exists
if [ ! -f "$PROGRAM_SO" ]; then
  echo "Error: program binary not found at $PROGRAM_SO"
  echo "Run 'npm run anchor-build' first."
  exit 1
fi

# Measure sizes
PROGRAM_BYTES=$(wc -c < "$PROGRAM_SO" | tr -d ' ')
PROGRAM_KB=$(awk -v b="$PROGRAM_BYTES" 'BEGIN { printf "%.1f", b/1024 }')

if [ -f "$IDL_JSON" ]; then
  IDL_BYTES=$(wc -c < "$IDL_JSON" | tr -d ' ')
else
  IDL_BYTES=0
fi

# Fixed sizes for related accounts
PROGRAM_ACCOUNT_BYTES=36   # BPF upgradeable program account
PROGRAMDATA_HEADER=45      # ProgramData account adds 45-byte header
PROGRAMDATA_BYTES=$(( PROGRAM_BYTES + PROGRAMDATA_HEADER ))

# Compute rents
RENT_PROGRAMDATA=$(rent_sol "$PROGRAMDATA_BYTES")
RENT_PROGRAM_ACCOUNT=$(rent_sol "$PROGRAM_ACCOUNT_BYTES")
RENT_IDL=$(rent_sol "$IDL_BYTES")

# Estimate tx fees for chunked upload
NUM_CHUNKS=$(( (PROGRAM_BYTES + AVG_CHUNK_BYTES - 1) / AVG_CHUNK_BYTES ))
TX_FEES_LAMPORTS=$(( NUM_CHUNKS * TX_FEE_LAMPORTS ))
TX_FEES_SOL=$(awk -v l="$TX_FEES_LAMPORTS" -v d="$LAMPORTS_PER_SOL" 'BEGIN { printf "%.8f", l / d }')

# Total
TOTAL=$(add_sol "$RENT_PROGRAMDATA" "$RENT_PROGRAM_ACCOUNT")
TOTAL=$(add_sol "$TOTAL" "$RENT_IDL")
TOTAL=$(add_sol "$TOTAL" "$TX_FEES_SOL")

# Output
echo ""
echo "Program:    $PROGRAM_SO"
echo "Binary:     $PROGRAM_BYTES bytes ($PROGRAM_KB KB)"
echo "IDL:        $IDL_BYTES bytes"
echo ""
echo "Rent formula: (data_len + 128) * 3480 * 2 lamports"
echo ""
echo "Deployment costs (fresh deploy, rent-exempt, recoverable on close):"
echo ""
row "ProgramData ($PROGRAMDATA_BYTES bytes)" "$RENT_PROGRAMDATA"
row "Program account (36 bytes)" "$RENT_PROGRAM_ACCOUNT"
row "IDL account ($IDL_BYTES bytes)" "$RENT_IDL"
row "Tx fees (~$NUM_CHUNKS chunks)" "$TX_FEES_SOL"
echo "  ---------------------------------------------------"
row "TOTAL" "$TOTAL"
echo ""
echo "Notes:"
echo "  - Rent (program + IDL) is a refundable deposit, not a permanent cost."
echo "  - You reclaim it with: solana program close <PROGRAM_ID>"
echo "  - Upgrades only cost tx fees (~$TX_FEES_SOL SOL) if the binary stays the same size."
echo "  - Use 'anchor deploy -- --max-len <bytes>' to reserve extra space for growth."
echo ""
