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

export async function requireRole(req: NextRequest, role: "creator" | "fan" | "admin") {
  const user = await getAuthUser(req);
  if (!user) throw new Error("Unauthorized");
  if (user.role !== role) throw new Error("Forbidden");
  return user;
}

export async function requireAdmin(req: NextRequest) {
  return requireRole(req, "admin");
}
