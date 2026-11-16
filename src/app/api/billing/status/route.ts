import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { failure } from "@/lib/http";
export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await requireUser();
    const { rows } = await db().query(
      `select s.status,s.plan,s.period_end,s.cancel_at,s.cancel_at_period_end,
     coalesce((select sum(g.remaining) from billing.credit_grants g where g.subscription_id=s.id
       and g.period_start=s.period_start and g.period_end=s.period_end
       and g.period_start<=extract(epoch from now()) and g.period_end>extract(epoch from now())),0) as available_credits
     from billing.subscriptions s where s.user_id=$1 order by s.period_start desc`,
      [user.id],
    );
    return Response.json(
      { subscriptions: rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
