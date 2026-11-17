import { z } from "zod";
import { requireOrigin, requireUser } from "@/lib/auth";
import { finishExport } from "@/lib/editor-bridge";
import { failure, HttpError } from "@/lib/http";

export async function POST(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireOrigin(r);
    const user = await requireUser();
    const { id } = await params;
    const body = z.object({ key: z.string().max(300) }).strict().safeParse(await r.json().catch(() => null));
    if (!z.uuid().safeParse(id).success || !body.success) throw new HttpError(400, "Demande invalide.");
    await finishExport(user.id, id, body.data.key);
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
