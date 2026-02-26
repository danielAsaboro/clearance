import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { findOrCreateProfile } from "@/lib/tapestry";

// POST /api/social/profile — Create/fetch Tapestry on-chain profile
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.walletAddress) {
    return NextResponse.json(
      { error: "Wallet not connected" },
      { status: 400 }
    );
  }

  try {
    const profile = await findOrCreateProfile(
      user.walletAddress,
      user.displayName ?? user.walletAddress.slice(0, 8)
    );
    return NextResponse.json(profile);
  } catch (error) {
    console.error("Tapestry profile error:", error);
    return NextResponse.json(
      { error: "Failed to create on-chain profile" },
      { status: 500 }
    );
  }
}
