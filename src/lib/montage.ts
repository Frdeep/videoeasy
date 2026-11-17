import "server-only";
import { z } from "zod";
import { db, withUserLock } from "./db";
import { HttpError } from "./http";
import { engineReadUrl, MAX_BYTES, storeBytes } from "./media-store";
import { engine } from "./shorts";

// Montage = assemble one or more finished videos of the user (trim, order,
// cut or crossfade, optional text) on the external engine (Modal). Same
// lifecycle as shorts: processing ──engine ok──▶ importing ──▶ succeeded,
// otherwise failed. 5 free montages per account (failures not counted), then
// an active subscription (30 per day). One montage at a time.

export const FREE_MONTAGES = 5;
const DAILY = 30;
const CHECK_EVERY_SECONDS = 6;
const IMPORT_LEASE_MINUTES = 5;

export const montageInput = z
  .object({
    id: z.uuid(),
    sources: z
      .array(
        z
          .object({
            kind: z.enum(["job", "montage"]),
            id: z.uuid(),
            start: z.number().min(0).max(600),
            end: z.number().min(0).max(600),
          })
          .strict(),
      )
      .min(1)
      .max(10),
    ratio: z.enum(["9:16", "16:9", "1:1"]),
    text: z.string().trim().max(200),
    transition: z.enum(["cut", "fade"]),
  })
  .strict();

type Row = {
  id: string;
  user_id: string;
  status: string;
  object_key: string | null;
  created_at: string;
};

async function subscribed(userId: string) {
  const { rowCount } = await db().query(
    "select 1 from billing.subscriptions where user_id=$1 and status='active' limit 1",
    [userId],
  );
  return Boolean(rowCount);
}

export async function montageQuota(userId: string) {
  const [{ rows }, sub] = await Promise.all([
    db().query<{ n: number }>(
      "select count(*)::int as n from platform.montages where user_id=$1 and free and status <> 'failed'",
      [userId],
    ),
    subscribed(userId),
  ]);
  return { freeUsed: rows[0].n, freeLimit: FREE_MONTAGES, subscribed: sub };
}

/** Object key of a finished video the user owns (generation or montage). */
export async function ownedVideoKey(userId: string, kind: "job" | "montage", id: string) {
  const sql =
    kind === "job"
      ? "select object_key from platform.jobs where id=$1 and user_id=$2 and status='succeeded' and deleted_at is null and object_key is not null and coalesce(content_type,'video/mp4') like 'video/%'"
      : "select object_key from platform.montages where id=$1 and user_id=$2 and status='succeeded' and deleted_at is null and object_key is not null";
  const { rows } = await db().query<{ object_key: string }>(sql, [id, userId]);
  return rows[0]?.object_key ?? null;
}

