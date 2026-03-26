/**
 * Spotr TV Boss Demo — Multi-Fan Raffle Smoke Test
 *
 * Runs the full raffle lifecycle with NUM_FANS fans going in simultaneously.
 * Works on both devnet (real VRF oracle) and localnet (simulated VRF callbacks).
 *
 * Usage:
 *   npm run smoke:devnet                  — 10 fans, real VRF on devnet
 *   npm run smoke:localnet                — 10 fans, simulated VRF on localnet
 *   NUM_FANS=5 npm run smoke:devnet       — custom fan count
 *
 * Env vars:
 *   CLUSTER                              "devnet" | "localnet" (default: devnet)
 *   NUM_FANS                             concurrent fans (default: 10)
 *   DEVNET_RPC_URL                       override devnet RPC endpoint
 *   SOLANA_MINT_AUTHORITY_SECRET_KEY     admin keypair JSON array
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
config()

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import {
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { AnchorProvider, BN } from '@coral-xyz/anchor'
import NodeWallet from '@coral-xyz/anchor/dist/esm/nodewallet'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { create, mplCore } from '@metaplex-foundation/mpl-core'
import {
  generateSigner,
  createSignerFromKeypair,
  signerIdentity,
  publicKey as toUmiPublicKey,
} from '@metaplex-foundation/umi'
import {
  getSpotrProgram,
  getVaultAddress,
  getRaffleRecordAddress,
  getFanDepositRecordAddress,
  buildInitializeVaultTransaction,
  buildAdminDepositTransaction,
  buildRequestRaffleTransaction,
  buildClaimWithRaffleTransaction,
  buildCallbackRaffleTransaction,
  fetchRaffleRecord,
} from '../anchor/src/spotr-exports'

// ── Config ────────────────────────────────────────────────────────────────────

const CLUSTER = process.env.CLUSTER!
if (!CLUSTER) throw new Error('Missing env: CLUSTER')
const IS_DEVNET  = CLUSTER === 'devnet'

const RPC_URL_RAW = IS_DEVNET
  ? (process.env.DEVNET_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL)
  : process.env.LOCALNET_RPC_URL
if (!RPC_URL_RAW) throw new Error(`Missing env: ${IS_DEVNET ? 'DEVNET_RPC_URL or NEXT_PUBLIC_SOLANA_RPC_URL' : 'LOCALNET_RPC_URL'}`)
const RPC_URL = RPC_URL_RAW

const NUM_FANS_RAW = process.env.NUM_FANS
if (!NUM_FANS_RAW) throw new Error('Missing env: NUM_FANS')
const NUM_FANS = parseInt(NUM_FANS_RAW, 10)
const SESSION_ID     = Math.floor(Date.now() / 1000)
const VAULT_DEPOSIT  = NUM_FANS * 20        // generous pool
const FAN_MINT       = 10                   // tokens given to each fan
const ENTRY_FEE      = 3.5                  // entry fee per fan
const BATCH_SIZE     = 5                    // fan-signed tx concurrency
const VRF_POLL_MS    = 3_000
const VRF_TIMEOUT_MS = 90_000

// Mix of tiers across fans so the demo shows all three payout brackets
const TIERS = Array.from({ length: NUM_FANS }, (_, i) => i % 3) as (0 | 1 | 2)[]
const TIER_NAME  = ['participation', 'base    ', 'gold    ']
const TIER_EMOJI = ['🥉', '🥈', '🥇']

// ── Helpers ───────────────────────────────────────────────────────────────────

const connection = new Connection(RPC_URL, 'confirmed')

function getAdminKeypair(): Keypair {
  const secret = process.env.SOLANA_MINT_AUTHORITY_SECRET_KEY
  if (!secret) throw new Error('SOLANA_MINT_AUTHORITY_SECRET_KEY not set')
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)))
}

function getProgram(admin: Keypair) {
  const provider = new AnchorProvider(connection, new NodeWallet(admin), { commitment: 'confirmed' })
  return getSpotrProgram(provider)
}

function getUmi(admin: Keypair) {
  const umi = createUmi(RPC_URL, 'confirmed').use(mplCore())
  const kp  = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(admin.secretKey))
  umi.use(signerIdentity(createSignerFromKeypair(umi, kp), true))
  return umi
}

/** Send a transaction, skip simulation (saves 1 RPC round-trip per tx). */
async function send(tx: Transaction, ...signers: Keypair[]): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  tx.recentBlockhash = tx.recentBlockhash ?? blockhash
  tx.feePayer = tx.feePayer ?? signers[0].publicKey
  tx.sign(...signers)
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true })
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
  return sig
}

