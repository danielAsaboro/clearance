import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";

// GET /api/admin/videos/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const video = await prisma.video.findUnique({ where: { id } });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  return NextResponse.json(video);
}

// PATCH /api/admin/videos/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const updateData: Record<string, unknown> = {};
  if (body.title !== undefined) updateData.title = body.title;
  if (body.thumbnailUrl !== undefined) updateData.thumbnailUrl = body.thumbnailUrl;

  const video = await prisma.video.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(video);
}

// DELETE /api/admin/videos/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Check if video is used in any matchup
  const matchupCount = await prisma.matchup.count({
    where: { OR: [{ videoAId: id }, { videoBId: id }] },
  });

  if (matchupCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete video that is used in matchups" },
      { status: 400 }
    );
  }

  await prisma.video.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
