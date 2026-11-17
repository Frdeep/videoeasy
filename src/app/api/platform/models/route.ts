import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { failure } from "@/lib/http";
export async function GET() {
  try {
    await requireUser();
    const { rows } = await db().query(
      "select id,name,kind,credits,allowed_plans,provider from platform.models where enabled order by name",
    );
    return Response.json(
      { models: rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