/** Send pre-signed (partially signed) transaction. */
async function sendSigned(tx: Transaction): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  if (!tx.recentBlockhash) tx.recentBlockhash = blockhash
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true })
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
  return sig
}

/** Process items in parallel batches, returns results in original order. */
async function inBatches<T, R>(
  items: T[],
  size: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = []
  for (let i = 0; i < items.length; i += size) {
    const batch  = items.slice(i, i + size)
    const settled = await Promise.allSettled(batch.map((item, j) => fn(item, i + j)))
    out.push(...settled)
  }
  return out
}

function pad(s: string | number, n: number) { return String(s).padEnd(n) }
function short(sig: string) { return sig.slice(0, 20) + '...' }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const W   = 68
  const bar = '═'.repeat(W)
  const div = '─'.repeat(W)

  console.log(`\n  ${bar}`)
  console.log(`  Spotr TV Boss Demo  ·  ${NUM_FANS} Fans  ·  ${CLUSTER.toUpperCase()}`)
  console.log(`  ${bar}\n`)
  console.log(`  RPC      : ${RPC_URL}`)
  console.log(`  Admin    : ${(getAdminKeypair()).publicKey.toBase58()}`)
  console.log(`  Session  : ${SESSION_ID}`)
  console.log(`  Fans     : ${NUM_FANS}  |  Pool: ${VAULT_DEPOSIT} tokens\n`)

  const admin   = getAdminKeypair()
  const program = getProgram(admin)
  const umi     = getUmi(admin)

  const balance = await connection.getBalance(admin.publicKey)
  if (balance < 0.3 * LAMPORTS_PER_SOL)
    throw new Error(`Admin only has ${(balance / LAMPORTS_PER_SOL).toFixed(3)} SOL — needs at least 0.3`)
  console.log(`  ✓ Admin balance: ${(balance / LAMPORTS_PER_SOL).toFixed(3)} SOL`)

  // ── 1. Token mint ─────────────────────────────────────────────────────────

  console.log(`\n  ── 1 / 7  Create Token Mint ──────────────────────────────\n`)

  const usdcMint = await createMint(connection, admin, admin.publicKey, null, 6)
  console.log(`  ✓ Mint: ${usdcMint.toBase58()}`)

  // Admin ATA + initial supply in one shot
  const adminAta    = getAssociatedTokenAddressSync(usdcMint, admin.publicKey)
  const totalSupply = (VAULT_DEPOSIT + NUM_FANS * FAN_MINT) * 1_000_000
  const supplyTx    = new Transaction()
    .add(createAssociatedTokenAccountInstruction(admin.publicKey, adminAta, admin.publicKey, usdcMint))
    .add(createMintToInstruction(usdcMint, adminAta, admin.publicKey, totalSupply))
  await send(supplyTx, admin)
  console.log(`  ✓ Minted ${VAULT_DEPOSIT + NUM_FANS * FAN_MINT} tokens to admin`)

  // ── 2. Vault ──────────────────────────────────────────────────────────────

  console.log(`\n  ── 2 / 7  Initialize Vault ───────────────────────────────\n`)

  const { vaultPda } = await buildInitializeVaultTransaction({
    connection, program, admin, sessionId: SESSION_ID, usdcMint,
  })
  console.log(`  ✓ Vault PDA : ${vaultPda.toBase58()}`)

  await buildAdminDepositTransaction({
    connection, program, admin, sessionId: SESSION_ID, usdcMint,
    amount: VAULT_DEPOSIT * 1_000_000,
  })
  console.log(`  ✓ Deposited ${VAULT_DEPOSIT} tokens into vault`)

  // ── 3. Fan setup (bulk transactions — minimal RPC calls) ─────────────────

  console.log(`\n  ── 3 / 7  Setup ${NUM_FANS} Fans ──────────────────────────────────\n`)

  const fans    = Array.from({ length: NUM_FANS }, () => Keypair.generate())
  const fanAtas = fans.map(fan => getAssociatedTokenAddressSync(usdcMint, fan.publicKey))

  // 3a. Fund ALL fans in a single transaction
  const fundTx = new Transaction()
  for (const fan of fans) {
    fundTx.add(SystemProgram.transfer({
      fromPubkey: admin.publicKey,
      toPubkey  : fan.publicKey,
      lamports  : 0.02 * LAMPORTS_PER_SOL,
    }))
  }
  await send(fundTx, admin)
  console.log(`  ✓ All ${NUM_FANS} fans funded (1 transaction)`)

  // 3b. Create all fan ATAs in batches of 5 per tx (instruction-level batching)
  const ATA_BATCH = 5
  for (let i = 0; i < NUM_FANS; i += ATA_BATCH) {
    const slice = fans.slice(i, i + ATA_BATCH)
    const tx = new Transaction()
    slice.forEach((fan, j) => tx.add(
      createAssociatedTokenAccountInstruction(
        admin.publicKey, fanAtas[i + j], fan.publicKey, usdcMint,
      ),
    ))
    await send(tx, admin)
    console.log(`  ✓ Fan ATAs ${i + 1}–${Math.min(i + ATA_BATCH, NUM_FANS)} created`)
  }

  // 3c. Mint tokens to all fans in batches of 5 per tx
  for (let i = 0; i < NUM_FANS; i += ATA_BATCH) {
    const tx = new Transaction()
    fans.slice(i, i + ATA_BATCH).forEach((_, j) => tx.add(
      createMintToInstruction(usdcMint, fanAtas[i + j], admin.publicKey, FAN_MINT * 1_000_000),
    ))
    await send(tx, admin)
    console.log(`  ✓ Minted ${FAN_MINT} tokens to fans ${i + 1}–${Math.min(i + ATA_BATCH, NUM_FANS)}`)
  }

  // 3d. Fan deposits — each fan signs their own tx, send in parallel batches
  const [vaultPdaCheck] = getVaultAddress(SESSION_ID)
  const { blockhash: depositBlockhash } = await connection.getLatestBlockhash()

  const fanDepositSigs = new Array<string>(NUM_FANS)
  await inBatches(fans, BATCH_SIZE, async (fan, i) => {
    const [depositRecordPda] = getFanDepositRecordAddress(vaultPdaCheck, fan.publicKey)
    const vaultAta = getAssociatedTokenAddressSync(usdcMint, vaultPdaCheck, true)

    const ix = await program.methods
      .fanDeposit(new BN(Math.round(ENTRY_FEE * 1_000_000)))
      .accountsPartial({
        fan              : fan.publicKey,
        vault            : vaultPdaCheck,
        depositRecord    : depositRecordPda,
        fanTokenAccount  : fanAtas[i],
        vaultTokenAccount: vaultAta,
        tokenProgram     : TOKEN_PROGRAM_ID,
        systemProgram    : SystemProgram.programId,
      })
      .instruction()

    const tx = new Transaction({ recentBlockhash: depositBlockhash, feePayer: fan.publicKey }).add(ix)
    tx.sign(fan)
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true })
    await connection.confirmTransaction(sig, 'confirmed')
    fanDepositSigs[i] = sig
    console.log(`  ✓ Fan ${String(i + 1).padStart(2)} deposited ${ENTRY_FEE} tokens`)
  })

  // ── 4. Mint NFTs ──────────────────────────────────────────────────────────

  console.log(`\n  ── 4 / 7  Mint ${NUM_FANS} NFTs (parallel batches) ──────────────\n`)

  const nftAssets = new Array<PublicKey>(NUM_FANS)
  await inBatches(fans, BATCH_SIZE, async (fan, i) => {
    const asset = generateSigner(umi)
    await create(umi, {
      asset,
      name            : `Spotr TV Blind Box #${i + 1}`,
      uri             : `https://spotr.tv/metadata/${SESSION_ID}-fan${i + 1}.json`,
      owner           : toUmiPublicKey(fan.publicKey.toBase58()),
      updateAuthority : toUmiPublicKey(admin.publicKey.toBase58()),
    }).sendAndConfirm(umi)
    nftAssets[i] = new PublicKey(asset.publicKey.toString())
    console.log(`  ✓ Fan ${String(i + 1).padStart(2)} NFT: ${nftAssets[i].toBase58().slice(0, 20)}...`)
  })

  // ── 5. Request raffle ─────────────────────────────────────────────────────

  console.log(`\n  ── 5 / 7  Request Raffle × ${NUM_FANS} ──────────────────────────────\n`)

  // Get ONE shared blockhash for all 10 txs — inject it so admin signs with it too
  const { blockhash: raffleBlockhash } = await connection.getLatestBlockhash()

  // Build all 10 txs concurrently, all sharing the same blockhash (1 RPC call total)
  const raffleTxs = await Promise.all(fans.map(async (fan, i) => {
    const tx = await buildRequestRaffleTransaction({
      connection, program, admin, fanPublicKey: fan.publicKey,
      sessionId: SESSION_ID, tier: TIERS[i],
      blockhash: raffleBlockhash,
    })
    tx.partialSign(fan)
    return tx
  }))

  // Fire ALL txs at once — no per-tx confirmTransaction (the VRF callback proves landing)
  const raffleSigs = await Promise.all(raffleTxs.map(async (tx, i) => {
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true })
    console.log(`  ✓ Fan ${String(i + 1).padStart(2)} request_raffle  ${TIER_EMOJI[TIERS[i]]} ${TIER_NAME[TIERS[i]]}  ${short(sig)}`)
    return sig
  }))
  console.log(`\n  Submitted ${NUM_FANS} txs — oracle picks them up on-chain`)

  // ── 6. VRF resolution ─────────────────────────────────────────────────────

  // Pre-derive all raffle record PDAs (needed in both step 6 and step 7)
  const rafflePdas = fans.map(fan => getRaffleRecordAddress(vaultPda, fan.publicKey)[0])

  if (IS_DEVNET) {
    console.log(`\n  ── 6 / 7  Waiting for VRF Oracle (${VRF_TIMEOUT_MS / 1000}s timeout) ───────\n`)
    console.log(`  MagicBlock oracle picks up ${NUM_FANS} requests and fires callbacks...\n`)

    const resolved = new Set<number>()
    const deadline = Date.now() + VRF_TIMEOUT_MS

    while (resolved.size < NUM_FANS && Date.now() < deadline) {
      // ONE batched getMultipleAccountsInfo call instead of N individual getAccountInfo calls
      let accountInfos: (import('@solana/web3.js').AccountInfo<Buffer> | null)[] = []
      try {
        accountInfos = await connection.getMultipleAccountsInfo(rafflePdas)
      } catch {
        // Rate-limited — back off and retry next cycle
        await new Promise(r => setTimeout(r, 5_000))
        continue
      }

      for (let i = 0; i < NUM_FANS; i++) {
        if (resolved.has(i)) continue
        const info = accountInfos[i]
        if (!info) continue
        try {
          const decoded = program.coder.accounts.decode('raffleRecord', info.data)
          if (decoded.resolved) {
            resolved.add(i)
            console.log(`  ✓ Fan ${String(i + 1).padStart(2)} resolved  reward = ${(decoded.rewardAmount.toNumber() / 1_000_000).toFixed(2)} tokens`)
          }
        } catch { /* account not yet initialized */ }
      }

      if (resolved.size < NUM_FANS) await new Promise(r => setTimeout(r, VRF_POLL_MS))
    }

    const pending = Array.from({ length: NUM_FANS }, (_, i) => i).filter(i => !resolved.has(i))
    if (pending.length > 0) {
      console.log(`\n  ⚠  ${pending.length} fan(s) not yet resolved: ${pending.map(i => i + 1).join(', ')}`)
    } else {
      console.log(`\n  ✓ All ${NUM_FANS} raffles resolved by oracle!`)
    }

  } else {
    // Localnet: admin fires the callback (requires --features testing build)
    console.log(`\n  ── 6 / 7  Simulate VRF Callbacks (localnet) ──────────────\n`)

    await inBatches(fans, BATCH_SIZE, async (fan, i) => {
      const randomness = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))
      await buildCallbackRaffleTransaction({
        connection, program, admin,
        fanPublicKey: fan.publicKey, sessionId: SESSION_ID, randomness,
      })
      const rec = await fetchRaffleRecord(program, vaultPda, fan.publicKey)
      console.log(`  ✓ Fan ${String(i + 1).padStart(2)} VRF simulated  reward = ${((rec?.rewardAmount ?? 0) / 1_000_000).toFixed(2)} tokens`)
    })
  }

  // ── 7. Claim ──────────────────────────────────────────────────────────────

  console.log(`\n  ── 7 / 7  Claim × ${NUM_FANS} ────────────────────────────────────────\n`)

  type FanResult = { fan: number; tier: 0|1|2; reward: number; balance: number; claimTx: string }
  const results = new Array<FanResult | null>(NUM_FANS).fill(null)

  // Fetch all resolved raffle records in ONE batched RPC call
  const claimAccountInfos = await connection.getMultipleAccountsInfo(rafflePdas)
  const resolvedRecords = claimAccountInfos.map((info, i) => {
    if (!info) return null
    try {
      const d = program.coder.accounts.decode('raffleRecord', info.data)
      return d.resolved ? { rewardAmount: (d.rewardAmount as { toNumber(): number }).toNumber(), fanIdx: i } : null
    } catch { return null }
  })

  const { blockhash: claimBlockhash, lastValidBlockHeight: claimLastValid } = await connection.getLatestBlockhash()

  // Build all claim txs for resolved fans, injecting shared blockhash before admin signs
  const claimBuilds = await Promise.all(fans.map(async (fan, i) => {
    const rec = resolvedRecords[i]
    if (!rec) return null
    const tx = await buildClaimWithRaffleTransaction({
      connection, program, admin, fanPublicKey: fan.publicKey,
      sessionId: SESSION_ID, nftAsset: nftAssets[i], usdcMint,
      blockhash: claimBlockhash,
    })
    tx.partialSign(fan)
    return { tx, reward: rec.rewardAmount, i }
  }))

  const claimSigs = await Promise.all(claimBuilds.map(async build => {
    if (!build) return null
    const sig = await connection.sendRawTransaction(build.tx.serialize(), { skipPreflight: true })
    return { sig, ...build }
  }))

  // Wait for all claim txs to confirm (batched, with shared blockhash)
  await Promise.allSettled(claimSigs.map(async item => {
    if (!item) return
    const { sig, reward, i } = item
    try {
      await connection.confirmTransaction(
        { signature: sig, blockhash: claimBlockhash, lastValidBlockHeight: claimLastValid },
        'confirmed',
      )
      const ataInfo = await getAccount(connection, fanAtas[i])
      const balance = Number(ataInfo.amount) / 1_000_000
      results[i] = { fan: i + 1, tier: TIERS[i], reward: reward / 1_000_000, balance, claimTx: sig }
      console.log(`  ✓ Fan ${String(i + 1).padStart(2)} claimed  reward=${(reward / 1_000_000).toFixed(2)}  balance=${balance.toFixed(2)}  ${short(sig)}`)
    } catch {
      console.log(`  ⚠ Fan ${String(i + 1).padStart(2)} claim tx submitted but confirm timed out (tx may still land)`)
      results[i] = { fan: i + 1, tier: TIERS[i], reward: reward / 1_000_000, balance: 0, claimTx: sig }
    }
  }))

  // ── Summary ───────────────────────────────────────────────────────────────

  const successful = results.filter(Boolean) as FanResult[]
  const totalRewarded = successful.reduce((s, r) => s + r.reward, 0)

  console.log(`\n  ${bar}`)
  console.log(`  RESULTS — ${successful.length} / ${NUM_FANS} fans claimed`)
  console.log(`  ${bar}\n`)
  console.log(`  ${pad('Fan', 7)}${pad('Tier', 17)}${pad('Reward', 10)}${pad('Balance', 10)}Claim Tx`)
  console.log(`  ${div}`)

  for (const r of successful) {
    console.log(
      `  ${pad(`Fan ${r.fan}`, 7)}` +
      `${TIER_EMOJI[r.tier]} ${pad(TIER_NAME[r.tier], 14)}` +
      `${pad(r.reward.toFixed(2), 10)}` +
      `${pad(r.balance.toFixed(2), 10)}` +
      short(r.claimTx),
    )
  }

  if (IS_DEVNET && successful.length > 0) {
    console.log(`\n  Explorer links (devnet):`)
    for (const r of successful) {
      console.log(`    Fan ${String(r.fan).padStart(2)}: https://explorer.solana.com/tx/${r.claimTx}?cluster=devnet`)
    }
  }

  console.log(`\n  Total rewarded : ${totalRewarded.toFixed(2)} tokens`)
  console.log(`  Pool used      : ${((totalRewarded / VAULT_DEPOSIT) * 100).toFixed(1)}%`)
  console.log()
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('\n  Demo FAILED:', e)
    process.exit(1)
  })
