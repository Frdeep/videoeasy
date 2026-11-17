import { requireOrigin, requireUser } from "@/lib/auth";
import { failure, HttpError } from "@/lib/http";
import { linkInput, startLink } from "@/lib/shorts";

export const runtime = "nodejs";

export async function POST(r: Request) {
  try {
    requireOrigin(r);
    const user = await requireUser();
    const body = linkInput.safeParse(await r.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Demande invalide.");
    await startLink(user.id, body.data);
    return Response.json({ id: body.data.id }, { status: 202 });
  } catch (e) {
    return failure(e);
  }
}
