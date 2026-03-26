import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { getStorageAssetPath } from "@/lib/storage-url";
import { serverEnv } from "@/lib/env";

const s3 = new S3Client({
  region: serverEnv.S3_REGION,
  endpoint: serverEnv.S3_ENDPOINT,
  credentials: {
    accessKeyId: serverEnv.S3_ACCESS_KEY_ID,
    secretAccessKey: serverEnv.S3_SECRET_ACCESS_KEY,
  },
});

const bucket = serverEnv.S3_BUCKET;

export async function getPresignedUploadUrl(
  key: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return {
    uploadUrl,
    publicUrl: getStorageAssetPath(key),
  };
}

export function getStoragePublicUrl(key: string) {
  return getStorageAssetPath(key);
}

export async function uploadFileToR2(
  key: string,
  filePath: string,
  contentType: string
) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: contentType,
    })
  );

  return getStoragePublicUrl(key);
}

export async function deleteObjectFromR2(key: string) {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

export async function getObjectFromR2(key: string, range?: string) {
  return s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: range,
    })
  );
}

export async function downloadObjectFromR2(key: string, filePath: string) {
  const response = await getObjectFromR2(key);

  if (!response.Body) {
    throw new Error(`Object ${key} has no body`);
  }

  await pipeline(
    Readable.fromWeb(response.Body.transformToWebStream() as NodeReadableStream),
    fs.createWriteStream(filePath)
  );
}
