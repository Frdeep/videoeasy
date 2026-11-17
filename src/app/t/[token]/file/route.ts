import { failure, HttpError } from "@/lib/http";
import { signedUrl } from "@/lib/media-store";
import { countDownload, liveTransfer } from "@/lib/transfers";

// Public, token-gated file access for a transfer link. No account needed.
export async function GET(r: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const t = await liveTransfer(token);
    if (!t) throw new HttpError(404, "Lien expiré ou introuvable.");
    const inline = new URL(r.url).searchParams.get("view") === "1";
    if (!inline) await countDownload(token);
    return Response.redirect(await signedUrl(t.object_key, !inline), 303);
  } catch (e) {
    return failure(e);
  }
}
