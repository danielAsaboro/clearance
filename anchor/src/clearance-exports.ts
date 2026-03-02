import { AnchorProvider, Program, BN } from '@coral-xyz/anchor'
import {
  Cluster,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  SYSVAR_SLOT_HASHES_PUBKEY,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import ClearanceIDL from '../target/idl/clearance.json'
import type { Clearance } from '../target/types/clearance'

export { Clearance, ClearanceIDL }

export const CLEARANCE_PROGRAM_ID = new PublicKey(ClearanceIDL.address)

const VRF_PROGRAM_ID = new PublicKey('Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz')
const VRF_DEFAULT_QUEUE = new PublicKey('Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh')
const [PROGRAM_IDENTITY_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('identity')],
  CLEARANCE_PROGRAM_ID,
)

export const MPL_CORE_PROGRAM_ID = new PublicKey(
  'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
)

export function getClearanceProgram(
  provider: AnchorProvider,
  address?: PublicKey,
): Program<Clearance> {
  return new Program(
    {
      ...ClearanceIDL,
      address: address ? address.toBase58() : ClearanceIDL.address,
    } as Clearance,
    provider,
  )
}

export function getClearanceProgramId(cluster: Cluster) {
  switch (cluster) {
    case 'devnet':
    case 'testnet':
    case 'mainnet-beta':
    default:
      return CLEARANCE_PROGRAM_ID
  }
}

/**
 * Derive the vault PDA for a given session ID.
 */
export function getVaultAddress(sessionId: bigint | number): [PublicKey, number] {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64LE(BigInt(sessionId))
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), buf],
    CLEARANCE_PROGRAM_ID,
  )
}

/**
 * Derive the claim record PDA for a given vault + user.
 */
export function getClaimRecordAddress(
  vault: PublicKey,
  user: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('claim'), vault.toBuffer(), user.toBuffer()],
    CLEARANCE_PROGRAM_ID,
  )
}

/**
 * Derive the fan deposit record PDA for a given vault + fan.
 */
export function getFanDepositRecordAddress(
  vault: PublicKey,
  fan: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('deposit'), vault.toBuffer(), fan.toBuffer()],
    CLEARANCE_PROGRAM_ID,
  )
}

/**
 * Build an unsigned `fan_deposit` transaction.
 * The fan must sign and submit it. No admin signature required.
 */
