import { requireOrigin, requireUser } from "@/lib/auth";
import { exportInput, startExport } from "@/lib/editor-bridge";
import { failure, HttpError } from "@/lib/http";

export async function POST(r: Request) {
  try {
    requireOrigin(r);
    const user = await requireUser();
    const body = exportInput.safeParse(await r.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Demande invalide.");
    return Response.json(await startExport(user.id, body.data));
  } catch (e) {
    return failure(e);
  }
}
