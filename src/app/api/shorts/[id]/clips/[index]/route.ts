import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { failure, HttpError } from "@/lib/http";
import { signedUrl } from "@/lib/media-store";
import { clipKey } from "@/lib/shorts";

export async function GET(
  r: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  try {
    const user = await requireUser();
    const { id, index } = await params;
    const n = Number(index);
    if (!z.uuid().safeParse(id).success || !Number.isInteger(n) || n < 0 || n > 9)
      throw new HttpError(400, "Identifiant invalide.");
    const key = await clipKey(user.id, id, n);
    if (!key) throw new HttpError(404, "Short introuvable.");
    const inline = new URL(r.url).searchParams.get("view") === "1";
    return Response.redirect(await signedUrl(key, !inline), 303);
  } catch (e) {
    return failure(e);
  }
}
