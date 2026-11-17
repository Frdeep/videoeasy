import { requireOrigin, requireUser } from "@/lib/auth";
import { failure, HttpError } from "@/lib/http";
import { createTransfer, transferInput } from "@/lib/transfers";

export const runtime = "nodejs";

export async function POST(r: Request) {
  try {
    requireOrigin(r);
    const user = await requireUser();
    const body = transferInput.safeParse(await r.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Demande invalide.");
    return Response.json(await createTransfer(user.id, body.data), { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
