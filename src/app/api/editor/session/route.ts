import { requireUser } from "@/lib/auth";
import { failure } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ ok: true, email: user.email }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
