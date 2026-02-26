import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { getUmi, getMintAuthority } from "@/lib/solana";
import { createBlindBoxCollection } from "@/lib/nft";

// POST /api/nft/collection — Admin creates a collection for a session
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { sessionWeek } = body;

  if (!sessionWeek || typeof sessionWeek !== "number") {
    return NextResponse.json(
      { error: "sessionWeek is required" },
      { status: 400 }
    );
  }

  const session = await prisma.weeklySession.findUnique({
    where: { weekNumber: sessionWeek },
  });

  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  if (session.collectionAddress) {
    return NextResponse.json(
      { error: "Collection already exists for this session", collectionAddress: session.collectionAddress },
      { status: 409 }
    );
  }

  try {
    const umi = getUmi();
    const signer = getMintAuthority();

    const collectionPublicKey = await createBlindBoxCollection(
      umi,
      signer,
      sessionWeek
    );

    const collectionAddress = collectionPublicKey.toString();

    await prisma.weeklySession.update({
      where: { weekNumber: sessionWeek },
      data: { collectionAddress },
    });

    return NextResponse.json({
      collectionAddress,
      sessionWeek,
    });
  } catch (error) {
    console.error("Failed to create collection:", error);
    return NextResponse.json(
      { error: "Failed to create collection on Solana" },
      { status: 500 }
    );
  }
}
