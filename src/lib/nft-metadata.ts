import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
const publicUrl = serverEnv.S3_PUBLIC_URL;

interface NftMetadataAttribute {
  trait_type: string;
  value: string;
}

interface NftMetadata {
  name: string;
  description: string;
  image: string;
  external_url: string;
  attributes: NftMetadataAttribute[];
  animation_url?: string;
}

/**
 * Upload NFT metadata JSON to S3 and return the public URI.
 * Follows the Metaplex Token Metadata standard.
 */
export async function uploadNftMetadata(
  metadata: NftMetadata,
  key: string
): Promise<string> {
  const jsonKey = `metadata/${key}.json`;
  const body = JSON.stringify(metadata);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: jsonKey,
      Body: body,
      ContentType: "application/json",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${publicUrl}/${jsonKey}`;
}
