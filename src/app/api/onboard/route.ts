import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { onboardSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rate-limit";

// POST /api/onboard — Complete onboarding for both creators and fans
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(`onboard:${authUser.id}`, 5);
  if (limited) return limited;

  const body = await req.json();
  const parsed = onboardSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    role,
    categories,
    email,
    displayName,
    profilePhoto,
    consentAccepted,
    debtSources,
    willingToDeclare,
    tiktokUsername,
  } = parsed.data;

  // Validate creator-specific fields
  if (role === "creator") {
    if (!debtSources || debtSources.length === 0) {
      return NextResponse.json(
        { error: "Creators must select at least one debt source" },
        { status: 400 }
      );
    }
    if (willingToDeclare === undefined) {
      return NextResponse.json(
        { error: "Creators must indicate willingness to declare" },
        { status: 400 }
      );
    }
    if (!tiktokUsername) {
      return NextResponse.json(
        { error: "Creators must provide a TikTok username" },
        { status: 400 }
      );
    }
  }

  // Update user with onboarding data
  const updateData: Record<string, unknown> = {
    role,
    categories,
    displayName,
    profilePhoto: profilePhoto || null,
    consentAccepted: consentAccepted as boolean,
  };

  // Store email if provided and user doesn't already have one
  if (email && !authUser.email) {
    updateData.email = email;
  }

  // Creator-specific fields
  if (role === "creator") {
    updateData.debtSources = debtSources;
    updateData.willingToDeclare = willingToDeclare;
    updateData.tiktokUsername = tiktokUsername;
  }

  // Find active campaign and create enrollment if one exists
  const activeCampaign = await prisma.campaign.findFirst({
    where: { status: "active" },
  });

  const user = await prisma.user.update({
    where: { id: authUser.id },
    data: updateData,
  });

  // Create campaign enrollment if there's an active campaign
  if (activeCampaign) {
    await prisma.campaignEnrollment.upsert({
      where: {
        userId_campaignId: {
          userId: user.id,
          campaignId: activeCampaign.id,
        },
      },
      update: { role },
      create: {
        userId: user.id,
        campaignId: activeCampaign.id,
        role,
      },
    });
  }

  return NextResponse.json(
    { id: user.id, referralCode: user.referralCode },
    { status: 200 }
  );
}
