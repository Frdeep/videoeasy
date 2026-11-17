import { failure, HttpError } from "@/lib/http";
import { fileResponse } from "@/lib/media-store";
import { countDownload, liveTransfer } from "@/lib/transfers";

// Public, token-gated file access for a transfer link. No account needed.
export async function GET(r: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const t = await liveTransfer(token);
    if (!t) throw new HttpError(404, "Lien expiré ou introuvable.");
    if (new URL(r.url).searchParams.get("view") !== "1") await countDownload(token);
    return fileResponse(r, t.object_key, t.file_name);
  } catch (e) {
    return failure(e);
  }
}
