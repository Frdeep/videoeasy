import { requireUser, requireOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { failure, HttpError } from "@/lib/http";
import { createJob, jobInput } from "@/lib/platform";
import { advanceUserJobs, submitJob } from "@/lib/generation";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  try {
    const user = await requireUser();
    // Gallery polling advances this user's real jobs (bounded, idempotent).
    await advanceUserJobs(user.id);
    const { rows } = await db().query(
      "select id,model_id,prompt,credits,status,mock_result,created_at,provider_state,content_type,scheduled_at,schedule_channel,schedule_note from platform.jobs where user_id=$1 and deleted_at is null order by created_at desc limit 100",
      [user.id],
    );
    return Response.json(
      { jobs: rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(r: Request) {
  try {
    requireOrigin(r);
    const user = await requireUser();
    const input = jobInput.safeParse(await r.json());
    if (!input.success) throw new HttpError(400, "Demande invalide.");
    const id = await createJob(user.id, input.data);
    // Credits are reserved and the job committed: now hand it to the provider.
    await submitJob(id);
    return Response.json({ id }, { status: 202 });
  } catch (e) {
    return failure(e);
  }
}
