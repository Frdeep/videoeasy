import "server-only";
import { db, withUserLock, transaction } from "./db";
import { appUrl } from "./config";
import { createTask, getTask, KieError } from "./kie";
import { importResult, MediaError } from "./media-store";
import { safeErrorCode } from "./db-config";

// Durable Kie.ai job lifecycle. All state lives in PostgreSQL; any request
// (gallery polling, provider callback, job creation) can advance a job, and
// every transition is a conditional UPDATE so concurrent callers never double
// submit, double import or double settle.
//
//   queued ──claim──▶ running(submitting) ──taskId──▶ running(waiting…)
//      │                    │ definite refusal → failed (credits released)
//      │                    └ timeout/5xx/network → uncertain (credits kept, operator reconciles)
//   running ──Kie success──▶ importing ──stored──▶ succeeded (credits consumed)
//           └─Kie fail─────▶ failed (credits released; Kie does not bill failures)

const CHECK_EVERY_SECONDS = 10;
const IMPORT_LEASE_MINUTES = 5;

type Job = {
  id: string;
  user_id: string;
  status: string;
  provider: string;
  provider_model: string | null;
  provider_input: Record<string, unknown> | null;
  provider_task_id: string | null;
  provider_state: string | null;
  prompt: string;
};

async function settle(
  job: Job,
  outcome: "succeeded" | "failed",
  fields: {
    error?: string;
    key?: string;
    contentType?: string;
    size?: number;
    providerCredits?: number | null;
  },
) {
  await withUserLock(job.user_id, (c) =>
    transaction(c, async () => {
      const { rowCount } = await c.query(
        `update platform.jobs set status=$2, provider_state=$3, error_code=$4, object_key=coalesce($5,object_key),
           content_type=coalesce($6,content_type), size_bytes=coalesce($7,size_bytes),
           provider_credits=coalesce($8,provider_credits), finished_at=now()
         where id=$1 and status in ('queued','running')`,
        [
          job.id,
          outcome,
          outcome === "succeeded" ? "stored" : "failed",
          fields.error ?? null,
          fields.key ?? null,
          fields.contentType ?? null,
          fields.size ?? null,
          fields.providerCredits ?? null,
        ],
      );
      if (rowCount)
        await c.query("select billing.settle_reservation($1,$2,$3)", [
          job.user_id,
          job.id,
          outcome === "succeeded",
        ]);
    }),
  );
}

/** Sends a queued job to Kie exactly once (atomic claim). */
export async function submitJob(jobId: string) {
  const {
    rows: [job],
  } = await db().query<Job>(
    `update platform.jobs set status='running', provider_state='submitting', attempts=attempts+1,
       submitted_at=now(), checked_at=now()
     where id=$1 and provider='kie' and status='queued'
     returning *`,
    [jobId],
  );
  if (!job) return;
  try {
    const taskId = await createTask(
      job.provider_model!,
      { ...(job.provider_input ?? {}), prompt: job.prompt },
      `${appUrl()}/api/kie/callback`,
    );
    await db().query(
      "update platform.jobs set provider_task_id=$2, provider_state='waiting', checked_at=now() where id=$1",
      [job.id, taskId],
    );
  } catch (e) {
    const code = e instanceof KieError ? e.code : safeErrorCode(e);
    if (e instanceof KieError && !e.uncertain) {
      // Kie answered and refused (bad request, no provider credit, …): nothing was created.
      console.error("kie_submit_refused", job.id, code);
      await settle(job, "failed", { error: `submit_${code}` });
    } else {
      // The task may exist at Kie without us knowing its id: never resubmit blindly.
      console.error("kie_submit_uncertain", job.id, code);
      await db().query(
        "update platform.jobs set status='uncertain', provider_state='submit_uncertain', error_code=$2 where id=$1 and status='running'",
        [job.id, `submit_${code}`],
      );
    }
  }
}

