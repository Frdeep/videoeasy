import { z } from "zod";
import { requireOrigin, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { failure, HttpError } from "@/lib/http";
import { rewriteScript } from "@/lib/rewrite";

export const runtime = "nodejs";
export const maxDuration = 30;

const input = z
  .object({
    prompt: z.string().trim().min(3).max(2500),
    genre: z.string().trim().max(40),
    ratio: z.enum(["16:9", "9:16"]),
    lang: z.enum(["fr", "en"]).optional(),
  })
  .strict();

export async function POST(r: Request) {
  try {
    requireOrigin(r);
    const user = await requireUser();
    const body = input.safeParse(await r.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Demande invalide.");
    // Rewrites cost provider money: reserved to active subscribers.
    const { rowCount } = await db().query(
      "select 1 from billing.subscriptions where user_id=$1 and status='active' limit 1",
      [user.id],
    );
    if (!rowCount) throw new HttpError(402, "Abonnement requis.");
    return Response.json({ prompt: await rewriteScript(user.id, body.data) });
  } catch (e) {
    return failure(e);
  }
}
