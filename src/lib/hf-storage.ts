import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Customer media on a private Hugging Face Storage Bucket (100 GB free on
// the Noamcix account) through its S3-compatible gateway.
// Env: HF_S3_ENDPOINT (https://<namespace>.s3.hf.co), HF_S3_BUCKET,
//      HF_S3_ACCESS_KEY_ID (HFAK…), HF_S3_SECRET_ACCESS_KEY.
// Keys stored in the database carry the "hf:" prefix so older Supabase
// objects keep working.

export const HF_PREFIX = "hf:";

export function hfConfigured() {
  return Boolean(
    process.env.HF_S3_ENDPOINT &&
      process.env.HF_S3_BUCKET &&
      process.env.HF_S3_ACCESS_KEY_ID &&
      process.env.HF_S3_SECRET_ACCESS_KEY,
  );
}

let client: S3Client | undefined;
function s3() {
  return (client ??= new S3Client({
    endpoint: process.env.HF_S3_ENDPOINT,
    region: "us-east-1",
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: process.env.HF_S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.HF_S3_SECRET_ACCESS_KEY!,
    },
  }));
}
const bucket = () => process.env.HF_S3_BUCKET!;
const strip = (key: string) => key.slice(HF_PREFIX.length);

/** Stores bytes and returns the prefixed key to save in the database. */
export async function hfPut(key: string, bytes: Uint8Array, contentType: string) {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: bytes,
      ContentType: contentType,
      ContentLength: bytes.byteLength,
    }),
  );
  return HF_PREFIX + key;
}

/** Short-lived signed link: 60 s to download, 15 min for in-page playback
 * (or a custom lifetime, e.g. 2 h for the editing engine). */
export async function hfSignedUrl(prefixedKey: string, download = true, expiresIn?: number) {
  const key = strip(prefixedKey);
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: download
        ? `attachment; filename="${key.split("/").pop()}"`
        : undefined,
    }),
    { expiresIn: expiresIn ?? (download ? 60 : 900) },
  );
}

export async function hfDelete(prefixedKey: string) {
  await s3()
    .send(new DeleteObjectCommand({ Bucket: bucket(), Key: strip(prefixedKey) }))
    .catch(() => {});
}

/** Presigned PUT for a trusted uploader (the YouTube relay). 2 h. */
export async function hfSignedPut(key: string, contentType: string) {
  return {
    url: await getSignedUrl(
      s3(),
      new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
      { expiresIn: 7200 },
    ),
    key: HF_PREFIX + key,
  };
}

/** Size of an uploaded object, or null when it does not exist. */
export async function hfSize(prefixedKey: string) {
  try {
    const r = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: strip(prefixedKey) }));
    return Number(r.ContentLength ?? 0);
  } catch {
    return null;
  }
}
