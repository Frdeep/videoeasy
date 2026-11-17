import { z } from "zod";
import { failure, HttpError } from "@/lib/http";
import { requireRelay } from "@/lib/relay-auth";
import { relayDone } from "@/lib/shorts";

export const runtime = "nodejs";
export const maxDuration = 30;

const input = z.union([
  z.object({ id: z.uuid(), ok: z.literal(true), key: z.string().max(300), bytes: z.number().positive() }).strict(),
  z.object({ id: z.uuid(), ok: z.literal(false), error: z.string().max(200) }).strict(),
]);

export async function POST(r: Request) {
  try {
    requireRelay(r);
    const body = input.safeParse(await r.json().catch(() => null));
    if (!body.success) throw new HttpError(400, "Demande invalide.");
    const { id, ...result } = body.data;
    await relayDone(id, result);
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
