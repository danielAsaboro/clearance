import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/esm/nodewallet";
import {
  buildClaimWithNftTransaction,
  getClearanceProgram,
  type Clearance,
} from "../../anchor/src/clearance-exports";

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  "confirmed"
);

const USDC_MINT = new PublicKey(
  process.env.USDC_MINT_ADDRESS ??
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

function getAdminKeypair(): Keypair {
  const secret = process.env.SOLANA_MINT_AUTHORITY_SECRET_KEY;
  if (!secret) throw new Error("SOLANA_MINT_AUTHORITY_SECRET_KEY not set");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

let _program: Program<Clearance> | null = null;

function getProgram(): Program<Clearance> {
  if (_program) return _program;
  const admin = getAdminKeypair();
  const wallet = new NodeWallet(admin);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  _program = getClearanceProgram(provider);
  return _program;
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
