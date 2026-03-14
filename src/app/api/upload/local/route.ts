import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { verifyLocalUploadSignature } from "@/lib/storage";

export const runtime = "nodejs";

function getUploadRoot() {
  return path.join(process.cwd(), "public", "uploads");
}

function resolveDestination(key: string) {
  const uploadRoot = getUploadRoot();
  const destination = path.resolve(uploadRoot, key);

  if (!destination.startsWith(path.resolve(uploadRoot) + path.sep)) {
    return null;
  }

  return destination;
}

export async function PUT(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const contentType = req.nextUrl.searchParams.get("contentType") ?? "";
  const expires = Number(req.nextUrl.searchParams.get("expires") ?? "0");
  const signature = req.nextUrl.searchParams.get("signature") ?? "";

  if (!key || !contentType || !Number.isFinite(expires) || !signature) {
    return NextResponse.json({ error: "Invalid upload signature" }, { status: 400 });
  }

  if (Math.floor(Date.now() / 1000) > expires) {
    return NextResponse.json({ error: "Upload URL expired" }, { status: 403 });
  }

  if (
    !verifyLocalUploadSignature({
      key,
      contentType,
      expires,
      signature,
    })
  ) {
    return NextResponse.json({ error: "Invalid upload signature" }, { status: 403 });
  }

  if (req.headers.get("content-type") !== contentType) {
    return NextResponse.json({ error: "Unexpected content type" }, { status: 400 });
  }

  const destination = resolveDestination(key);
  if (!destination) {
    return NextResponse.json({ error: "Invalid upload key" }, { status: 400 });
  }

  if (!req.body) {
    return NextResponse.json({ error: "No body" }, { status: 400 });
  }

  await fs.promises.mkdir(path.dirname(destination), { recursive: true });

  const writeStream = fs.createWriteStream(destination);

  try {
    await pipeline(
      Readable.fromWeb(req.body as import("node:stream/web").ReadableStream),
      writeStream
    );
  } catch (error) {
    await fs.promises.unlink(destination).catch(() => {});
    throw error;
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
