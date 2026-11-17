import { requireUser, requireOrigin } from "@/lib/auth";
import { db, withUserLock, transaction } from "@/lib/db";
import { failure, HttpError } from "@/lib/http";
import { requireAdmin, adjustCredits } from "@/lib/platform";
import { z } from "zod";
const input = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("credits"),
      id: z.uuid(),
      requestId: z.uuid(),
      delta: z.number().int().min(-100000).max(100000),
      reason: z.string().trim().min(5).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("model"),
      id: z.string().max(100),
      enabled: z.boolean(),
      allowedPlans: z
        .array(z.enum(["standard", "metal", "gold"]))
        .min(1)
        .max(3),
      credits: z.number().int().min(1).max(100000),
      reason: z.string().trim().min(5).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal("suspend"),
      id: z.uuid(),
      suspended: z.boolean(),
      reason: z.string().trim().min(5).max(500),
    })
    .strict(),
]);
export async function GET() {
  try {
    const u = await requireUser();
    requireAdmin(u.id);
    const models = await db().query(
      "select * from platform.models order by name",
    );
    const jobs = await db().query(
      "select id,user_id,model_id,credits,status,created_at from platform.jobs order by created_at desc limit 100",
    );
    const profiles = await db().query(
      "select u.id as user_id,u.email,coalesce(p.display_name,'') as display_name,coalesce(p.suspended,false) as suspended from auth.users u left join platform.profiles p on p.user_id=u.id order by u.created_at desc limit 100",
    );
    const audit = await db().query(
      "select * from platform.audit order by created_at desc limit 100",
    );
    return Response.json(
      {
        models: models.rows,
        jobs: jobs.rows,
        profiles: profiles.rows,
        audit: audit.rows,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(r: Request) {
  try {
    requireOrigin(r);
    const u = await requireUser();
    requireAdmin(u.id);
    const p = input.safeParse(await r.json());
    if (!p.success) throw new HttpError(400, "Modification invalide.");
    const v = p.data;
    if (v.action === "credits") {
      await adjustCredits(u.id, v.id, v.requestId, v.delta, v.reason);
      return Response.json({ saved: true });
    }
    await withUserLock(v.action === "suspend" ? v.id : u.id, (c) =>
      transaction(c, async () => {
        if (v.action === "model") {
          const result = await c.query(
            "update platform.models set enabled=$2,credits=$3,allowed_plans=$4,updated_at=now() where id=$1 returning id",
            [v.id, v.enabled, v.credits, v.allowedPlans],
          );
          if (!result.rowCount) throw new HttpError(404, "Modèle introuvable.");
        } else
          await c.query(
            "insert into platform.profiles(user_id,suspended) values($1,$2) on conflict(user_id) do update set suspended=excluded.suspended",
            [v.id, v.suspended],
          );
        await c.query(
          "insert into platform.audit(actor,action,target,reason) values($1,$2,$3,$4)",
          [u.id, v.action, v.id, v.reason],
        );
      }),
    );
    return Response.json({ saved: true });
  } catch (e) {
    return failure(e);
  }
}
