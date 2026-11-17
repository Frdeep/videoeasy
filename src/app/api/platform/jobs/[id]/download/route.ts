import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { failure, HttpError } from "@/lib/http";
import { signedUrl } from "@/lib/media-store";
import { z } from "zod";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const u = await requireUser();
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new HttpError(400, "Identifiant invalide.");
    const {
      rows: [j],
    } = await db().query(
      "select object_key,mock_result,provider from platform.jobs where id=$1 and user_id=$2 and status='succeeded' and deleted_at is null",
      [id, u.id],
    );
    if (!j) throw new HttpError(404, "Création introuvable.");
    if (j.mock_result)
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#181818"/><text x="80" y="360" font-size="48" fill="white">VIDEOEASY — TEST TECHNIQUE SIMULÉ</text></svg>',
        {
          headers: {
            "Content-Type": "image/svg+xml",
            "Content-Disposition": 'attachment; filename="videoeasy-test.svg"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    if (!j.object_key) throw new HttpError(409, "Fichier non disponible.");
    const inline = new URL(_.url).searchParams.get("view") === "1";
    return Response.redirect(await signedUrl(j.object_key, !inline), 303);
  } catch (e) {
    return failure(e);
  }
}