/** Polls Kie for one running job and finalizes it when done. Safe to call concurrently. */
export async function refreshJob(jobId: string, force = false) {
  const {
    rows: [job],
  } = await db().query<Job>(
    `update platform.jobs set checked_at=now()
     where id=$1 and provider='kie' and status='running' and provider_task_id is not null
       and coalesce(provider_state,'') <> 'importing'
       and ($2 or checked_at is null or checked_at < now() - interval '${CHECK_EVERY_SECONDS} seconds')
     returning *`,
    [jobId, force],
  );
  if (!job) {
    // Re-take an import whose lease expired (crash during import).
    const {
      rows: [stale],
    } = await db().query<Job>(
      `update platform.jobs set import_started_at=now()
       where id=$1 and status='running' and provider_state='importing'
         and import_started_at < now() - interval '${IMPORT_LEASE_MINUTES} minutes' returning *`,
      [jobId],
    );
    if (stale) await finishSuccess(stale);
    return;
  }
  let task;
  try {
    task = await getTask(job.provider_task_id!);
  } catch (e) {
    console.error(
      "kie_poll_failed",
      job.id,
      e instanceof KieError ? e.code : safeErrorCode(e),
    );
    return;
  }
  if (task.state === "fail") {
    await settle(job, "failed", {
      error: `kie_${task.failCode ?? "fail"}`,
      providerCredits: task.creditsConsumed,
    });
    return;
  }
  if (task.state !== "success") {
    await db().query(
      "update platform.jobs set provider_state=$2 where id=$1 and status='running'",
      [job.id, task.state],
    );
    return;
  }
  const {
    rows: [claimed],
  } = await db().query<Job>(
    `update platform.jobs set provider_state='importing', import_started_at=now(), provider_credits=$2
     where id=$1 and status='running' and provider_state <> 'importing' returning *`,
    [job.id, task.creditsConsumed],
  );
  if (claimed) await finishSuccess(claimed, task.resultUrls[0]);
}

async function finishSuccess(job: Job, url?: string) {
  if (!url) {
    try {
      url = (await getTask(job.provider_task_id!)).resultUrls[0];
    } catch {
      return; // lease will expire and a later refresh retries
    }
  }
  if (!url) {
    await settle(job, "failed", { error: "kie_no_result" });
    return;
  }
  try {
    const stored = await importResult(job.user_id, job.id, url);
    await settle(job, "succeeded", stored);
  } catch (e) {
    const code = e instanceof MediaError ? e.code : safeErrorCode(e);
    console.error("media_import_failed", job.id, code);
    // Keep the reservation; release the lease so a later refresh retries the import.
    await db().query(
      "update platform.jobs set provider_state='import_retry', error_code=$2, checked_at=now() where id=$1 and status='running'",
      [job.id, `import_${code}`],
    );
  }
}

/** Advances a user's active jobs (called by gallery polling). Bounded work per call. */
export async function advanceUserJobs(userId: string) {
  // A crash between the claim and Kie's answer leaves no task id: we cannot know
  // whether Kie created the task, so it becomes uncertain (operator reconciles).
  await db().query(
    `update platform.jobs set status='uncertain', provider_state='submit_uncertain', error_code='submit_interrupted'
     where user_id=$1 and status='running' and provider_state='submitting' and provider_task_id is null
       and submitted_at < now() - interval '2 minutes'`,
    [userId],
  );
  const { rows } = await db().query<{ id: string; status: string }>(
    `select id,status from platform.jobs where user_id=$1 and provider='kie'
       and status in ('queued','running') order by created_at limit 3`,
    [userId],
  );
  for (const r of rows) {
    try {
      if (r.status === "queued") await submitJob(r.id);
      else await refreshJob(r.id);
    } catch (e) {
      console.error("job_advance_failed", r.id, safeErrorCode(e));
    }
  }
}

/** Provider callback: the payload is never trusted, only used to find which job to re-check. */
export async function onProviderCallback(taskId: string) {
  const {
    rows: [job],
  } = await db().query<{ id: string }>(
    "select id from platform.jobs where provider_task_id=$1 and status='running'",
    [taskId],
  );
  if (job) await refreshJob(job.id, true);
}
