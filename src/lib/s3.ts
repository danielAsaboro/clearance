import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const bucket = process.env.S3_BUCKET!;
const publicUrl = process.env.S3_PUBLIC_URL!;

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
    publicUrl: `${publicUrl}/${key}`,
  };
}
