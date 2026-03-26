import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { uploadNftMetadata } from "@/lib/nft-metadata";
import { serverEnv } from "@/lib/env";

const DRIP_API_URL = serverEnv.DRIP_API_URL;
const DRIP_API_KEY = serverEnv.DRIP_API_KEY;

// POST /api/admin/drip/distribute — Trigger DRiP collectible distribution
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { sessionId } = body;

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 }
    );
  }

  const session = await prisma.weeklySession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  // Get all participants with wallet addresses
  const participants = await prisma.gameResult.findMany({
    where: { sessionId },
    include: { user: { select: { walletAddress: true, displayName: true } } },
  });

  const eligibleWallets = participants
    .filter((p) => p.user.walletAddress)
    .map((p) => ({
      wallet: p.user.walletAddress!,
      name: p.user.displayName ?? "Anonymous",
    }));

  if (eligibleWallets.length === 0) {
    return NextResponse.json(
      { error: "No participants with wallets found" },
      { status: 400 }
    );
  }

  const collectibleName = `Spotr TV — Week ${session.weekNumber} Participation`;
  const collectibleDescription = `Participation collectible for Spotr TV, Week ${session.weekNumber}. ${eligibleWallets.length} fans voted live!`;

  // Upload collectible metadata to S3
  const metadataUri = await uploadNftMetadata(
    {
      name: collectibleName,
      description: collectibleDescription,
      image: `${serverEnv.NEXT_PUBLIC_APP_URL}/icon-512x512.png`,
      external_url: serverEnv.NEXT_PUBLIC_APP_URL,
      attributes: [
        { trait_type: "Type", value: "Participation" },
        { trait_type: "Week", value: session.weekNumber.toString() },
        { trait_type: "Season", value: "1" },
        { trait_type: "Participants", value: eligibleWallets.length.toString() },
      ],
    },
    `drip/week-${session.weekNumber}-participation`
  );

  const distribution = {
    sessionId,
    sessionTitle: session.title,
    weekNumber: session.weekNumber,
    totalParticipants: eligibleWallets.length,
    wallets: eligibleWallets.map((w) => w.wallet),
    collectible: {
      name: collectibleName,
      description: collectibleDescription,
      symbol: "SPOTRTV",
      metadataUri,
    },
    distributedAt: new Date().toISOString(),
    channel: "spotr-tv",
    status: "pending",
  };

  // Call DRiP API if configured
  if (DRIP_API_KEY) {
    try {
      const dripRes = await fetch(`${DRIP_API_URL}/distributions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DRIP_API_KEY}`,
        },
        body: JSON.stringify({
          name: collectibleName,
          description: collectibleDescription,
          symbol: "SPOTRTV",
          metadataUri,
          recipients: eligibleWallets.map((w) => w.wallet),
        }),
      });

      if (!dripRes.ok) {
        const errData = await dripRes.text();
        console.error(`[DRiP] API error: ${dripRes.status} ${errData}`);
        return NextResponse.json(
          {
            ...distribution,
            status: "failed",
            error: `DRiP API returned ${dripRes.status}`,
          },
          { status: 502 }
        );
      }

      const dripData = await dripRes.json();
      distribution.status = "distributed";

      console.log(
        `[DRiP] Distributed to ${eligibleWallets.length} wallets for session ${sessionId}`,
        dripData
      );

      return NextResponse.json({ ...distribution, dripResponse: dripData });
    } catch (err) {
      console.error("[DRiP] API call failed:", err);
      return NextResponse.json(
        {
          ...distribution,
          status: "failed",
          error: "DRiP API call failed",
        },
        { status: 502 }
      );
    }
  }

  // Fallback: return distribution data for manual processing via DRiP dashboard
  console.log(
    `[DRiP] No DRIP_API_KEY configured. Distribution data ready for manual processing: ${eligibleWallets.length} wallets`
  );
  distribution.status = "ready_for_manual";

  return NextResponse.json(distribution);
}
