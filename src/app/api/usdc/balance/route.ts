import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getAuthUser } from "@/lib/auth-helpers";
import { checkRateLimit } from "@/lib/rate-limit";

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  "confirmed"
);

const USDC_MINT = new PublicKey(
  process.env.USDC_MINT_ADDRESS ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

// GET /api/usdc/balance — returns fan's fake USDC balance
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(`usdc-balance:${user.id}`, 30);
  if (limited) return limited;

  if (!user.walletAddress) {
    return NextResponse.json({ balance: 0, walletAddress: null });
  }

  try {
    const walletPubkey = new PublicKey(user.walletAddress);
    const ata = getAssociatedTokenAddressSync(USDC_MINT, walletPubkey);

    const accountInfo = await connection.getTokenAccountBalance(ata);
    const balance = accountInfo.value.uiAmount ?? 0;

    return NextResponse.json({
      balance,
      walletAddress: user.walletAddress,
    });
  } catch {
    // ATA doesn't exist yet — balance is 0
    return NextResponse.json({
      balance: 0,
      walletAddress: user.walletAddress,
    });
  }
}
