import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

function getS3Config() {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET_NAME;
  const cfDomain = process.env.CLOUDFRONT_DOMAIN;

  if (!region || !accessKeyId || !secretAccessKey || !bucket || !cfDomain) {
    const missing = [
      !region && "AWS_REGION",
      !accessKeyId && "AWS_ACCESS_KEY_ID",
      !secretAccessKey && "AWS_SECRET_ACCESS_KEY",
      !bucket && "S3_BUCKET_NAME",
      !cfDomain && "CLOUDFRONT_DOMAIN",
    ].filter(Boolean);
    throw new Error(
      `[S3] Missing required environment variables: ${missing.join(", ")}. ` +
        "See .env.local.example for setup instructions.",
    );
  }

  return { region, accessKeyId, secretAccessKey, bucket, cfDomain };
}

let _s3: S3Client | null = null;

function getS3Client(): S3Client {
  if (_s3) return _s3;
  const { region, accessKeyId, secretAccessKey } = getS3Config();
  _s3 = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _s3;
}

function getBucket(): string {
  return getS3Config().bucket;
}

function getCdnBase(): string {
  return `https://${getS3Config().cfDomain}`;
}

export type S3Folder = "photos" | "covers";

/**
 * Decode a base64 dataUrl, upload to S3, and return the CloudFront CDN URL.
 * Supports any image/* dataUrl (JPEG, PNG, WebP, etc.).
 *
 * The object key uses a UUID so every upload is unique and immutable —
 * this pairs well with CloudFront's aggressive caching.
 */
export async function uploadBase64ToS3(
  dataUrl: string,
  folder: S3Folder,
): Promise<string> {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) throw new Error("Invalid dataUrl: missing comma separator");

  const header = dataUrl.slice(0, commaIdx);
  const base64Data = dataUrl.slice(commaIdx + 1);
  const contentType = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const ext = contentType.split("/")[1]?.split("+")[0] ?? "jpg";
  const key = `${folder}/${randomUUID()}.${ext}`;

  const buffer = Buffer.from(base64Data, "base64");
  const bucket = getBucket();
  const cdnBase = getCdnBase();

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return `${cdnBase}/${key}`;
}

/**
 * Delete a photo from S3 by its CloudFront CDN URL.
 * Silently ignores errors (e.g. already deleted).
 */
export async function deleteFromS3(cdnUrl: string): Promise<void> {
  try {
    const cdnBase = getCdnBase();
    const key = cdnUrl.replace(`${cdnBase}/`, "");
    if (!key || key === cdnUrl) return;

    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: getBucket(),
        Key: key,
      }),
    );
  } catch (err) {
    console.error("[S3] deleteFromS3 failed:", err);
  }
}
