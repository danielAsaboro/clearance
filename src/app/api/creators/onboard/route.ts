import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { onboardCreatorSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rate-limit";

// POST /api/creators/onboard — Complete creator onboarding
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(`onboard:${authUser.id}`, 5);
  if (limited) return limited;

  const body = await req.json();
  const parsed = onboardCreatorSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { debtSources, willingToDeclare, displayName, tiktokUsername, profilePhoto, consentAccepted } =
    parsed.data;

  const user = await prisma.user.update({
    where: { id: authUser.id },
    data: {
      role: "creator",
      debtSources,
      willingToDeclare,
      displayName,
      tiktokUsername,
      profilePhoto: profilePhoto || null,
      consentAccepted: consentAccepted as boolean,
    },
  });

  return NextResponse.json(
    { id: user.id, referralCode: user.referralCode },
    { status: 200 }
  );
}
