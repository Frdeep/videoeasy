import { z } from "zod";
import { requireUser, requireOrigin } from "@/lib/auth";
import { createCheckout } from "@/lib/billing";
import { failure, HttpError } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 60;
const input = z
  .object({ plan: z.enum(["standard", "metal", "gold"]) })
  .strict();
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const user = await requireUser();
    let value: unknown;
    try {
      value = await request.json();
    } catch {
      throw new HttpError(400, "JSON invalide.");
    }
    const body = input.safeParse(value);
    if (!body.success)
      throw new HttpError(400, "Seule une formule valide est acceptée.");
    return Response.json({ url: await createCheckout(user, body.data.plan) });
  } catch (error) {
    return failure(error);
  }
}
