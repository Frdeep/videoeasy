import "server-only";
import { engineReadUrl } from "./media-store";

// Background delivery for short transfers: the file is copied to Litterbox
// (catbox.moe's temporary host, auto-deleted after 1–72 h). Customers only see
// VideoEasy. Any failure returns null and the transfer is served from our
// own storage instead.
const API = "https://litterbox.catbox.moe/resources/internals/api.php";
const MAX = 200 * 1024 * 1024; // keep within the function's memory and time

export async function toLitterbox(key: string, name: string, hours: 24 | 72) {
  try {
    const src = await fetch(await engineReadUrl(key), { signal: AbortSignal.timeout(25000) });
    if (!src.ok) return null;
    if (Number(src.headers.get("content-length") ?? 0) > MAX) return null;
    const bytes = await src.arrayBuffer();
    if (bytes.byteLength > MAX) return null;
    const form = new FormData();
    form.set("reqtype", "fileupload");
    form.set("time", `${hours}h`);
    form.set("fileToUpload", new Blob([bytes], { type: "video/mp4" }), name);
    const r = await fetch(API, { method: "POST", body: form, signal: AbortSignal.timeout(28000) });
    const url = (await r.text()).trim();
    return r.ok && /^https:\/\/litter\.catbox\.moe\/[A-Za-z0-9]+\.mp4$/.test(url) ? url : null;
  } catch {
    return null;
  }
}
