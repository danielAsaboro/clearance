import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { getPresignedUploadUrl } from "@/lib/s3";
import { nanoid } from "nanoid";
import { checkRateLimit } from "@/lib/rate-limit";

const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

// POST /api/admin/videos/presign — Get presigned URL for video upload
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = checkRateLimit(`video-upload:${user.id}`, 20);
  if (limited) return limited;

  const { contentType } = await req.json();

  if (!contentType || !ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: "Invalid content type. Allowed: mp4, webm, quicktime" },
      { status: 400 }
    );
  }

  const extMap: Record<string, string> = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  const ext = extMap[contentType] ?? "mp4";
  const key = `videos/${nanoid()}.${ext}`;

  const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType);

  return NextResponse.json({ uploadUrl, publicUrl });
}
