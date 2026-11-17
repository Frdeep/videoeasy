import { failure, HttpError } from "@/lib/http";
import { fileResponse } from "@/lib/media-store";
import { countDownload, liveTransfer } from "@/lib/transfers";

// Public, token-gated file access for a transfer link. No account needed.
export async function GET(r: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const t = await liveTransfer(token);
    if (!t) throw new HttpError(404, "Lien expiré ou introuvable.");
    const q = new URL(r.url).searchParams;
    if (q.get("view") !== "1") await countDownload(token);
    // Downloads of short transfers come from the background host (Litterbox);
    // in-page playback always streams from our own storage.
    if (t.external_url && q.get("view") !== "1")
      return q.get("format") === "url"
        ? Response.json({ url: t.external_url, name: t.file_name }, { headers: { "Cache-Control": "no-store" } })
        : Response.redirect(t.external_url, 303);
    return fileResponse(r, t.object_key, t.file_name);
  } catch (e) {
    return failure(e);
  }
}
