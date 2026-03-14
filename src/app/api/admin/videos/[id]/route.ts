import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { updateVideoSchema } from "@/lib/validators";
import { createVideoSearchText, normalizeTags } from "@/lib/video-admin";
import { deleteObjectFromStorage } from "@/lib/storage";
import { processVideoById } from "@/lib/video-processing";
import { resolveVideoAssetUrls } from "@/lib/video-response";

async function getAdminUser(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser(req);
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const video = await prisma.video.findUnique({
    where: { id },
    include: {
      category: true,
      uploadedBy: { select: { displayName: true } },
      _count: {
        select: {
          matchupsAsA: true,
          matchupsAsB: true,
        },
      },
    },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...resolveVideoAssetUrls(video, req.nextUrl.origin),
    usedInMatchups: video._count.matchupsAsA + video._count.matchupsAsB,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser(req);
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateVideoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.video.findUnique({
    where: { id },
    include: { category: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  let categoryName = existing.category?.name ?? null;
  if (parsed.data.categoryId) {
    const category = await prisma.videoCategory.findUnique({
      where: { id: parsed.data.categoryId },
    });
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    categoryName = category.name;
  } else if (parsed.data.categoryId === null) {
    categoryName = null;
  }

  const tags = parsed.data.tags ? normalizeTags(parsed.data.tags) : existing.tags;
  const title =
    parsed.data.title === undefined ? existing.title : parsed.data.title;

  const video = await prisma.video.update({
    where: { id },
    data: {
      title,
      categoryId: parsed.data.categoryId,
      tags,
      thumbnailUrl: parsed.data.thumbnailUrl,
      searchText: createVideoSearchText({
        title,
        categoryName,
        tags,
      }),
    },
    include: {
      category: true,
      uploadedBy: { select: { displayName: true } },
      _count: {
        select: {
          matchupsAsA: true,
          matchupsAsB: true,
        },
      },
    },
  });

  return NextResponse.json({
    ...resolveVideoAssetUrls(video, req.nextUrl.origin),
    usedInMatchups: video._count.matchupsAsA + video._count.matchupsAsB,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser(req);
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await processVideoById(id);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Video processing failed",
      },
      { status: 500 }
    );
  }

  const video = await prisma.video.findUnique({
    where: { id },
    include: {
      category: true,
      uploadedBy: { select: { displayName: true } },
      _count: {
        select: {
          matchupsAsA: true,
          matchupsAsB: true,
        },
      },
    },
  });

  return NextResponse.json({
    ...resolveVideoAssetUrls(video!, req.nextUrl.origin),
    usedInMatchups: (video?._count.matchupsAsA ?? 0) + (video?._count.matchupsAsB ?? 0),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser(req);
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

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
  await Promise.all([
    deleteObjectFromStorage(video.sourceKey),
    deleteObjectFromStorage(video.playbackKey),
    deleteObjectFromStorage(video.thumbnailKey),
  ]);

  return NextResponse.json({ success: true });
}
