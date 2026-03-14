import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getStorageAssetPath } from "@/lib/storage-url";

function localUploadsRoot() {
  return path.join(process.cwd(), "public", "uploads");
}

function localPathForKey(key: string) {
  return path.join(localUploadsRoot(), key);
}

function getLocalUploadSigningSecret() {
  return process.env.LOCAL_UPLOAD_SIGNING_SECRET ??
    process.env.PRIVY_APP_SECRET ??
    process.env.ADMIN_SECRET ??
    null;
}

function createLocalUploadSignature(input: {
  key: string;
  contentType: string;
  expires: number;
}) {
  const secret = getLocalUploadSigningSecret();
  if (!secret) {
    throw new Error(
      "LOCAL_UPLOAD_SIGNING_SECRET, PRIVY_APP_SECRET, or ADMIN_SECRET is required for local signed uploads"
    );
  }

  return crypto
    .createHmac("sha256", secret)
    .update(`${input.key}:${input.contentType}:${input.expires}`)
    .digest("hex");
}

export function verifyLocalUploadSignature(input: {
  key: string;
  contentType: string;
  expires: number;
  signature: string;
}) {
  const expected = createLocalUploadSignature({
    key: input.key,
    contentType: input.contentType,
    expires: input.expires,
  });

  if (expected.length !== input.signature.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(input.signature)
  );
}

export function getStorageMode() {
  return process.env.STORAGE_MODE ?? "local";
}

export function getPublicUrlForKey(key: string) {
  if (getStorageMode() === "r2") {
    return getStorageAssetPath(key);
  }

  return `/uploads/${key}`;
}

export async function getUploadIntent(
  key: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
  if (getStorageMode() === "r2") {
    const { getPresignedUploadUrl } = await import("@/lib/r2");
    return getPresignedUploadUrl(key, contentType);
  }

  const expires = Math.floor(Date.now() / 1000) + 60 * 5;
  const signature = createLocalUploadSignature({ key, contentType, expires });
  const params = new URLSearchParams({
    key,
    contentType,
    expires: String(expires),
    signature,
  });

  return {
    uploadUrl: `/api/upload/local?${params.toString()}`,
    publicUrl: getPublicUrlForKey(key),
  };
}

export async function uploadFileToStorage(
  key: string,
  filePath: string,
  contentType: string
) {
  if (getStorageMode() === "r2") {
    const { uploadFileToR2 } = await import("@/lib/r2");
    return uploadFileToR2(key, filePath, contentType);
  }

  const dest = localPathForKey(key);
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.copyFile(filePath, dest);
  return getPublicUrlForKey(key);
}

export async function deleteObjectFromStorage(key: string | null | undefined) {
  if (!key) return;

  if (getStorageMode() === "r2") {
    const { deleteObjectFromR2 } = await import("@/lib/r2");
    await deleteObjectFromR2(key);
    return;
  }

  await fs.promises.unlink(localPathForKey(key)).catch(() => {});
}

export async function downloadObjectToTempFile(
  key: string,
  extension: string
): Promise<string> {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "spotr-video-"));
  const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, "") || "bin";
  const tempPath = path.join(tempDir, `asset.${safeExtension.replace(/^\./, "")}`);

  if (getStorageMode() === "r2") {
    const { downloadObjectFromR2 } = await import("@/lib/r2");
    await downloadObjectFromR2(key, tempPath);
    return tempPath;
  }

  await fs.promises.copyFile(localPathForKey(key), tempPath);
  return tempPath;
}
