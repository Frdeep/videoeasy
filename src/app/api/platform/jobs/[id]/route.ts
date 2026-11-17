import { requireUser, requireOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { failure, HttpError } from "@/lib/http";
import { z } from "zod";
export async function DELETE(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireOrigin(r);
    const u = await requireUser();
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new HttpError(400, "Identifiant invalide.");
    const result = await db().query(
      "update platform.jobs set deleted_at=now() where id=$1 and user_id=$2 and status in ('succeeded','failed') and deleted_at is null returning id",
      [id, u.id],
    );
    if (!result.rowCount)
      throw new HttpError(404, "Création absente ou encore en cours.");
    return Response.json({ deleted: true });
  } catch (e) {
    return failure(e);
  }
}
