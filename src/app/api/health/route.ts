import { db } from "@/lib/db";
import { safeErrorCode } from "@/lib/db-config";

export const dynamic = "force-dynamic";

// Public liveness probe: says only whether the server reaches PostgreSQL.
// The precise cause is logged server-side as a code, never returned.
export async function GET() {
  try {
    await db().query("select 1");
    return Response.json(
      { database: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("health_database_failed", safeErrorCode(e));
    return Response.json(
      { database: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
