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

const schedule = z
  .object({
    scheduledAt: z.iso.datetime({ offset: true }).nullable(),
    channel: z
      .enum(["tiktok", "instagram", "youtube", "facebook", "linkedin", "autre"])
      .nullable()
      .optional(),
    note: z.string().trim().max(280).nullable().optional(),
  })
  .strict();

// Place (or remove) a finished video in the owner's personal calendar.
export async function PATCH(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireOrigin(r);
    const u = await requireUser();
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new HttpError(400, "Identifiant invalide.");
    const body = schedule.safeParse(await r.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Date invalide.");
    const { scheduledAt, channel, note } = body.data;
    const result = await db().query(
      `update platform.jobs set scheduled_at=$3, schedule_channel=$4, schedule_note=$5
       where id=$1 and user_id=$2 and status='succeeded' and deleted_at is null returning id`,
      [
        id,
        u.id,
        scheduledAt,
        scheduledAt ? (channel ?? null) : null,
        scheduledAt ? note || null : null,
      ],
    );
    if (!result.rowCount) throw new HttpError(404, "Vidéo introuvable.");
    return Response.json({ scheduled: !!scheduledAt });
  } catch (e) {
    return failure(e);
  }
}
