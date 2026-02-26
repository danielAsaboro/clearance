import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import {
  getTopScores,
  submitScore,
  initializeLeaderboard,
} from "@/lib/soar";

// GET /api/leaderboard/soar — Fetch on-chain leaderboard from SOAR
export async function GET() {
  try {
    const scores = await getTopScores(50);
    return NextResponse.json({ scores, source: "soar-on-chain" });
  } catch (error) {
    console.error("SOAR leaderboard fetch error:", error);
    return NextResponse.json(
      { scores: [], source: "soar-on-chain", error: "Failed to fetch" },
      { status: 500 }
    );
  }
}

// POST /api/leaderboard/soar — Admin submits scores or initializes leaderboard
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  // Initialize leaderboard (one-time setup)
  if (body.action === "initialize") {
    try {
      const result = await initializeLeaderboard();
      return NextResponse.json(result);
    } catch (error) {
      console.error("SOAR init error:", error);
      return NextResponse.json(
        { error: "Failed to initialize SOAR leaderboard" },
        { status: 500 }
      );
    }
  }

  // Submit scores
  if (body.action === "submit" && Array.isArray(body.scores)) {
    const results = [];
    for (const { wallet, score } of body.scores) {
      const sig = await submitScore(wallet, score);
      results.push({ wallet, score, signature: sig });
    }
    return NextResponse.json({ submitted: results.length, results });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
