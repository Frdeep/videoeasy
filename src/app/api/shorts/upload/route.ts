import { requireOrigin, requireUser } from "@/lib/auth";
import { failure, HttpError } from "@/lib/http";
import { startUpload, uploadInput } from "@/lib/shorts";

export const runtime = "nodejs";

export async function POST(r: Request) {
  try {
    requireOrigin(r);
    const user = await requireUser();
    const body = uploadInput.safeParse(await r.json().catch(() => null));
    if (!body.success)
      throw new HttpError(400, "Fichier refusé : MP4, MOV ou WebM, 200 Mo maximum.");
    return Response.json(await startUpload(user.id, body.data));
  } catch (e) {
    return failure(e);
  }
}
