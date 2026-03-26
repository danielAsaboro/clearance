import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { createVideoSchema } from "@/lib/validators";
import { createVideoSearchText, normalizeTags } from "@/lib/video-admin";
import { getPublicUrlForKey } from "@/lib/storage";
import {
  queuePendingVideoProcessing,
  queueVideoProcessingById,
} from "@/lib/video-processing";
import { resolveVideoAssetUrls } from "@/lib/video-response";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";
  const categoryId = req.nextUrl.searchParams.get("categoryId")?.trim() ?? "";
  const tag = req.nextUrl.searchParams.get("tag")?.trim().toLowerCase() ?? "";
  const status = req.nextUrl.searchParams.get("status")?.trim() ?? "";
  const readyOnly = req.nextUrl.searchParams.get("readyOnly") === "true";
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1"));
  const limit = Math.min(Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "20")), 100);

  const where: Prisma.VideoWhereInput = {};

  if (readyOnly) {
    where.status = "ready";
  } else if (status && ["processing", "ready", "failed"].includes(status)) {
    where.status = status as "processing" | "ready" | "failed";
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (tag) {
    where.tags = { has: tag };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { searchText: { contains: search.toLowerCase(), mode: "insensitive" } },
      { category: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
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
    }),
    prisma.video.count({ where }),
  ]);

  const normalized = videos.map((video) => ({
    ...resolveVideoAssetUrls(video, req.nextUrl.origin),
    usedInMatchups: video._count.matchupsAsA + video._count.matchupsAsB,
  }));

  // Warn about ready videos missing metadata — indicates a processing bug
  for (const video of videos) {
    if (video.status === "ready" && video.duration == null && video.thumbnailUrl == null) {
      console.warn(
        `[video] Video ${video.id} is "ready" but has no duration or thumbnail — metadata may have been lost`
      );
    }
  }

  if (videos.some((video) => video.status === "processing" || video.status === "failed")) {
    after(async () => {
      console.log("[video] after() triggered: sweep for pending/failed videos");
      await queuePendingVideoProcessing(2);
    });
  }

  return NextResponse.json({
    videos: normalized,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

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

  const category = parsed.data.categoryId
    ? await prisma.videoCategory.findUnique({
        where: { id: parsed.data.categoryId },
      })
    : null;

  if (parsed.data.categoryId && !category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const title =
    parsed.data.title?.trim() ||
    parsed.data.originalFilename.replace(/\.[^.]+$/, "").trim();
  const tags = normalizeTags(parsed.data.tags);

  const video = await prisma.video.create({
    data: {
      title,
      url: getPublicUrlForKey(parsed.data.sourceKey),
      status: "processing",
      tags,
      searchText: createVideoSearchText({
        title,
        categoryName: category?.name,
        tags,
      }),
      originalFilename: parsed.data.originalFilename,
      sourceContentType: parsed.data.sourceContentType,
      sourceBytes: parsed.data.sourceBytes,
      sourceKey: parsed.data.sourceKey,
      categoryId: category?.id ?? null,
      uploadedById: user.id,
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

  after(() => {
    console.log(`[video] after() triggered for ${video.id}`);
    queueVideoProcessingById(video.id);
  });

  return NextResponse.json(
    {
      ...resolveVideoAssetUrls(video, req.nextUrl.origin),
      usedInMatchups: 0,
    },
    { status: 201 }
  );
}
