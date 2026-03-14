import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { getUploadIntent } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rate-limit";
import { createVideoUploadIntentSchema } from "@/lib/validators";
import { buildVideoStorageKey } from "@/lib/video-admin";

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = checkRateLimit(`video-upload:${user.id}`, 20);
  if (limited) return limited;

  const body = await req.json();
  const parsed = createVideoUploadIntentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const sourceKey = buildVideoStorageKey({
    originalFilename: parsed.data.filename,
  });
  const { uploadUrl, publicUrl } = await getUploadIntent(
    sourceKey,
    parsed.data.contentType
  );

  return NextResponse.json({
    uploadUrl,
    sourceKey,
    sourceUrl: publicUrl,
  });
}
