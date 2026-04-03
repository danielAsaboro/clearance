import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/esm/nodewallet";
import {
  buildAdminDepositTransaction,
  buildClaimRewardTransaction,
  buildClaimWithNftTransaction,
  buildFanDepositTransaction,
  buildFinalizeVaultTransaction,
  buildInitializeVaultTransaction,
  buildWithdrawTransaction,
  getSpotrProgram,
  type Spotr,
} from "../../anchor/src/spotr-exports";

import { serverEnv } from "@/lib/env";

const connection = new Connection(
  serverEnv.NEXT_PUBLIC_SOLANA_RPC_URL,
  "confirmed"
);

const USDC_MINT = new PublicKey(serverEnv.USDC_MINT_ADDRESS);

function getAdminKeypair(): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(serverEnv.SOLANA_MINT_AUTHORITY_SECRET_KEY)));
}

let _program: Program<Spotr> | null = null;

function getProgram(): Program<Spotr> {
  if (_program) return _program;
  const admin = getAdminKeypair();
  const wallet = new NodeWallet(admin);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  _program = getSpotrProgram(provider);
  return _program;
}

/**
 * Build an unsigned `fan_deposit` transaction.
 * Returns a base64-serialized transaction that the fan must sign and submit.
 */
export async function buildFanDepositTx({
  fanWalletAddress,
  sessionWeekNumber,
  amountUsdc,
}: {
  fanWalletAddress: string;
  sessionWeekNumber: number;
  amountUsdc: number;
}): Promise<string> {
  const program = getProgram();
  const fanPublicKey = new PublicKey(fanWalletAddress);

  // Convert USDC amount to smallest units (6 decimals)
  const amount = Math.round(amountUsdc * 1_000_000);

  const tx = await buildFanDepositTransaction({
    connection,
    program,
    fanPublicKey,
    sessionId: sessionWeekNumber,
    usdcMint: USDC_MINT,
    amount,
  });

  // Unsigned — fan must sign before submitting
  return Buffer.from(
    tx.serialize({ requireAllSignatures: false })
  ).toString("base64");
}

/**
 * Build a partially-signed `claim_with_nft` transaction.
 * Returns a base64-serialized transaction that the user must co-sign.
 */
export async function buildClaimWithNftTx({
  userWalletAddress,
  nftAssetAddress,
  sessionWeekNumber,
  amountUsdc,
}: {
  userWalletAddress: string;
  nftAssetAddress: string;
  sessionWeekNumber: number;
  amountUsdc: number;
}): Promise<string> {
  const admin = getAdminKeypair();
  const program = getProgram();
  const userPublicKey = new PublicKey(userWalletAddress);
  const nftAsset = new PublicKey(nftAssetAddress);

  // Convert USDC amount to smallest units (6 decimals)
  const amount = Math.round(amountUsdc * 1_000_000);

  const tx = await buildClaimWithNftTransaction({
    connection,
    program,
    admin,
    userPublicKey,
    sessionId: sessionWeekNumber,
    nftAsset,
    usdcMint: USDC_MINT,
    amount,
  });

  // Serialize with requireAllSignatures=false since user hasn't signed yet
  return Buffer.from(
    tx.serialize({ requireAllSignatures: false })
  ).toString("base64");
}

/**
 * Initialize a vault on-chain for a given session.
 * Admin signs and submits directly.
 * Returns the vault PDA address string.
 */
export async function initializeVault(
  sessionWeekNumber: number
): Promise<string> {
  const admin = getAdminKeypair();
  const program = getProgram();

  const { vaultPda } = await buildInitializeVaultTransaction({
    connection,
    program,
    admin,
    sessionId: sessionWeekNumber,
    usdcMint: USDC_MINT,
  });

  return vaultPda.toBase58();
}

/**
 * Admin deposits USDC into a session vault.
 * Returns the tx signature.
 */
export async function adminDepositToVault(
  sessionWeekNumber: number,
  amountUsdc: number
): Promise<string> {
  const admin = getAdminKeypair();
  const program = getProgram();

  const amount = Math.round(amountUsdc * 1_000_000);

  return buildAdminDepositTransaction({
    connection,
    program,
    admin,
    sessionId: sessionWeekNumber,
    usdcMint: USDC_MINT,
    amount,
  });
}

/**
 * Finalize a vault on-chain (admin marks session as done).
 * No more deposits allowed after this.
 * Returns the tx signature.
 */
export async function finalizeVault(
  sessionWeekNumber: number
): Promise<string> {
  const admin = getAdminKeypair();
  const program = getProgram();

  return buildFinalizeVaultTransaction({
    connection,
    program,
    admin,
    sessionId: sessionWeekNumber,
  });
}

/**
 * Build a partially-signed `claim_reward` transaction.
 * Admin co-signs the reward amount. User must sign before submitting.
 * Returns a base64-serialized transaction.
 */
export async function buildClaimRewardTx({
  userWalletAddress,
  sessionWeekNumber,
  amountUsdc,
}: {
  userWalletAddress: string;
  sessionWeekNumber: number;
  amountUsdc: number;
}): Promise<string> {
  const admin = getAdminKeypair();
  const program = getProgram();
  const userPublicKey = new PublicKey(userWalletAddress);

  const amount = Math.round(amountUsdc * 1_000_000);

  const tx = await buildClaimRewardTransaction({
    connection,
    program,
    admin,
    userPublicKey,
    sessionId: sessionWeekNumber,
    usdcMint: USDC_MINT,
    amount,
  });

  return Buffer.from(
    tx.serialize({ requireAllSignatures: false })
  ).toString("base64");
}

/**
 * Build an unsigned `withdraw` transaction for a user.
 * Returns a base64-serialized transaction that the user must sign and submit.
 */
export async function buildWithdrawTx({
  userWalletAddress,
  amountUsdc,
}: {
  userWalletAddress: string;
  amountUsdc: number;
}): Promise<string> {
  const program = getProgram();
  const userPublicKey = new PublicKey(userWalletAddress);

  const amount = Math.round(amountUsdc * 1_000_000);

  const tx = await buildWithdrawTransaction({
    connection,
    program,
    userPublicKey,
    usdcMint: USDC_MINT,
    amount,
  });

  return Buffer.from(
    tx.serialize({ requireAllSignatures: false })
  ).toString("base64");
}
