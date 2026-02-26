import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { submitTaskSchema } from "@/lib/validators";
import { validateTikTokUrl, verifyTikTokHashtag } from "@/lib/tiktok";
import { checkRateLimit } from "@/lib/rate-limit";

// GET /api/tasks/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: { creator: { select: { displayName: true, tiktokUsername: true } } },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Creators can only see their own tasks
  if (user.role !== "admin" && task.creatorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(task);
}

// PATCH /api/tasks/:id — Submit URL (creator) or verify/reject (admin)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(`task:${user.id}`, 20);
  if (limited) return limited;

  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id } });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const body = await req.json();

  // Creator submitting a TikTok URL
  if (body.tiktokUrl !== undefined) {
    if (task.creatorId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = submitTaskSchema.safeParse({ tiktokUrl: body.tiktokUrl });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid TikTok URL", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (!validateTikTokUrl(parsed.data.tiktokUrl)) {
      return NextResponse.json(
        { error: "URL must be a valid TikTok video link" },
        { status: 400 }
      );
    }

    // Check for required hashtag via oEmbed
    const hashtagCheck = await verifyTikTokHashtag(
      parsed.data.tiktokUrl,
      task.hashtag ?? "#theclearanceNG"
    );

    const updated = await prisma.task.update({
      where: { id },
      data: {
        tiktokUrl: parsed.data.tiktokUrl,
        status: "submitted",
        submittedAt: new Date(),
      },
    });

    return NextResponse.json({
      ...updated,
      hashtagVerification: {
        verified: hashtagCheck.verified,
        requiredHashtag: task.hashtag ?? "#theclearanceNG",
        foundHashtags: hashtagCheck.foundHashtags,
      },
    });
  }

  // Admin verifying or rejecting
  if (user.role === "admin") {
    if (body.status === "verified") {
      const updated = await prisma.task.update({
        where: { id },
        data: {
          status: "verified",
          verifiedAt: new Date(),
          verifiedBy: user.id,
        },
      });
      return NextResponse.json(updated);
    }

    if (body.status === "rejected") {
      const updated = await prisma.task.update({
        where: { id },
        data: {
          status: "rejected",
          rejectionNote: body.rejectionNote || null,
        },
      });
      return NextResponse.json(updated);
    }
  }

  return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
}
