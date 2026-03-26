import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/esm/nodewallet";
import { randomBytes } from "crypto";
import {
  buildAdminDepositTransaction,
  buildCallbackRaffleTransaction,
  buildClaimWithNftTransaction,
  buildClaimWithRaffleTransaction,
  buildFanDepositTransaction,
  buildInitializeVaultTransaction,
  buildRequestRaffleTransaction,
  fetchRaffleRecord,
  getSpotrProgram,
  getRaffleRecordAddress,
  getVaultAddress,
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
 * Execute a fan deposit server-side using the admin keypair.
 * The admin deposits on behalf of the fan so the user doesn't need to sign.
 * Returns the transaction signature.
 */
export async function executeFanDepositServerSide({
  sessionWeekNumber,
  amountUsdc,
}: {
  sessionWeekNumber: number;
  amountUsdc: number;
}): Promise<string> {
  return adminDepositToVault(sessionWeekNumber, amountUsdc);
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
 * Build a partially-signed `request_raffle` transaction.
 * Admin co-signs to attest the fan's tier. Fan must sign before submitting.
 * Returns a base64-serialized transaction.
 */
export async function buildRequestRaffleTx({
  fanWalletAddress,
  sessionWeekNumber,
  tier,
}: {
  fanWalletAddress: string;
  sessionWeekNumber: number;
  tier: number;
}): Promise<string> {
  const admin = getAdminKeypair();
  const program = getProgram();
  const fanPublicKey = new PublicKey(fanWalletAddress);

  const tx = await buildRequestRaffleTransaction({
    connection,
    program,
    admin,
    fanPublicKey,
    sessionId: sessionWeekNumber,
    tier,
  });

  return Buffer.from(
    tx.serialize({ requireAllSignatures: false })
  ).toString("base64");
}

/**
 * Build a partially-signed `claim_with_raffle` transaction.
 * No amount parameter — reads reward_amount from RaffleRecord on-chain.
 * Returns a base64-serialized transaction that the fan must co-sign.
 */
export async function buildClaimWithRaffleTx({
  userWalletAddress,
  nftAssetAddress,
  sessionWeekNumber,
}: {
  userWalletAddress: string;
  nftAssetAddress: string;
  sessionWeekNumber: number;
}): Promise<string> {
  const admin = getAdminKeypair();
  const program = getProgram();
  const fanPublicKey = new PublicKey(userWalletAddress);
  const nftAsset = new PublicKey(nftAssetAddress);

  const tx = await buildClaimWithRaffleTransaction({
    connection,
    program,
    admin,
    fanPublicKey,
    sessionId: sessionWeekNumber,
    nftAsset,
    usdcMint: USDC_MINT,
  });

  return Buffer.from(
    tx.serialize({ requireAllSignatures: false })
  ).toString("base64");
}

/**
 * Fetch a RaffleRecord from on-chain for a given fan and session.
 * Returns null if no record exists.
 */
export async function fetchRaffleRecordOnChain({
  fanWalletAddress,
  sessionWeekNumber,
}: {
  fanWalletAddress: string;
  sessionWeekNumber: number;
}): Promise<{ resolved: boolean; rewardAmount: number } | null> {
  const program = getProgram();
  const fanPublicKey = new PublicKey(fanWalletAddress);
  const [vaultPda] = getVaultAddress(sessionWeekNumber);

  const record = await fetchRaffleRecord(program, vaultPda, fanPublicKey);
  if (!record) return null;

  return {
    resolved: record.resolved,
    rewardAmount: record.rewardAmount,
  };
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
 * Simulate a VRF callback to resolve a raffle (testing mode only).
 * Admin acts as the VRF oracle identity.
 * Returns the resolved reward amount in USDC.
 */
export async function simulateVrfCallback(
  fanWalletAddress: string,
  sessionWeekNumber: number,
  randomnessOverride?: number[]
): Promise<number> {
  const admin = getAdminKeypair();
  const program = getProgram();
  const fanPublicKey = new PublicKey(fanWalletAddress);

  const rand =
    randomnessOverride ?? Array.from(randomBytes(32));

  await buildCallbackRaffleTransaction({
    connection,
    program,
    admin,
    fanPublicKey,
    sessionId: sessionWeekNumber,
    randomness: rand,
  });

  // Fetch the resolved record to get the reward amount
  const [vaultPda] = getVaultAddress(sessionWeekNumber);
  const record = await fetchRaffleRecord(program, vaultPda, fanPublicKey);

  return record ? record.rewardAmount / 1_000_000 : 0;
}
