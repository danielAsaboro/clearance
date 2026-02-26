import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { trackAction, getCampaignProgress } from "@/lib/torque";
import { checkRateLimit } from "@/lib/rate-limit";

const VALID_ACTIONS = [
  "session_vote",
  "nft_reveal",
  "referral_signup",
  "session_join",
] as const;

// POST /api/loyalty/track — Track a loyalty action via Torque
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(`loyalty:${user.id}`, 60);
  if (limited) return limited;

  const body = await req.json();
  const { action } = body;

  if (!action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: "Invalid action type" },
      { status: 400 }
    );
  }

  if (!user.walletAddress) {
    return NextResponse.json(
      { error: "Wallet not connected" },
      { status: 400 }
    );
  }

  // Fire-and-forget to Torque
  trackAction(user.walletAddress, action);

  return NextResponse.json({ tracked: true, action });
}

// GET /api/loyalty/track — Get loyalty progress for the current user
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.walletAddress) {
    return NextResponse.json({
      campaigns: [],
      streaks: 0,
      totalActions: 0,
    });
  }

  const progress = await getCampaignProgress(user.walletAddress);
  return NextResponse.json(progress);
}
