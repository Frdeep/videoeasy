import { requireOrigin, requireUser } from "@/lib/auth";
import { failure, HttpError } from "@/lib/http";
import { advanceMontages, createMontage, listMontages, montageInput, montageQuota } from "@/lib/montage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const user = await requireUser();
    await advanceMontages(user.id);
    const [montages, quota] = await Promise.all([listMontages(user.id), montageQuota(user.id)]);
    return Response.json({ montages, quota }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}

export async function POST(r: Request) {
  try {
    requireOrigin(r);
    const user = await requireUser();
    const body = montageInput.safeParse(await r.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Réglages invalides.");
    await createMontage(user.id, body.data);
    return Response.json({ id: body.data.id }, { status: 202 });
  } catch (e) {
    return failure(e);
  }
}
