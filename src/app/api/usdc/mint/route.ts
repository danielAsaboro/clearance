import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getMint,
} from "@solana/spl-token";
import { getAuthUser } from "@/lib/auth-helpers";
import { checkRateLimit } from "@/lib/rate-limit";

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  "confirmed"
);

const USDC_MINT_ADDRESS = process.env.USDC_MINT_ADDRESS ??
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// How much test USDC to give per request
const FAUCET_AMOUNT_USDC = 10;

function getMintAuthorityKeypair(): Keypair {
  const secret = process.env.SOLANA_MINT_AUTHORITY_SECRET_KEY;
  if (!secret) throw new Error("SOLANA_MINT_AUTHORITY_SECRET_KEY not set");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

// POST /api/usdc/mint — mint test USDC to the authenticated fan's wallet
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate-limit: 3 mints per hour per user
  const limited = checkRateLimit(`usdc-mint:${user.id}`, 3);
  if (limited) return limited;

  if (!user.walletAddress) {
    return NextResponse.json({ error: "Wallet not connected" }, { status: 400 });
  }

  try {
    const mintAuthority = getMintAuthorityKeypair();
    const usdcMint = new PublicKey(USDC_MINT_ADDRESS);
    const recipient = new PublicKey(user.walletAddress);

    const mintInfo = await getMint(connection, usdcMint);
    const amount = BigInt(Math.round(FAUCET_AMOUNT_USDC * 10 ** mintInfo.decimals));

    // Get or create recipient ATA (mint authority pays rent)
    const recipientAta = await getOrCreateAssociatedTokenAccount(
      connection,
      mintAuthority,
      usdcMint,
      recipient
    );

    const signature = await mintTo(
      connection,
      mintAuthority,
      usdcMint,
      recipientAta.address,
      mintAuthority,
      amount
    );

    return NextResponse.json({
      success: true,
      signature,
      amountMinted: FAUCET_AMOUNT_USDC,
      walletAddress: user.walletAddress,
    });
  } catch (err) {
    console.error("[usdc/mint] Error:", err);
    return NextResponse.json(
      { error: "Failed to mint USDC. Check server logs." },
      { status: 500 }
    );
  }
}
