import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { failure, HttpError } from "@/lib/http";
import { fileResponse } from "@/lib/media-store";
import { ownedVideoKey } from "@/lib/montage";

export async function GET(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new HttpError(400, "Identifiant invalide.");
    const key = await ownedVideoKey(user.id, "montage", id);
    if (!key) throw new HttpError(404, "Vidéo introuvable.");
    return fileResponse(r, key, `videoeasy-montage-${id.slice(0, 8)}.mp4`);
  } catch (e) {
    return failure(e);
  }
}
