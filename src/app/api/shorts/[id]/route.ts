import { z } from "zod";
import { requireOrigin, requireUser } from "@/lib/auth";
import { failure, HttpError } from "@/lib/http";
import { launch, launchInput } from "@/lib/shorts";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireOrigin(r);
    const user = await requireUser();
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new HttpError(400, "Identifiant invalide.");
    const body = launchInput.safeParse(await r.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Réglages invalides.");
    await launch(user.id, id, body.data);
    return Response.json({ id }, { status: 202 });
  } catch (e) {
    return failure(e);
  }
}
