import { requireUser, requireOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { failure, HttpError } from "@/lib/http";
import { z } from "zod";
export async function POST(r: Request) {
  try {
    requireOrigin(r);
    const u = await requireUser();
    const p = z
      .object({ name: z.string().trim().min(1).max(80) })
      .strict()
      .safeParse(await r.json());
    if (!p.success) throw new HttpError(400, "Nom invalide.");
    await db().query(
      "insert into platform.profiles(user_id,display_name) values($1,$2) on conflict(user_id) do update set display_name=excluded.display_name",
      [u.id, p.data.name],
    );
    return Response.json({ saved: true });
  } catch (e) {
    return failure(e);
  }
}
