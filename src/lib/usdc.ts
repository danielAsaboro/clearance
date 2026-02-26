import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  getMint,
} from "@solana/spl-token";

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  "confirmed"
);

const USDC_MINT = new PublicKey(
  process.env.USDC_MINT_ADDRESS ??
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

function getTreasuryKeypair(): Keypair {
  const secret =
    process.env.USDC_TREASURY_SECRET_KEY ??
    process.env.SOLANA_MINT_AUTHORITY_SECRET_KEY;
  if (!secret) throw new Error("Treasury secret key not configured");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

/**
 * @deprecated Use vault `claim_with_nft` instruction via `buildClaimWithNftTransaction` instead.
 * This function performs a direct SPL transfer with no PDA, no on-chain accounting.
 * Kept temporarily for backward compatibility — will be removed in a future release.
 */
export async function transferUsdc(
  toWalletAddress: string,
  usdcAmount: number
): Promise<string> {
  const treasury = getTreasuryKeypair();
  const recipient = new PublicKey(toWalletAddress);

  // Get USDC mint info for decimals
  const mint = await getMint(connection, USDC_MINT);
  const amount = BigInt(Math.round(usdcAmount * 10 ** mint.decimals));

  // Get or create ATAs (treasury pays rent for recipient if needed)
  const treasuryAta = await getOrCreateAssociatedTokenAccount(
    connection,
    treasury,
    USDC_MINT,
    treasury.publicKey
  );

  const recipientAta = await getOrCreateAssociatedTokenAccount(
    connection,
    treasury, // payer
    USDC_MINT,
    recipient
  );

  const tx = new Transaction().add(
    createTransferInstruction(
      treasuryAta.address,
      recipientAta.address,
      treasury.publicKey,
      amount
    )
  );

  const signature = await sendAndConfirmTransaction(connection, tx, [treasury]);
  return signature;
}

export async function getTreasuryBalance(): Promise<number> {
  const treasury = getTreasuryKeypair();
  const mint = await getMint(connection, USDC_MINT);
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    treasury,
    USDC_MINT,
    treasury.publicKey
  );
  return Number(ata.amount) / 10 ** mint.decimals;
}
