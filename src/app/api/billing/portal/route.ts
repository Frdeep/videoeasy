import { requireUser, requireOrigin } from "@/lib/auth";
import { createPortal } from "@/lib/billing";
import { failure, HttpError } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const user = await requireUser();
    const body = await request.text();
    if (body && body !== "{}")
      throw new HttpError(400, "Aucun identifiant client ne peut être fourni.");
    return Response.json({ url: await createPortal(user) });
  } catch (error) {
    return failure(error);
  }
}
