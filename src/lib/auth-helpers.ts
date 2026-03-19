import { PrivyClient } from "@privy-io/server-auth";
import { prisma } from "@/lib/db";
import { nanoid } from "nanoid";
import { NextRequest } from "next/server";

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

function getLinkedSolanaWalletAddress(privyUser: Awaited<ReturnType<typeof privy.getUser>>) {
  const solanaWallet = privyUser.linkedAccounts.find(
    (account): account is typeof account & { address: string; chainType: "solana" } =>
      account.type === "wallet" &&
      "address" in account &&
      "chainType" in account &&
      account.chainType === "solana"
  );

  return solanaWallet?.address ?? null;
}

export async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");

  let privyId: string;
  try {
    const verifiedClaims = await privy.verifyAuthToken(token);
    privyId = verifiedClaims.userId;
  } catch (err) {
    console.warn("[auth] Privy token verification failed:", err);
    return null;
  }

  try {
    const shouldHydratePrivyProfile = async (user: { email: string | null; phone: string | null; walletAddress: string | null } | null) =>
      !user || !user.email || !user.phone || !user.walletAddress;

    let user = await prisma.user.findUnique({ where: { privyId } });

    if (await shouldHydratePrivyProfile(user)) {
      const privyUser = await privy.getUser(privyId);
      const email = privyUser.email?.address ?? null;
      const phone = privyUser.phone?.number ?? null;
      const walletAddress = getLinkedSolanaWalletAddress(privyUser);

      if (!user) {
        try {
          user = await prisma.user.create({
            data: {
              privyId,
              email,
              phone,
              walletAddress,
              referralCode: nanoid(8).toUpperCase(),
            },
          });
        } catch (err: any) {
          if (err?.code === 'P2002') {
            // Another concurrent request created the user — fetch it
            user = await prisma.user.findUnique({ where: { privyId } });
          } else {
            throw err;
          }
        }
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            email: user.email ?? email,
            phone: user.phone ?? phone,
            walletAddress: user.walletAddress ?? walletAddress,
          },
        });
      }
    }

    return user;
  } catch (err) {
    console.error("[auth] DB error during user hydration:", err);
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

export async function requireRole(req: NextRequest, role: "player" | "admin") {
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
