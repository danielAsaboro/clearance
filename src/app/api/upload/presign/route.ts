import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { getPresignedUploadUrl } from "@/lib/s3";
import { nanoid } from "nanoid";
import { checkRateLimit } from "@/lib/rate-limit";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(`upload:${user.id}`, 10);
  if (limited) return limited;

  const { contentType } = await req.json();

  if (!contentType || !ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: "Invalid content type. Allowed: JPEG, PNG, WebP, GIF" },
      { status: 400 }
    );
  }

  const ext = contentType.split("/")[1].replace("jpeg", "jpg");
  const key = `profiles/${user.id}/${nanoid()}.${ext}`;

  const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType);

  return NextResponse.json({ uploadUrl, publicUrl });
}
