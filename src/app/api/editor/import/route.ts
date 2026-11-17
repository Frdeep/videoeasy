import { requireUser } from "@/lib/auth";
import { openInEditor } from "@/lib/editor-bridge";
import { failure } from "@/lib/http";

export async function GET(r: Request) {
  try {
    const user = await requireUser();
    const ref = new URL(r.url).searchParams.get("ref") ?? "";
    return Response.json(await openInEditor(user.id, ref), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
