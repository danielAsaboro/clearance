import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { createVideoCategorySchema } from "@/lib/validators";
import { slugify } from "@/lib/video-admin";

function getUniqueSlug(base: string, suffix = 0) {
  return suffix === 0 ? base : `${base}-${suffix}`;
}

async function ensureAdmin(req: NextRequest) {
  const user = await getAuthUser(req);
  return user?.role === "admin" ? user : null;
}

export async function GET(req: NextRequest) {
  const user = await ensureAdmin(req);
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const categories = await prisma.videoCategory.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { videos: true },
      },
    },
  });

  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const user = await ensureAdmin(req);
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createVideoCategorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const baseSlug = slugify(parsed.data.name) || "category";
  let slug = baseSlug;
  let suffix = 1;

  while (await prisma.videoCategory.findUnique({ where: { slug } })) {
    slug = getUniqueSlug(baseSlug, suffix);
    suffix += 1;
  }

  const category = await prisma.videoCategory.create({
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

  return NextResponse.json(category, { status: 201 });
}
