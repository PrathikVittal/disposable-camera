import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";
import { randomUUID } from "crypto";

function getS3Config() {
  const region = process.env.REGION;
  const accessKeyId = process.env.ACCESS_KEY_ID;
  const secretAccessKey = process.env.SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET_NAME;
  const cfDomain = process.env.CLOUDFRONT_DOMAIN;

  if (!region || !accessKeyId || !secretAccessKey || !bucket || !cfDomain) {
    const missing = [
      !region && "REGION",
      !accessKeyId && "ACCESS_KEY_ID",
      !secretAccessKey && "SECRET_ACCESS_KEY",
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
    // The AWS SDK's default integrity checksums (added in newer v3 releases)
    // throw "input must be ArrayBuffer (got SharedArrayBuffer)" on the Amplify
    // Lambda runtime. We don't need request/response CRC32, so only compute it
    // when an operation strictly requires it.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
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

/** Build the public CloudFront URL for a given S3 object key. */
export function cdnUrlForKey(key: string): string {
  return `${getCdnBase()}/${key}`;
}

/**
 * Create a short-lived presigned PUT URL so the browser can upload an object
 * directly to S3 (used for full-resolution guest photo originals). The client
 * must send the matching `Content-Type` header on its PUT request.
 */
export async function getPresignedPutUrl(
  key: string,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getS3Client(), command, { expiresIn: 300 });
}

/**
 * Download an S3 object's bytes (used server-side to derive thumbnails).
 *
 * We collect the stream chunks manually rather than using
 * `transformToByteArray()`: on some Lambda runtimes that returns a
 * SharedArrayBuffer-backed array, which `sharp` rejects ("input must be
 * ArrayBuffer"). `Buffer.concat` always yields a normally-allocated Buffer.
 */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const res = await getS3Client().send(
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
  );
  if (!res.Body) throw new Error(`S3 object has no body: ${key}`);

  const body = res.Body as unknown;
  const chunks: Buffer[] = [];

  // Web ReadableStream (some Lambda/edge runtimes return this).
  if (body && typeof (body as ReadableStream).getReader === "function") {
    const reader = (body as ReadableStream<Uint8Array>).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value)); // copy → normal ArrayBuffer
    }
    return Buffer.concat(chunks);
  }

  // Node Readable. Buffer.from() copies each chunk so the result is never
  // backed by a SharedArrayBuffer (which sharp rejects).
  for await (const chunk of body as Readable) {
    chunks.push(Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

/** Upload a raw buffer to a known key and return its CloudFront URL. */
export async function uploadBufferToS3(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return cdnUrlForKey(key);
}

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
