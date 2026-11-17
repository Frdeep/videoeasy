import "server-only";
import { z } from "zod";
import { env } from "./config";
import { db, transaction, withUserLock } from "./db";
import { HttpError } from "./http";
import {
  deleteObject,
  engineReadUrl,
  MAX_BYTES,
  objectInfo,
  signedUploadUrl,
  storeBytes,
} from "./media-store";

// Long video -> shorts through the external engine (services/shorts-engine on
// Modal). Lifecycle, all in PostgreSQL, every transition conditional:
//
//   uploading ──launch──▶ processing ──engine ok──▶ importing ──▶ succeeded
//        │                     └ engine failed / lost ──────────▶ failed
//        └ never launched (abandoned upload) — ignored after 2 h
//
// Quota: 5 free runs per account (failed runs are not counted), then an active
// subscription is required (20 runs per day). One run at a time per account.

export const FREE_RUNS = 5;
const DAILY_RUNS = 20;
const CHECK_EVERY_SECONDS = 8;
const IMPORT_LEASE_MINUTES = 5;
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

export const uploadInput = z
  .object({
    id: z.uuid(),
    bytes: z.number().int().positive().max(MAX_BYTES),
    type: z.enum(VIDEO_TYPES),
  })
  .strict();

export const launchInput = z
  .object({
    count: z.union([z.literal(3), z.literal(5), z.literal(10)]),
    length: z.union([
      z.literal(15),
      z.literal(30),
      z.literal(60),
      z.literal(90),
    ]),
    ratio: z.enum(["9:16", "1:1", "16:9"]),
    caption: z.enum(["karaoke", "bold", "box", "pop", "minimal"]),
  })
  .strict();

type Row = {
  id: string;
  user_id: string;
  status: string;
  source_key: string;
  options: z.infer<typeof launchInput>;
  clips: Clip[];
  created_at: string;
};
type Clip = {
  index: number;
  start: number;
  end: number;
  text: string;
  key?: string;
};

function engine(path: string, init?: RequestInit) {
  return fetch(`${env("SHORTS_ENGINE_URL").replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env("SHORTS_ENGINE_SECRET")}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
}

async function subscribed(userId: string) {
  const { rowCount } = await db().query(
    "select 1 from billing.subscriptions where user_id=$1 and status='active' limit 1",
    [userId],
  );
  return Boolean(rowCount);
}

/** Free runs already used (failed runs are given back). */
export async function freeUsed(userId: string) {
  const {
    rows: [{ n }],
  } = await db().query<{ n: number }>(
    "select count(*)::int as n from platform.shorts_jobs where user_id=$1 and free and status <> 'failed' and status <> 'uploading'",
    [userId],
  );
  return n;
}

/** Reserves a run and returns a one-shot upload URL for the source video. */
export async function startUpload(
  userId: string,
  input: z.infer<typeof uploadInput>,
) {
  const sub = await subscribed(userId);
  return withUserLock(userId, async (c) => {
    const {
      rows: [existing],
    } = await c.query<{ user_id: string; status: string; source_key: string }>(
      "select user_id,status,source_key from platform.shorts_jobs where id=$1",
      [input.id],
    );
    if (existing) {
      if (existing.user_id !== userId || existing.status !== "uploading")
        throw new HttpError(409, "Cette demande existe déjà.");
      return { uploadUrl: await signedUploadUrl(existing.source_key) };
    }
    const {
      rows: [stats],
    } = await c.query<{ active: number; today: number; free: number }>(
      `select
         count(*) filter (where status in ('processing','importing')
           or (status='uploading' and created_at > now() - interval '2 hours'))::int as active,
         count(*) filter (where status <> 'uploading' and created_at > now() - interval '1 day')::int as today,
         count(*) filter (where free and status not in ('failed','uploading'))::int as free
       from platform.shorts_jobs where user_id=$1 and deleted_at is null`,
      [userId],
    );
    if (stats.active > 0)
      throw new HttpError(
        409,
        "Un découpage est déjà en cours. Attendez qu’il se termine.",
      );
    if (!sub && stats.free >= FREE_RUNS)
      throw new HttpError(
        402,
        "Vos 5 découpages gratuits sont utilisés. Abonnez-vous pour continuer.",
      );
    if (sub && stats.today >= DAILY_RUNS)
      throw new HttpError(429, "Limite quotidienne atteinte. Revenez demain.");
    const ext = input.type === "video/webm" ? "webm" : input.type === "video/quicktime" ? "mov" : "mp4";
    const key = `${userId}/shorts/${input.id}/source.${ext}`;
    await c.query(
      `insert into platform.shorts_jobs(id,user_id,source_key,source_bytes,options,free)
       values($1,$2,$3,$4,'{}'::jsonb,$5)`,
      [input.id, userId, key, input.bytes, !sub],
    );
    return { uploadUrl: await signedUploadUrl(key) };
  });
}

/** Checks the uploaded file and hands it to the engine (exactly once). */
export async function launch(
  userId: string,
  id: string,
  options: z.infer<typeof launchInput>,
) {
  const {
    rows: [row],
  } = await db().query<Row>(
    "select * from platform.shorts_jobs where id=$1 and user_id=$2 and deleted_at is null",
    [id, userId],
  );
  if (!row) throw new HttpError(404, "Demande introuvable.");
  if (row.status !== "uploading") return; // idempotent replay
  const info = await objectInfo(row.source_key);
  if (!info || info.size <= 0)
    throw new HttpError(409, "La vidéo n’a pas fini d’être envoyée.");
  if (info.size > MAX_BYTES) throw new HttpError(413, "Vidéo trop lourde.");

  const { rowCount } = await db().query(
    "update platform.shorts_jobs set status='processing', options=$3, engine_state='submitting', checked_at=now() where id=$1 and user_id=$2 and status='uploading'",
    [id, userId, options],
  );
  if (!rowCount) return;
  let response: Response;
  try {
    response = await engine("/v1/shorts", {
      method: "POST",
      body: JSON.stringify({
        job_id: id,
        source_url: await engineReadUrl(row.source_key),
        count: options.count,
        length_s: options.length,
        ratio: options.ratio,
        caption: options.caption,
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    // Unknown whether the engine received it; polling reconciles (404 → failed).
    return;
  }
  if (!response.ok) {
    console.error("shorts_engine_refused", response.status);
    await fail(row, `engine_${response.status}`);
  }
}

async function fail(row: Pick<Row, "id" | "source_key">, code: string) {
  await db().query(
    "update platform.shorts_jobs set status='failed', error_code=$2, finished_at=now() where id=$1 and status in ('processing','importing')",
    [row.id, code.slice(0, 80)],
  );
  await deleteObject(row.source_key);
}

/** Polls the engine for this user's running jobs and imports finished clips. */
export async function advanceShorts(userId: string) {
  const { rows } = await db().query<Row & { engine_state: string }>(
    `select * from platform.shorts_jobs where user_id=$1 and deleted_at is null and (
       (status='processing' and checked_at < now() - make_interval(secs => $2))
       or (status='importing' and import_started_at < now() - make_interval(mins => $3)))`,
    [userId, CHECK_EVERY_SECONDS, IMPORT_LEASE_MINUTES],
  );
  for (const row of rows) {
    try {
      if (row.status === "importing") await importClips(row);
      else await check(row);
    } catch (e) {
      console.error("shorts_advance_failed", row.id, (e as Error).message?.slice(0, 80));
    }
  }
}

async function check(row: Row) {
  const { rowCount } = await db().query(
    "update platform.shorts_jobs set checked_at=now() where id=$1 and status='processing' and checked_at < now() - make_interval(secs => $2)",
    [row.id, CHECK_EVERY_SECONDS],
  );
  if (!rowCount) return; // another request is checking
  const response = await engine(`/v1/jobs/${row.id}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404) {
    // Lost by the engine (never received, or purged). Give it 2 min of grace.
    if (Date.now() - new Date(row.created_at).getTime() > 2 * 60_000)
      await fail(row, "engine_lost");
    return;
  }
  if (!response.ok) return;
  const job = (await response.json()) as {
    status: string;
    error?: string;
    clips?: Clip[];
  };
  if (job.status === "failed") return fail(row, job.error ?? "engine_failed");
  if (job.status !== "succeeded") {
    await db().query(
      "update platform.shorts_jobs set engine_state=$2 where id=$1 and status='processing'",
      [row.id, job.status.slice(0, 40)],
    );
    return;
  }
  const clips = (job.clips ?? []).slice(0, 10).map((c) => ({
    index: c.index,
    start: c.start,
    end: c.end,
    text: String(c.text ?? "").slice(0, 500),
  }));
  const claimed = await db().query(
    "update platform.shorts_jobs set status='importing', engine_state='importing', clips=$2, import_started_at=now() where id=$1 and status='processing'",
    [row.id, JSON.stringify(clips)],
  );
  if (claimed.rowCount) await importClips({ ...row, clips });
}

