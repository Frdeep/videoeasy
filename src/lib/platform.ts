import "server-only";
import { z } from "zod";
import { db, withUserLock, transaction } from "./db";
import { HttpError } from "./http";
export const jobInput = z
  .object({
    id: z.uuid(),
    model: z.string().min(1).max(100),
    prompt: z.string().trim().min(3).max(2500),
  })
  .strict();
export function isAdmin(userId: string) {
  return (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}
export function requireAdmin(userId: string) {
  if (!isAdmin(userId))
    throw new HttpError(403, "Accès administrateur refusé.");
}
export async function createJob(
  userId: string,
  input: z.infer<typeof jobInput>,
) {
  return withUserLock(userId, (c) =>
    transaction(c, async () => {
      const existing = await c.query(
        "select id,user_id,model_id,prompt from platform.jobs where id=$1",
        [input.id],
      );
      if (existing.rowCount) {
        const j = existing.rows[0];
        if (
          j.user_id !== userId ||
          j.model_id !== input.model ||
          j.prompt !== input.prompt
        )
          throw new HttpError(409, "Identifiant de demande déjà utilisé.");
        return j.id;
      }
      const profile = await c.query(
        "select suspended from platform.profiles where user_id=$1",
        [userId],
      );
      if (profile.rows[0]?.suspended)
        throw new HttpError(403, "Compte suspendu.");
      const {
        rows: [model],
      } = await c.query(
        "select * from platform.models where id=$1 and enabled for share",
        [input.model],
      );
      if (!model) throw new HttpError(409, "Modèle indisponible.");
      if (
        model.provider !== "mock" ||
        process.env.GENERATION_PROVIDER !== "mock" ||
        process.env.APP_ENV !== "test"
      )
        throw new HttpError(409, "Génération fournisseur non activée.");
      const {
        rows: [sub],
      } = await c.query(
        "select plan from billing.subscriptions where user_id=$1 and status='active' order by period_start desc limit 1",
        [userId],
      );
      if (!sub || !model.allowed_plans.includes(sub.plan))
        throw new HttpError(403, "Formule incompatible avec ce modèle.");
      await c.query("select billing.reserve_credits($1,$2,$3)", [
        userId,
        input.id,
        model.credits,
      ]);
      await c.query(
        "insert into platform.jobs(id,user_id,model_id,prompt,credits,provider,status) values($1,$2,$3,$4,$5,$6,'queued')",
        [
          input.id,
          userId,
          model.id,
          input.prompt,
          model.credits,
          model.provider,
        ],
      );
      return input.id;
    }),
  );
}
// A test-only worker. No live provider request is made. Running jobs left by a crash
// require operator inspection; they are never silently retried or refunded.
export async function workOne() {
  if (
    process.env.APP_ENV !== "test" ||
    process.env.GENERATION_PROVIDER !== "mock"
  )
    throw new Error("Test worker disabled");
  const c = await db().connect();
  let job;
  try {
    job = await transaction(c, async () => {
      const {
        rows: [j],
      } = await c.query(
        "select * from platform.jobs where status='queued' and provider='mock' order by created_at for update skip locked limit 1",
      );
      if (j)
        await c.query("update platform.jobs set status='running' where id=$1", [
          j.id,
        ]);
      return j;
    });
  } finally {
    c.release();
  }
  if (!job) return false;
  await withUserLock(job.user_id, (c) =>
    transaction(c, async () => {
      const failed = job.prompt.startsWith("[test-failure]");
      await c.query("select billing.settle_reservation($1,$2,$3)", [
        job.user_id,
        job.id,
        !failed,
      ]);
      await c.query(
        "update platform.jobs set status=$2,mock_result=$3,finished_at=now() where id=$1",
        [job.id, failed ? "failed" : "succeeded", !failed],
      );
    }),
  );
  return true;
}
export async function adjustCredits(
  actor: string,
  target: string,
  requestId: string,
  delta: number,
  reason: string,
) {
  requireAdmin(actor);
  if (
    !Number.isInteger(delta) ||
    delta === 0 ||
    Math.abs(delta) > 100000 ||
    reason.trim().length < 5
  )
    throw new HttpError(400, "Ajustement invalide.");
  return withUserLock(target, (c) =>
    transaction(c, async () => {
      const {
        rows: [prior],
      } = await c.query("select * from platform.audit where request_id=$1", [
        requestId,
      ]);
      if (prior) {
        if (
          prior.actor !== actor ||
          prior.target !== target ||
          prior.delta !== delta ||
          prior.reason !== reason
        )
          throw new HttpError(409, "Opération déjà utilisée.");
        return;
      }
      const {
        rows: [grant],
      } = await c.query(
        "select g.* from billing.credit_grants g join billing.subscriptions s on s.id=g.subscription_id where g.user_id=$1 and s.status='active' and g.period_start=s.period_start and g.period_end=s.period_end and g.period_start<=extract(epoch from now()) and g.period_end>extract(epoch from now()) order by g.period_start desc limit 1 for update of g",
        [target],
      );
      if (!grant || grant.remaining + delta < 0 || grant.credits + delta <= 0)
        throw new HttpError(409, "Solde ou période incompatible.");
      await c.query(
        "update billing.credit_grants set remaining=remaining+$2,credits=credits+$2 where invoice_id=$1",
        [grant.invoice_id, delta],
      );
      await c.query(
        "insert into billing.credit_movements(user_id,invoice_id,kind,credits) values($1,$2,'admin_adjust',$3)",
        [target, grant.invoice_id, delta],
      );
      await c.query(
        "insert into platform.audit(actor,action,target,reason,request_id,delta) values($1,'credits',$2,$3,$4,$5)",
        [actor, target, reason, requestId, delta],
      );
    }),
  );
}
