import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import {
  fetchRaffleRecordOnChain,
  simulateVrfCallback,
} from "@/lib/vault-claim";

// GET /api/nft/raffle/status?gameResultId=... — Poll RaffleRecord on-chain
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gameResultId = req.nextUrl.searchParams.get("gameResultId");
  if (!gameResultId) {
    return NextResponse.json(
      { error: "gameResultId query param is required" },
      { status: 400 }
    );
  }

  const gameResult = await prisma.gameResult.findUnique({
    where: { id: gameResultId },
    include: { session: true },
  });

  if (!gameResult || gameResult.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const walletAddress = user.walletAddress ?? gameResult.walletAddress;
  if (!walletAddress) {
    return NextResponse.json(
      { error: "No wallet address" },
      { status: 400 }
    );
  }

  try {
    let record = await fetchRaffleRecordOnChain({
      fanWalletAddress: walletAddress,
      sessionWeekNumber: gameResult.session.weekNumber,
    });

    if (!record) {
      return NextResponse.json({
        resolved: false,
        rewardAmount: 0,
      });
    }

    // Auto-resolve VRF in testing mode: if raffle exists but not resolved,
    // simulate the VRF callback so the demo resolves within one poll cycle.
    if (!record.resolved && process.env.VRF_TESTING_MODE === "true") {
      try {
        await simulateVrfCallback(
          walletAddress,
          gameResult.session.weekNumber
        );
        // Re-fetch to get the resolved record
        record = await fetchRaffleRecordOnChain({
          fanWalletAddress: walletAddress,
          sessionWeekNumber: gameResult.session.weekNumber,
        });
        if (!record) {
          return NextResponse.json({ resolved: false, rewardAmount: 0 });
        }
      } catch (vrfErr) {
        console.error("VRF auto-resolve failed:", vrfErr);
        // Fall through — return unresolved status
      }
    }

    // If resolved, sync reward amount to Prisma
    if (record && record.resolved && gameResult.rewardAmount === 0) {
      const rewardUsdc = record.rewardAmount / 1_000_000;
      await prisma.gameResult.update({
        where: { id: gameResultId },
        data: { rewardAmount: rewardUsdc },
      });
    }

    return NextResponse.json({
      resolved: record?.resolved ?? false,
      rewardAmount: (record?.rewardAmount ?? 0) / 1_000_000,
    });
  } catch (err) {
    console.error("Failed to fetch raffle record:", err);
    return NextResponse.json(
      { error: "Failed to check raffle status" },
      { status: 500 }
    );
  }
}
