import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { verifyGuestToken } from "@/lib/guest-auth";

// POST /api/auth/guest/merge — Merge guest data into authenticated user
export async function POST(req: NextRequest) {
  // Verify the real Privy user
  const realUser = await getAuthUser(req);
  if (!realUser || realUser.isGuest) {
    return NextResponse.json({ error: "Unauthorized — Privy auth required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const guestToken = body.guestToken as string | undefined;
  if (!guestToken) {
    return NextResponse.json({ error: "guestToken is required" }, { status: 400 });
  }

  const guestUserId = verifyGuestToken(guestToken);
  if (!guestUserId) {
    return NextResponse.json({ error: "Invalid guest token" }, { status: 400 });
  }

  const guestUser = await prisma.user.findUnique({ where: { id: guestUserId } });
  if (!guestUser || !guestUser.isGuest) {
    return NextResponse.json({ error: "Guest user not found" }, { status: 404 });
  }

  // Migrate all guest data to the real user in a transaction
  await prisma.$transaction(async (tx) => {
    // Carry over guest display name if the real user doesn't have one
    if (!realUser.displayName && guestUser.displayName) {
      await tx.user.update({
        where: { id: realUser.id },
        data: { displayName: guestUser.displayName },
      });
    }

    // Transfer GameResults (skip if real user already has one for that session)
    const guestResults = await tx.gameResult.findMany({
      where: { userId: guestUser.id },
    });

    for (const result of guestResults) {
      const existing = await tx.gameResult.findUnique({
        where: { userId_sessionId: { userId: realUser.id, sessionId: result.sessionId } },
      });

      if (!existing) {
        await tx.gameResult.update({
          where: { id: result.id },
          data: { userId: realUser.id, walletAddress: realUser.walletAddress },
        });
      }
    }

    // Transfer Votes (skip duplicates)
    const guestVotes = await tx.vote.findMany({
      where: { userId: guestUser.id },
    });

    for (const vote of guestVotes) {
      const existing = await tx.vote.findUnique({
        where: { userId_matchupId: { userId: realUser.id, matchupId: vote.matchupId } },
      });

      if (!existing) {
        await tx.vote.update({
          where: { id: vote.id },
          data: { userId: realUser.id },
        });
      }
    }

    // Transfer DiscountCodes
    const guestCodes = await tx.discountCode.findMany({
      where: { userId: guestUser.id },
    });

    for (const code of guestCodes) {
      const existing = await tx.discountCode.findUnique({
        where: { userId_sessionId: { userId: realUser.id, sessionId: code.sessionId } },
      });

      if (!existing) {
        await tx.discountCode.update({
          where: { id: code.id },
          data: { userId: realUser.id },
        });
      }
    }

    // Delete remaining guest records that couldn't be migrated (duplicates)
    await tx.discountCode.deleteMany({ where: { userId: guestUser.id } });
    await tx.vote.deleteMany({ where: { userId: guestUser.id } });
    await tx.gameResult.deleteMany({ where: { userId: guestUser.id } });
    await tx.user.delete({ where: { id: guestUser.id } });
  });

  return NextResponse.json({ merged: true, userId: realUser.id });
}
