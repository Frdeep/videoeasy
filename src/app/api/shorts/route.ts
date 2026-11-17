import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { failure } from "@/lib/http";
import { advanceShorts, FREE_RUNS, freeUsed, listShorts } from "@/lib/shorts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const user = await requireUser();
    // Polling advances this user's runs (bounded, idempotent).
    await advanceShorts(user.id);
    const [shorts, used, sub] = await Promise.all([
      listShorts(user.id),
      freeUsed(user.id),
      db().query(
        "select 1 from billing.subscriptions where user_id=$1 and status='active' limit 1",
        [user.id],
      ),
    ]);
    return Response.json(
      {
        shorts,
        quota: { freeUsed: used, freeLimit: FREE_RUNS, subscribed: Boolean(sub.rowCount) },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
