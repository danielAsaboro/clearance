import { NextRequest, NextResponse } from "next/server";
import { NoSuchKey } from "@aws-sdk/client-s3";
import { getObjectFromR2 } from "@/lib/r2";
import { getStorageMode } from "@/lib/storage";

export const runtime = "nodejs";

function decodeStorageKey(segments: string[]) {
  return segments.map((segment) => decodeURIComponent(segment)).join("/");
}

function buildObjectHeaders(response: Awaited<ReturnType<typeof getObjectFromR2>>) {
  const headers = new Headers();

  if (response.ContentType) {
    headers.set("content-type", response.ContentType);
  }

  if (response.ContentLength !== undefined) {
    headers.set("content-length", String(response.ContentLength));
  }

  if (response.ETag) {
    headers.set("etag", response.ETag);
  }

  if (response.LastModified) {
    headers.set("last-modified", response.LastModified.toUTCString());
  }

  if (response.CacheControl) {
    headers.set("cache-control", response.CacheControl);
  } else {
    headers.set("cache-control", "public, max-age=3600");
  }

  if (response.AcceptRanges) {
    headers.set("accept-ranges", response.AcceptRanges);
  }

  if (response.ContentRange) {
    headers.set("content-range", response.ContentRange);
  }

  return headers;
}

async function handleRequest(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
  headOnly = false
) {
  if (getStorageMode() !== "r2") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { key: segments } = await params;
  const key = decodeStorageKey(segments);

  if (!key) {
    return NextResponse.json({ error: "Missing storage key" }, { status: 400 });
  }

  try {
    const response = await getObjectFromR2(key, req.headers.get("range") ?? undefined);
    const headers = buildObjectHeaders(response);
    const status = response.$metadata.httpStatusCode ?? 200;

    if (headOnly) {
      return new NextResponse(null, { status, headers });
    }

    if (!response.Body) {
      return NextResponse.json({ error: "Object has no body" }, { status: 404 });
    }

    return new NextResponse(response.Body.transformToWebStream(), { status, headers });
  } catch (error) {
    if (error instanceof NoSuchKey || (error as { name?: string }).name === "NoSuchKey") {
      return NextResponse.json({ error: "Object not found" }, { status: 404 });
    }

    console.error("[storage] Failed to fetch object:", error);
    return NextResponse.json({ error: "Failed to fetch object" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ key: string[] }> }
) {
  return handleRequest(req, context);
}

export async function HEAD(
  req: NextRequest,
  context: { params: Promise<{ key: string[] }> }
) {
  return handleRequest(req, context, true);
}