export async function createMontage(userId: string, input: z.infer<typeof montageInput>) {
  const sub = await subscribed(userId);
  const clips: { url: string; start: number; end: number }[] = [];
  for (const s of input.sources) {
    const key = await ownedVideoKey(userId, s.kind, s.id);
    if (!key) throw new HttpError(404, "Vidéo introuvable.");
    clips.push({ url: await engineReadUrl(key), start: s.start, end: s.end });
  }
  const created = await withUserLock(userId, async (c) => {
    const { rows: [existing] } = await c.query<{ user_id: string }>(
      "select user_id from platform.montages where id=$1",
      [input.id],
    );
    if (existing) {
      if (existing.user_id !== userId) throw new HttpError(409, "Cette demande existe déjà.");
      return false; // idempotent replay
    }
    const { rows: [stats] } = await c.query<{ active: number; today: number; free: number }>(
      `select count(*) filter (where status in ('processing','importing') and engine_state is distinct from 'editor_upload')::int as active,
              count(*) filter (where created_at > now() - interval '1 day')::int as today,
              count(*) filter (where free and status <> 'failed')::int as free
       from platform.montages where user_id=$1`,
      [userId],
    );
    if (stats.active > 0)
      throw new HttpError(409, "Un montage est déjà en cours. Attendez qu’il se termine.");
    if (!sub && stats.free >= FREE_MONTAGES)
      throw new HttpError(402, "Vos 5 montages gratuits sont utilisés. Abonnez-vous pour continuer.");
    if (sub && stats.today >= DAILY)
      throw new HttpError(429, "Limite quotidienne atteinte. Revenez demain.");
    await c.query(
      `insert into platform.montages(id,user_id,sources,options,free,engine_state)
       values($1,$2,$3,$4,$5,'submitting')`,
      [
        input.id,
        userId,
        JSON.stringify(input.sources),
        JSON.stringify({ ratio: input.ratio, text: input.text, transition: input.transition }),
        !sub,
      ],
    );
    return true;
  });
  if (!created) return;
  let response: Response;
  try {
    response = await engine("/v1/montage", {
      method: "POST",
      body: JSON.stringify({
        job_id: input.id,
        clips,
        ratio: input.ratio,
        text: input.text,
        transition: input.transition,
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    return; // unknown outcome: polling reconciles (404 → failed)
  }
  if (!response.ok) await fail(input.id, `engine_${response.status}`);
}

async function fail(id: string, code: string) {
  await db().query(
    "update platform.montages set status='failed', error_code=$2, finished_at=now() where id=$1 and status in ('processing','importing')",
    [id, code.slice(0, 80)],
  );
}

export async function advanceMontages(userId: string) {
  // Editor uploads never finished (tab closed) are dropped after 2 h.
  await db().query(
    "update platform.montages set status='failed', error_code='upload_abandoned', finished_at=now() where user_id=$1 and status='processing' and engine_state='editor_upload' and created_at < now() - interval '2 hours'",
    [userId],
  );
  const { rows } = await db().query<Row>(
    `select id,user_id,status,object_key,created_at from platform.montages where user_id=$1 and deleted_at is null and (
       (status='processing' and engine_state is distinct from 'editor_upload' and checked_at < now() - make_interval(secs => $2))
       or (status='importing' and import_started_at < now() - make_interval(mins => $3)))`,
    [userId, CHECK_EVERY_SECONDS, IMPORT_LEASE_MINUTES],
  );
  for (const row of rows) {
    try {
      if (row.status === "importing") await importResult(row);
      else await check(row);
    } catch (e) {
      console.error("montage_advance_failed", row.id, (e as Error).message?.slice(0, 80));
    }
  }
}

async function check(row: Row) {
  const { rowCount } = await db().query(
    "update platform.montages set checked_at=now() where id=$1 and status='processing' and checked_at < now() - make_interval(secs => $2)",
    [row.id, CHECK_EVERY_SECONDS],
  );
  if (!rowCount) return;
  const response = await engine(`/v1/jobs/${row.id}`, { signal: AbortSignal.timeout(10000) });
  if (response.status === 404) {
    if (Date.now() - new Date(row.created_at).getTime() > 2 * 60_000)
      await fail(row.id, "engine_lost");
    return;
  }
  if (!response.ok) return;
  const job = (await response.json()) as { status: string; error?: string; clips?: { end: number }[] };
  if (job.status === "failed") return fail(row.id, job.error ?? "engine_failed");
  if (job.status !== "succeeded") {
    await db().query(
      "update platform.montages set engine_state=$2 where id=$1 and status='processing'",
      [row.id, job.status.slice(0, 40)],
    );
    return;
  }
  const claimed = await db().query(
    "update platform.montages set status='importing', engine_state='importing', duration=$2, import_started_at=now() where id=$1 and status='processing'",
    [row.id, job.clips?.[0]?.end ?? null],
  );
  if (claimed.rowCount) await importResult(row);
}

async function importResult(row: Row) {
  await db().query(
    "update platform.montages set import_started_at=now() where id=$1 and status='importing'",
    [row.id],
  );
  const response = await engine(`/v1/jobs/${row.id}/clips/0`, { signal: AbortSignal.timeout(45000) });
  if (response.status === 404) return fail(row.id, "engine_lost");
  if (!response.ok) throw new Error(`clip_${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) return fail(row.id, "too_large");
  const key = await storeBytes(`${row.user_id}/montages/${row.id}.mp4`, bytes, "video/mp4");
  await db().query(
    "update platform.montages set status='succeeded', engine_state='stored', object_key=$2, finished_at=now() where id=$1 and status='importing'",
    [row.id, key],
  );
}

export async function listMontages(userId: string) {
  const { rows } = await db().query(
    `select id,status,engine_state,options,duration,error_code,created_at,finished_at
     from platform.montages where user_id=$1 and deleted_at is null order by created_at desc limit 50`,
    [userId],
  );
  return rows;
}
