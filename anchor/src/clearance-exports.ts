import { AnchorProvider, Program, BN } from '@coral-xyz/anchor'
import {
  Cluster,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
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
