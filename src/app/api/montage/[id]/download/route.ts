import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { failure, HttpError } from "@/lib/http";
import { signedUrl } from "@/lib/media-store";
import { ownedVideoKey } from "@/lib/montage";

export async function GET(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new HttpError(400, "Identifiant invalide.");
    const key = await ownedVideoKey(user.id, "montage", id);
    if (!key) throw new HttpError(404, "Vidéo introuvable.");
    const inline = new URL(r.url).searchParams.get("view") === "1";
    return Response.redirect(await signedUrl(key, !inline), 303);
  } catch (e) {
    return failure(e);
  }
}
