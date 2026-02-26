import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";

// GET /api/users — Get current user profile
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(user);
}

// POST /api/users — Create/sync user from Privy (called after login)
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Update role if specified — only allowed before onboarding is completed
  const body = await req.json().catch(() => ({}));
  if (body.role && ["creator", "fan"].includes(body.role)) {
    if (user.consentAccepted) {
      return NextResponse.json(
        { error: "Role is locked after onboarding" },
        { status: 403 }
      );
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: body.role },
    });
    return NextResponse.json(updated, { status: 200 });
  }

  return NextResponse.json(user, { status: 200 });
}
