import { PrivyClient } from "@privy-io/server-auth";
import { prisma } from "@/lib/db";
import { nanoid } from "nanoid";
import { NextRequest } from "next/server";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");

  try {
    const verifiedClaims = await privy.verifyAuthToken(token);
    const privyId = verifiedClaims.userId;

    let user = await prisma.user.findUnique({ where: { privyId } });

    if (!user) {
      const privyUser = await privy.getUser(privyId);
      user = await prisma.user.create({
        data: {
          privyId,
          email: privyUser.email?.address ?? null,
          phone: privyUser.phone?.number ?? null,
          referralCode: nanoid(8).toUpperCase(),
        },
      });
    }

    return user;
  } catch {
    return null;
  }
}

export async function getActiveCampaign() {
  return prisma.campaign.findFirst({
    where: { status: "active" },
  });
}

export async function getUserCampaignRole(userId: string, campaignId: string) {
  const enrollment = await prisma.campaignEnrollment.findUnique({
    where: {
      userId_campaignId: { userId, campaignId },
    },
  });
  return enrollment?.role ?? null;
}

export async function requireRole(req: NextRequest, role: "creator" | "fan" | "admin") {
  const user = await getAuthUser(req);
  if (!user) throw new Error("Unauthorized");

  // Check active campaign enrollment first
  const activeCampaign = await getActiveCampaign();
  if (activeCampaign) {
    const campaignRole = await getUserCampaignRole(user.id, activeCampaign.id);
    if (campaignRole && campaignRole !== role) throw new Error("Forbidden");
    if (campaignRole === role) return user;
  }

  // Fall back to user's default role
  if (user.role !== role) throw new Error("Forbidden");
  return user;
}

export async function requireAdmin(req: NextRequest) {
  return requireRole(req, "admin");
}
