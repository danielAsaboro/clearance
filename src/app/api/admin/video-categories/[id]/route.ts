import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { updateVideoCategorySchema } from "@/lib/validators";
import { createVideoSearchText, slugify } from "@/lib/video-admin";

async function ensureAdmin(req: NextRequest) {
  const user = await getAuthUser(req);
  return user?.role === "admin" ? user : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await ensureAdmin(req);
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateVideoCategorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.videoCategory.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const baseSlug = slugify(parsed.data.name) || "category";
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const conflict = await prisma.videoCategory.findUnique({ where: { slug } });
    if (!conflict || conflict.id === id) break;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const category = await prisma.videoCategory.update({
    where: { id },
    data: {
      name: parsed.data.name,
      slug,
    },
    include: {
      _count: {
        select: { videos: true },
      },
    },
  });

  const videos = await prisma.video.findMany({
    where: { categoryId: id },
    select: { id: true, title: true, tags: true },
  });

  await Promise.all(
    videos.map((video) =>
      prisma.video.update({
        where: { id: video.id },
        data: {
          searchText: createVideoSearchText({
            title: video.title,
            categoryName: category.name,
            tags: video.tags,
          }),
        },
      })
    )
  );

  return NextResponse.json(category);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await ensureAdmin(req);
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const category = await prisma.videoCategory.findUnique({
    where: { id },
    include: {
      _count: {
        select: { videos: true },
      },
    },
  });

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  if (category._count.videos > 0) {
    return NextResponse.json(
      { error: "Move or delete videos in this category before deleting it" },
      { status: 400 }
    );
  }

  await prisma.videoCategory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
