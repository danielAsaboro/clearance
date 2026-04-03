import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, getActiveCampaign } from "@/lib/auth-helpers";

// POST /api/referrals — Track a referral
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Prefer the HTTP-only server cookie; fall back to an explicit body value
  const cookieCode = req.cookies.get("referral_code")?.value ?? null;
  let referralCode = cookieCode;
  if (!referralCode) {
    const body = await req.json().catch(() => ({}));
    referralCode = body.referralCode ?? null;
  }

  if (!referralCode) {
    return NextResponse.json(
      { error: "referralCode is required" },
      { status: 400 }
    );
  }

  // Check if user was already referred
  const existingReferral = await prisma.referral.findUnique({
    where: { referredUserId: authUser.id },
  });
  if (existingReferral) {
    return NextResponse.json(
      { error: "User already has a referral" },
      { status: 409 }
    );
  }

  const referrer = await prisma.user.findUnique({
    where: { referralCode },
  });
  if (!referrer) {
    return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
  }

  if (referrer.id === authUser.id) {
    return NextResponse.json(
      { error: "Cannot refer yourself" },
      { status: 400 }
    );
  }

  const referral = await prisma.referral.create({
    data: {
      referrerId: referrer.id,
      referredUserId: authUser.id,
      code: referralCode,
    },
  });

  await prisma.user.update({
    where: { id: authUser.id },
    data: { referredBy: referralCode },
  });

  const response = NextResponse.json(referral, { status: 201 });
  // Clear the cookie regardless of where the code came from
  response.cookies.set("referral_code", "", { path: "/", maxAge: 0, httpOnly: true });
  return response;
}

// GET /api/referrals — Get current user's referral code + tribe score
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { referralCode: true },
  });

  const activeCampaign = await getActiveCampaign();
  const sessionFilter = activeCampaign
    ? { session: { campaignId: activeCampaign.id } }
    : {};

  const [referrals, tribeAggregate] = await Promise.all([
    prisma.referral.findMany({
      where: { referrerId: authUser.id },
      include: { referredUser: { select: { displayName: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.gameResult.aggregate({
      where: {
        ...sessionFilter,
        OR: [
          { userId: authUser.id },
          {
            user: {
              referralReceived: {
                referrerId: authUser.id,
              },
            },
          },
        ],
      },
      _sum: { correctVotes: true },
    }),
  ]);

  const tribeScore = tribeAggregate._sum.correctVotes ?? 0;

  return NextResponse.json({
    code: user?.referralCode ?? null,
    tribeScore,
    referrals,
  });
}
