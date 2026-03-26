/**
 * setup-mint.ts
 *
 * Creates a persistent devnet USDC-style SPL token mint using the
 * SOLANA_MINT_AUTHORITY_SECRET_KEY from .env.local.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/setup-mint.ts
 *
 * On success it prints the mint address and appends it to .env.local as
 *   NEXT_PUBLIC_USDC_MINT=<address>
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
config()

import fs from 'fs'
import path from 'path'
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token'

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL
if (!RPC_URL) throw new Error('Missing env: NEXT_PUBLIC_SOLANA_RPC_URL')

const INITIAL_SUPPLY = 1_000_000 // 1 M tokens (6 decimals → 1_000_000_000_000 raw)
const DECIMALS = 6

function getAdminKeypair(): Keypair {
  const secret = process.env.SOLANA_MINT_AUTHORITY_SECRET_KEY
  if (!secret) throw new Error('SOLANA_MINT_AUTHORITY_SECRET_KEY not set')
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)))
}

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed')
  const admin = getAdminKeypair()

  console.log('\n  Spotr TV — Devnet Mint Setup')
  console.log('  ════════════════════════════════════════')
  console.log(`  RPC     : ${RPC_URL}`)
  console.log(`  Authority: ${admin.publicKey.toBase58()}\n`)

  // Check balance
  const balance = await connection.getBalance(admin.publicKey)
  console.log(`  SOL balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)}`)
  if (balance < 0.05 * LAMPORTS_PER_SOL) {
    throw new Error(
      'Insufficient SOL. Run: solana airdrop 1 ' +
      admin.publicKey.toBase58() +
      ' --url devnet'
    )
  }

  // Create the mint
  console.log('\n  Creating mint...')
  const mint = await createMint(
    connection,
    admin,           // payer
    admin.publicKey, // mint authority
    null,            // freeze authority (none)
    DECIMALS,
  )
  console.log(`  ✓ Mint address : ${mint.toBase58()}`)

  // Create authority ATA and mint initial supply
  console.log(`\n  Minting ${INITIAL_SUPPLY.toLocaleString()} tokens to authority...`)
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    admin,
    mint,
    admin.publicKey,
  )
  await mintTo(
    connection,
    admin,
    mint,
    ata.address,
    admin,
    BigInt(INITIAL_SUPPLY) * BigInt(10 ** DECIMALS),
  )
  console.log(`  ✓ ATA          : ${ata.address.toBase58()}`)
  console.log(`  ✓ Supply minted: ${INITIAL_SUPPLY.toLocaleString()} tokens`)

  // Append to .env.local
  const envPath = path.resolve(process.cwd(), '.env.local')
  const envContents = fs.readFileSync(envPath, 'utf8')

  if (envContents.includes('USDC_MINT_ADDRESS=')) {
    console.log('\n  ⚠  USDC_MINT_ADDRESS already set in .env.local — skipping write')
    console.log(`     Update it manually if you want to use this new mint:`)
    console.log(`     USDC_MINT_ADDRESS=${mint.toBase58()}`)
  } else {
    fs.appendFileSync(envPath, `\nUSDC_MINT_ADDRESS=${mint.toBase58()}\n`)
    console.log(`\n  ✓ Appended USDC_MINT_ADDRESS to .env.local`)
  }

  console.log('\n  ════════════════════════════════════════')
  console.log(`  Mint ready: ${mint.toBase58()}`)
  console.log(`  Explorer  : https://explorer.solana.com/address/${mint.toBase58()}?cluster=devnet`)
  console.log()
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('\n  FAILED:', e.message ?? e)
    process.exit(1)
  })