export async function buildFanDepositTransaction({
  connection,
  program,
  fanPublicKey,
  sessionId,
  usdcMint,
  amount,
}: {
  connection: Connection
  program: Program<Clearance>
  fanPublicKey: PublicKey
  sessionId: number
  usdcMint: PublicKey
  amount: number
}): Promise<Transaction> {
  const [vaultPda] = getVaultAddress(sessionId)
  const [depositRecordPda] = getFanDepositRecordAddress(vaultPda, fanPublicKey)
  const vaultAta = getAssociatedTokenAddressSync(usdcMint, vaultPda, true)
  const fanAta = getAssociatedTokenAddressSync(usdcMint, fanPublicKey)

  const ix = await program.methods
    .fanDeposit(new BN(amount))
    .accountsPartial({
      fan: fanPublicKey,
      vault: vaultPda,
      depositRecord: depositRecordPda,
      fanTokenAccount: fanAta,
      vaultTokenAccount: vaultAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction()

  const tx = new Transaction().add(ix)
  tx.feePayer = fanPublicKey
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

  return tx
}

/**
 * Build a partially-signed `claim_with_nft` transaction.
 * Admin signs; the returned tx still needs the user's signature.
 */
export async function buildClaimWithNftTransaction({
  connection,
  program,
  admin,
  userPublicKey,
  sessionId,
  nftAsset,
  usdcMint,
  amount,
}: {
  connection: Connection
  program: Program<Clearance>
  admin: Keypair
  userPublicKey: PublicKey
  sessionId: number
  nftAsset: PublicKey
  usdcMint: PublicKey
  amount: number
}): Promise<Transaction> {
  const [vaultPda] = getVaultAddress(sessionId)
  const [claimRecordPda] = getClaimRecordAddress(vaultPda, userPublicKey)
  const vaultAta = getAssociatedTokenAddressSync(usdcMint, vaultPda, true)
  const userAta = getAssociatedTokenAddressSync(usdcMint, userPublicKey)

  const ix = await program.methods
    .claimWithNft(new BN(amount))
    .accountsPartial({
      admin: admin.publicKey,
      user: userPublicKey,
      vault: vaultPda,
      claimRecord: claimRecordPda,
      vaultTokenAccount: vaultAta,
      userTokenAccount: userAta,
      usdcMint,
      nftAsset,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .instruction()

  const tx = new Transaction().add(ix)
  tx.feePayer = admin.publicKey
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

  // Admin partially signs (user must sign before submitting)
  tx.partialSign(admin)

  return tx
}

/**
 * Derive the raffle record PDA for a given vault + fan.
 */
export function getRaffleRecordAddress(
  vault: PublicKey,
  fan: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('raffle'), vault.toBuffer(), fan.toBuffer()],
    CLEARANCE_PROGRAM_ID,
  )
}

/**
 * Build a partially-signed `request_raffle` transaction.
 * Admin co-signs to attest the fan's tier. Fan must sign before submitting.
 */
export async function buildRequestRaffleTransaction({
  connection,
  program,
  admin,
  fanPublicKey,
  sessionId,
  tier,
  blockhash,
}: {
  connection: Connection
  program: Program<Clearance>
  admin: Keypair
  fanPublicKey: PublicKey
  sessionId: number
  tier: number
  /** Optional pre-fetched blockhash; avoids an extra getLatestBlockhash RPC call. */
  blockhash?: string
}): Promise<Transaction> {
  const [vaultPda] = getVaultAddress(sessionId)
  const [raffleRecordPda] = getRaffleRecordAddress(vaultPda, fanPublicKey)

  const ix = await program.methods
    .requestRaffle(tier)
    .accountsPartial({
      fan: fanPublicKey,
      admin: admin.publicKey,
      vault: vaultPda,
      raffleRecord: raffleRecordPda,
      oracleQueue: VRF_DEFAULT_QUEUE,
      programIdentity: PROGRAM_IDENTITY_PDA,
      slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
      systemProgram: SystemProgram.programId,
    })
    // The VRF program must be in the outer transaction's account list so the
    // runtime can resolve it when invoke_signed CPIs into it.
    .remainingAccounts([
      { pubkey: VRF_PROGRAM_ID, isWritable: false, isSigner: false },
    ])
    .instruction()

  const tx = new Transaction().add(ix)
  tx.feePayer = fanPublicKey
  tx.recentBlockhash = blockhash ?? (await connection.getLatestBlockhash()).blockhash

  // Admin partially signs (fan must sign before submitting)
  tx.partialSign(admin)

  return tx
}

/**
 * Build a partially-signed `claim_with_raffle` transaction.
 * Admin signs; the returned tx still needs the fan's signature.
 * No `amount` parameter — reads reward_amount from RaffleRecord on-chain.
 */
export async function buildClaimWithRaffleTransaction({
  connection,
  program,
  admin,
  fanPublicKey,
  sessionId,
  nftAsset,
  usdcMint,
  blockhash,
}: {
  connection: Connection
  program: Program<Clearance>
  admin: Keypair
  fanPublicKey: PublicKey
  sessionId: number
  nftAsset: PublicKey
  usdcMint: PublicKey
  /** Optional pre-fetched blockhash; avoids an extra getLatestBlockhash RPC call. */
  blockhash?: string
}): Promise<Transaction> {
  const [vaultPda] = getVaultAddress(sessionId)
  const [raffleRecordPda] = getRaffleRecordAddress(vaultPda, fanPublicKey)
  const [claimRecordPda] = getClaimRecordAddress(vaultPda, fanPublicKey)
  const vaultAta = getAssociatedTokenAddressSync(usdcMint, vaultPda, true)
  const fanAta = getAssociatedTokenAddressSync(usdcMint, fanPublicKey)

  const ix = await program.methods
    .claimWithRaffle()
    .accountsPartial({
      admin: admin.publicKey,
      fan: fanPublicKey,
      vault: vaultPda,
      raffleRecord: raffleRecordPda,
      claimRecord: claimRecordPda,
      vaultTokenAccount: vaultAta,
      fanTokenAccount: fanAta,
      usdcMint,
      nftAsset,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .instruction()

  const tx = new Transaction().add(ix)
  tx.feePayer = admin.publicKey
  tx.recentBlockhash = blockhash ?? (await connection.getLatestBlockhash()).blockhash

  // Admin partially signs (fan must sign before submitting)
  tx.partialSign(admin)

  return tx
}

/**
 * Build and submit an `initialize_vault` transaction.
 * Admin signs and submits directly (no co-sign needed).
 * Returns the vault PDA address.
 */
export async function buildInitializeVaultTransaction({
  connection,
  program,
  admin,
  sessionId,
  usdcMint,
}: {
  connection: Connection
  program: Program<Clearance>
  admin: Keypair
  sessionId: number
  usdcMint: PublicKey
}): Promise<{ vaultPda: PublicKey; txSignature: string }> {
  const [vaultPda] = getVaultAddress(sessionId)
  const vaultAta = getAssociatedTokenAddressSync(usdcMint, vaultPda, true)

  const ix = await program.methods
    .initializeVault(new BN(sessionId))
    .accountsPartial({
      admin: admin.publicKey,
      vault: vaultPda,
      vaultTokenAccount: vaultAta,
      usdcMint,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .instruction()

  const tx = new Transaction().add(ix)
  const txSignature = await sendAndConfirmTransaction(connection, tx, [admin])

  return { vaultPda, txSignature }
}

/**
 * Build and submit an admin `deposit` transaction.
 * Admin signs and submits directly (no co-sign needed).
 * Returns the tx signature.
 */
export async function buildAdminDepositTransaction({
  connection,
  program,
  admin,
  sessionId,
  usdcMint,
  amount,
}: {
  connection: Connection
  program: Program<Clearance>
  admin: Keypair
  sessionId: number
  usdcMint: PublicKey
  amount: number
}): Promise<string> {
  const [vaultPda] = getVaultAddress(sessionId)
  const vaultAta = getAssociatedTokenAddressSync(usdcMint, vaultPda, true)
  const adminAta = getAssociatedTokenAddressSync(usdcMint, admin.publicKey)

  const ix = await program.methods
    .deposit(new BN(amount))
    .accountsPartial({
      admin: admin.publicKey,
      vault: vaultPda,
      adminTokenAccount: adminAta,
      vaultTokenAccount: vaultAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction()

  const tx = new Transaction().add(ix)
  return sendAndConfirmTransaction(connection, tx, [admin])
}

/**
 * Build and submit a `callback_raffle` transaction.
 * In testing mode, admin acts as the VRF oracle identity.
 * Returns the tx signature.
 */
export async function buildCallbackRaffleTransaction({
  connection,
  program,
  admin,
  fanPublicKey,
  sessionId,
  randomness,
}: {
  connection: Connection
  program: Program<Clearance>
  admin: Keypair
  fanPublicKey: PublicKey
  sessionId: number
  randomness: number[]
}): Promise<string> {
  const [vaultPda] = getVaultAddress(sessionId)
  const [raffleRecordPda] = getRaffleRecordAddress(vaultPda, fanPublicKey)

  const ix = await program.methods
    .callbackRaffle(randomness)
    .accountsPartial({
      vrfProgramIdentity: admin.publicKey,
      raffleRecord: raffleRecordPda,
    })
    .instruction()

  const tx = new Transaction().add(ix)
  return sendAndConfirmTransaction(connection, tx, [admin])
}

/**
 * Fetch a RaffleRecord from the chain. Returns null if not found.
 */
export async function fetchRaffleRecord(
  program: Program<Clearance>,
  vaultPda: PublicKey,
  fanPubkey: PublicKey,
): Promise<{
  fan: PublicKey
  vault: PublicKey
  sessionId: number
  tier: number
  rewardAmount: number
  resolved: boolean
  bump: number
} | null> {
  const [raffleRecordPda] = getRaffleRecordAddress(vaultPda, fanPubkey)
  try {
    const record = await program.account.raffleRecord.fetch(raffleRecordPda)
    return {
      fan: record.fan,
      vault: record.vault,
      sessionId: (record.sessionId as BN).toNumber(),
      tier: record.tier,
      rewardAmount: (record.rewardAmount as BN).toNumber(),
      resolved: record.resolved,
      bump: record.bump,
    }
  } catch {
    return null
  }
}
