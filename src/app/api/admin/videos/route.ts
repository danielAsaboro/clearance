import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { createVideoSchema } from "@/lib/validators";

// GET /api/admin/videos — List all videos
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const search = req.nextUrl.searchParams.get("search");

  const videos = await prisma.video.findMany({
    where: search
      ? { title: { contains: search, mode: "insensitive" } }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { displayName: true } },
    },
  });

  return NextResponse.json(videos);
}

// POST /api/admin/videos — Create a video record after S3 upload
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createVideoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const video = await prisma.video.create({
    data: {
      ...parsed.data,
      uploadedById: user.id,
    },
  });

  return NextResponse.json(video, { status: 201 });
}
