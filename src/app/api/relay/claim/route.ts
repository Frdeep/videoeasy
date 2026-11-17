import { failure } from "@/lib/http";
import { requireRelay } from "@/lib/relay-auth";
import { relayClaim } from "@/lib/shorts";

export const runtime = "nodejs";

export async function POST(r: Request) {
  try {
    requireRelay(r);
    const job = await relayClaim();
    return job ? Response.json(job) : new Response(null, { status: 204 });
  } catch (e) {
    return failure(e);
  }
}
