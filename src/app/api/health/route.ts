import { db } from "@/lib/db";
import { safeErrorCode } from "@/lib/db-config";
import { getCredits, KieError } from "@/lib/kie";

export const dynamic = "force-dynamic";

// Public liveness probe: only ok/unavailable per dependency. Causes are logged
// server-side as codes, never returned. Provider check cached for 60 s.
let generator: { at: number; ok: boolean } | undefined;
async function generatorOk() {
  if (generator && Date.now() - generator.at < 60000) return generator.ok;
  let ok = false;
  try {
    ok = (await getCredits()) > 0;
    if (!ok) console.error("health_generator_no_credit");
  } catch (e) {
    console.error(
      "health_generator_failed",
      e instanceof KieError ? e.code : safeErrorCode(e),
    );
  }
  generator = { at: Date.now(), ok };
  return ok;
}

export async function GET() {
  let database = false;
  try {
    await db().query("select 1");
    database = true;
  } catch (e) {
    console.error("health_database_failed", safeErrorCode(e));
  }
  const gen = await generatorOk();
  return Response.json(
    {
      database: database ? "ok" : "unavailable",
      generator: gen ? "ok" : "unavailable",
    },
    {
      status: database ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
