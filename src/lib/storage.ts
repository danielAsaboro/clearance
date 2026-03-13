export async function getUploadIntent(
  key: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const mode = process.env.STORAGE_MODE ?? "local";

  if (mode === "r2") {
    const { getPresignedUploadUrl } = await import("@/lib/r2");
    return getPresignedUploadUrl(key, contentType);
  }

  // "local" or "dev" → write to filesystem
  return {
    uploadUrl: `/api/admin/videos/local-upload?key=${encodeURIComponent(key)}`,
    publicUrl: `/uploads/${key}`,
  };
}
