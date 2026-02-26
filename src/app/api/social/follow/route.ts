import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { followCreator } from "@/lib/tapestry";
import { checkRateLimit } from "@/lib/rate-limit";

// POST /api/social/follow — Follow a creator on-chain via Tapestry
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(`follow:${user.id}`, 30);
  if (limited) return limited;

  if (!user.walletAddress) {
    return NextResponse.json(
      { error: "Wallet not connected" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { creatorWallet } = body;

  if (!creatorWallet || typeof creatorWallet !== "string") {
    return NextResponse.json(
      { error: "creatorWallet is required" },
      { status: 400 }
    );
  }

  try {
    const result = await followCreator(user.walletAddress, creatorWallet);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Tapestry follow error:", error);
    return NextResponse.json(
      { error: "Failed to follow on-chain" },
      { status: 500 }
    );
  }
}
