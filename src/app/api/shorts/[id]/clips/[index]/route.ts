import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { failure, HttpError } from "@/lib/http";
import { fileResponse } from "@/lib/media-store";
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
    return fileResponse(r, key, `videoeasy-short-${id.slice(0, 8)}-${n + 1}.mp4`);
  } catch (e) {
    return failure(e);
  }
}