async function importClips(row: Row) {
  await db().query(
    "update platform.shorts_jobs set import_started_at=now() where id=$1 and status='importing'",
    [row.id],
  );
  const clips = [...row.clips];
  for (const clip of clips) {
    if (clip.key) continue;
    const response = await engine(`/v1/jobs/${row.id}/clips/${clip.index}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (response.status === 404) return fail(row, "engine_lost");
    if (!response.ok) throw new Error(`clip_${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) return fail(row, "clip_too_large");
    const key = `${row.user_id}/shorts/${row.id}/clip${clip.index}.mp4`;
    await storeBytes(key, bytes, "video/mp4");
    clip.key = key;
    // Persist progress so a retry resumes instead of re-importing.
    await db().query(
      "update platform.shorts_jobs set clips=$2 where id=$1 and status='importing'",
      [row.id, JSON.stringify(clips)],
    );
  }
  await withUserLock(row.user_id, (c) =>
    transaction(c, () =>
      c.query(
        "update platform.shorts_jobs set status='succeeded', engine_state='stored', finished_at=now() where id=$1 and status='importing'",
        [row.id],
      ),
    ),
  );
  await deleteObject(row.source_key);
}

export async function listShorts(userId: string) {
  const { rows } = await db().query(
    `select id,status,engine_state,options,clips,error_code,created_at,finished_at
     from platform.shorts_jobs where user_id=$1 and deleted_at is null and status <> 'uploading'
     order by created_at desc limit 30`,
    [userId],
  );
  return rows.map((r) => ({
    ...r,
    clips: (r.clips as Clip[]).map(({ key, ...c }) => ({ ...c, ready: Boolean(key) })),
  }));
}

export async function clipKey(userId: string, id: string, index: number) {
  const {
    rows: [row],
  } = await db().query<{ clips: Clip[] }>(
    "select clips from platform.shorts_jobs where id=$1 and user_id=$2 and status='succeeded' and deleted_at is null",
    [id, userId],
  );
  return row?.clips.find((c) => c.index === index)?.key ?? null;
}
