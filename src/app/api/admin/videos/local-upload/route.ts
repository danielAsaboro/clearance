import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import path from "path";
import fs from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

export const runtime = "nodejs";

const KEY_PATTERN = /^videos\/[a-zA-Z0-9_-]+\.(mp4|webm|mov)$/;

export async function PUT(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!KEY_PATTERN.test(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const filename = path.basename(key);
  const uploadDir = path.join(process.cwd(), "public", "uploads", "videos");
  await fs.promises.mkdir(uploadDir, { recursive: true });

  const dest = path.join(uploadDir, filename);

  if (!req.body) {
    return NextResponse.json({ error: "No body" }, { status: 400 });
  }

  const writeStream = fs.createWriteStream(dest);
  try {
    await pipeline(Readable.fromWeb(req.body as import("stream/web").ReadableStream), writeStream);
  } catch (err) {
    await fs.promises.unlink(dest).catch(() => {});
    throw err;
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
