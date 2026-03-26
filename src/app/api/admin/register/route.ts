import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { serverEnv } from "@/lib/env";

// POST /api/admin/register
// Body: { secret: string }
// Promotes the authenticated user to admin if the secret matches ADMIN_SECRET env var.
export async function POST(req: NextRequest) {
    const user = await getAuthUser(req);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminSecret = serverEnv.ADMIN_SECRET;

    const body = await req.json();
    const { secret } = body as { secret?: string };

    if (!secret || secret !== adminSecret) {
        return NextResponse.json({ error: "Invalid secret key." }, { status: 403 });
    }

    if (user.role === "admin") {
        return NextResponse.json({ message: "You are already an admin." });
    }

    const updated = await prisma.user.update({
        where: { id: user.id },
        data: { role: "admin" },
    });

    return NextResponse.json({ message: "Promoted to admin.", id: updated.id });
}
