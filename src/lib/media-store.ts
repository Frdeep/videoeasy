import "server-only";
import { env } from "./config";
import { HF_PREFIX, hfConfigured, hfDelete, hfPut, hfSignedUrl } from "./hf-storage";

// Private Supabase Storage bucket `media` (public=false, 200 MB, video/image
// MIME allow-list). Server-only secret key; object keys are generated here.
const BUCKET = "media";
export const MAX_BYTES = 200 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export class MediaError extends Error {
  constructor(public code: string) {
    super(`media_${code}`);
  }
}

function storageBase() {
  return `${new URL(env("NEXT_PUBLIC_SUPABASE_URL")).origin}/storage/v1`;
}
function authHeaders() {
  const key = env("SUPABASE_SECRET_KEY");
  return { apikey: key, Authorization: `Bearer ${key}` };
}

/** Rejects anything but plain public https URLs (no credentials, IP literals, odd ports). */
export function assertSafeUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new MediaError("bad_url");
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    /^[\d.]+$/.test(host) ||
    host.includes(":") ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    !host.includes(".")
  )
    throw new MediaError("unsafe_url");
  return url;
}

/** Checks the real file signature, not only the announced Content-Type. */
export function sniff(bytes: Uint8Array): string | null {
  const ascii = (a: number, b: number) =>
    String.fromCharCode(...bytes.subarray(a, b));
  if (bytes.length >= 12 && ascii(4, 8) === "ftyp")
    return ascii(8, 10) === "qt" ? "video/quicktime" : "video/mp4";
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  )
    return "video/webm";
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(1, 4) === "PNG")
    return "image/png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
    return "image/webp";
  return null;
}

async function download(source: string) {
  let url = assertSafeUrl(source);
  let response: Response | undefined;
  for (let hop = 0; hop < 4; hop++) {
    response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(45000),
      cache: "no-store",
    });
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      if (!next) throw new MediaError("bad_redirect");
      url = assertSafeUrl(new URL(next, url).toString());
      continue;
    }
    break;
  }
  if (!response || !response.ok || !response.body)
    throw new MediaError(`fetch_${response?.status ?? "none"}`);
  const declared = Number(response.headers.get("content-length"));
  if (declared > MAX_BYTES) throw new MediaError("too_large");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new MediaError("too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return bytes;
}

/** Downloads a provider result and stores it privately. Returns key, type and size. */
export async function importResult(
  userId: string,
  jobId: string,
  source: string,
) {
  const bytes = await download(source);
  const contentType = sniff(bytes);
  if (!contentType || !ALLOWED[contentType]) throw new MediaError("bad_type");
  const key = `${userId}/${jobId}.${ALLOWED[contentType]}`;
  if (hfConfigured())
    return {
      key: await hfPut(key, bytes, contentType),
      contentType,
      size: bytes.byteLength,
    };
  const response = await fetch(`${storageBase()}/object/${BUCKET}/${key}`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": contentType,
      "x-upsert": "true",
      "cache-control": "private, max-age=0",
    },
    body: bytes,
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new MediaError(`upload_${response.status}`);
  return { key, contentType, size: bytes.byteLength };
}

/** Short-lived signed URL for an ownership-checked object key: 60 s to download,
 * 15 min for in-page playback (video seeking re-requests the same URL). */
export async function signedUrl(key: string, download = true) {
  if (key.startsWith(HF_PREFIX)) return hfSignedUrl(key, download);
  const response = await fetch(
    `${storageBase()}/object/sign/${BUCKET}/${key}`,
    {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: download ? 60 : 900 }),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new MediaError(`sign_${response.status}`);
  const { signedURL } = (await response.json()) as { signedURL?: string };
  if (!signedURL) throw new MediaError("sign_empty");
  const url = new URL(`${storageBase()}${signedURL}`);
  if (download) url.searchParams.set("download", "");
  return url.toString();
}

/** Signed URL letting the browser PUT one file straight into the private
 * bucket (Vercel bodies are capped at 4.5 MB). Valid 2 h, single key. */
export async function signedUploadUrl(key: string) {
  const response = await fetch(
    `${storageBase()}/object/upload/sign/${BUCKET}/${key}`,
    {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new MediaError(`upsign_${response.status}`);
  const { url } = (await response.json()) as { url?: string };
  if (!url) throw new MediaError("upsign_empty");
  return `${storageBase()}${url}`;
}

/** Size and MIME type of a stored object, or null when it does not exist. */
export async function objectInfo(key: string) {
  const response = await fetch(
    `${storageBase()}/object/info/${BUCKET}/${key}`,
    {
      headers: authHeaders(),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    },
  );
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new MediaError(`info_${response.status}`);
  const info = (await response.json()) as {
    size?: number;
    content_type?: string;
    metadata?: { size?: number; mimetype?: string };
  };
  return {
    size: Number(info.size ?? info.metadata?.size ?? 0),
    contentType: info.content_type ?? info.metadata?.mimetype ?? "",
  };
}

/** Long-lived (2 h) read URL handed to the editing/shorts engine only. */
export async function engineReadUrl(key: string) {
  if (key.startsWith(HF_PREFIX)) return hfSignedUrl(key, false, 7200);
  const response = await fetch(
    `${storageBase()}/object/sign/${BUCKET}/${key}`,
    {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 7200 }),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new MediaError(`sign_${response.status}`);
  const { signedURL } = (await response.json()) as { signedURL?: string };
  if (!signedURL) throw new MediaError("sign_empty");
  return `${storageBase()}${signedURL}`;
}

/** Stores bytes (Hugging Face when configured) and returns the key to save. */
export async function storeBytes(
  key: string,
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
) {
  if (hfConfigured()) return hfPut(key, bytes, contentType);
  const response = await fetch(`${storageBase()}/object/${BUCKET}/${key}`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": contentType,
      "x-upsert": "true",
      "cache-control": "private, max-age=0",
    },
    body: bytes,
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new MediaError(`upload_${response.status}`);
  return key;
}

export async function deleteObject(key: string) {
  if (key.startsWith(HF_PREFIX)) return hfDelete(key);
  await fetch(`${storageBase()}/object/${BUCKET}`, {
    method: "DELETE",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [key] }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {});
}
