import { AnchorProvider, Program, BN } from '@coral-xyz/anchor'
import {
  Cluster,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import SpotrtIDL from '../target/idl/clearance.json'
import type { Spotrtv } from '../target/types/clearance'

export type Spotr = Spotrtv
export const SpotrIDL: Spotr = SpotrtIDL as Spotr

export const SPOTR_PROGRAM_ID = new PublicKey(SpotrIDL.address)

export const MPL_CORE_PROGRAM_ID = new PublicKey(
  'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d',
)

export function getSpotrProgram(
  provider: AnchorProvider,
  address?: PublicKey,
): Program<Spotr> {
  return new Program(
    {
      ...SpotrIDL,
      address: address ? address.toBase58() : SpotrIDL.address,
    } as Spotr,
    provider,
  )
}

export function getSpotrProgramId(cluster: Cluster) {
  switch (cluster) {
    case 'devnet':
    case 'testnet':
    case 'mainnet-beta':
    default:
      return SPOTR_PROGRAM_ID
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
    SPOTR_PROGRAM_ID,
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
    SPOTR_PROGRAM_ID,
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
    SPOTR_PROGRAM_ID,
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
  program: Program<Spotr>
  fanPublicKey: PublicKey
  sessionId: number
  usdcMint: PublicKey
  amount: number
}): Promise<Transaction> {
  const [vaultPda] = getVaultAddress(sessionId)
  const [userAccountPda] = getUserAccountAddress(fanPublicKey)
  const [depositRecordPda] = getFanDepositRecordAddress(vaultPda, fanPublicKey)
  const vaultAta = getAssociatedTokenAddressSync(usdcMint, vaultPda, true)
  const fanAta = getAssociatedTokenAddressSync(usdcMint, fanPublicKey)

  const ix = await program.methods
    .fanDeposit(new BN(amount))
    .accountsPartial({
      fan: fanPublicKey,
      vault: vaultPda,
      userAccount: userAccountPda,
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
  program: Program<Spotr>
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
 * Derive the user account PDA for a given user.
 */
export function getUserAccountAddress(
  user: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user_account'), user.toBuffer()],
    SPOTR_PROGRAM_ID,
  )
}

/**
 * Derive the reward record PDA for a given vault + user.
 */
export function getRewardRecordAddress(
  vault: PublicKey,
  user: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('reward'), vault.toBuffer(), user.toBuffer()],
    SPOTR_PROGRAM_ID,
  )
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
  program: Program<Spotr>
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
  program: Program<Spotr>
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
 * Build and submit a `finalize_vault` transaction.
 * Admin signs and submits directly.
 */
export async function buildFinalizeVaultTransaction({
  connection,
  program,
  admin,
  sessionId,
}: {
  connection: Connection
  program: Program<Spotr>
  admin: Keypair
  sessionId: number
}): Promise<string> {
  const [vaultPda] = getVaultAddress(sessionId)

  const ix = await program.methods
    .finalizeVault()
    .accountsPartial({
      admin: admin.publicKey,
      vault: vaultPda,
    })
    .instruction()

  const tx = new Transaction().add(ix)
  return sendAndConfirmTransaction(connection, tx, [admin])
}

/**
 * Build a partially-signed `claim_reward` transaction.
 * Admin co-signs to attest the reward amount. User must sign before submitting.
 * Moves USDC from vault → user's UserAccount PDA ATA.
 */
export async function buildClaimRewardTransaction({
  connection,
  program,
  admin,
  userPublicKey,
  sessionId,
  usdcMint,
  amount,
}: {
  connection: Connection
  program: Program<Spotr>
  admin: Keypair
  userPublicKey: PublicKey
  sessionId: number
  usdcMint: PublicKey
  amount: number
}): Promise<Transaction> {
  const [vaultPda] = getVaultAddress(sessionId)
  const [userAccountPda] = getUserAccountAddress(userPublicKey)
  const [rewardRecordPda] = getRewardRecordAddress(vaultPda, userPublicKey)
  const vaultAta = getAssociatedTokenAddressSync(usdcMint, vaultPda, true)
  const userAccountAta = getAssociatedTokenAddressSync(usdcMint, userAccountPda, true)

  const ix = await program.methods
    .claimReward(new BN(amount))
    .accountsPartial({
      admin: admin.publicKey,
      user: userPublicKey,
      vault: vaultPda,
      userAccount: userAccountPda,
      rewardRecord: rewardRecordPda,
      vaultTokenAccount: vaultAta,
      userAccountToken: userAccountAta,
      usdcMint,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .instruction()

  const tx = new Transaction().add(ix)
  tx.feePayer = admin.publicKey
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

  // Admin partially signs — user must sign before submitting
  tx.partialSign(admin)

  return tx
}

/**
 * Build an unsigned `withdraw` transaction.
 * User must sign and submit. Moves USDC from user's PDA ATA to their wallet.
 */
export async function buildWithdrawTransaction({
  connection,
  program,
  userPublicKey,
  usdcMint,
  amount,
}: {
  connection: Connection
  program: Program<Spotr>
  userPublicKey: PublicKey
  usdcMint: PublicKey
  amount: number
}): Promise<Transaction> {
  const [userAccountPda] = getUserAccountAddress(userPublicKey)
  const userAccountAta = getAssociatedTokenAddressSync(usdcMint, userAccountPda, true)
  const userAta = getAssociatedTokenAddressSync(usdcMint, userPublicKey)

  const ix = await program.methods
    .withdraw(new BN(amount))
    .accountsPartial({
      user: userPublicKey,
      userAccount: userAccountPda,
      userAccountToken: userAccountAta,
      userTokenAccount: userAta,
      usdcMint,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .instruction()

  const tx = new Transaction().add(ix)
  tx.feePayer = userPublicKey
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

  return tx
}
