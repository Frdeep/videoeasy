import "server-only";
import { timingSafeEqual } from "node:crypto";
import { HttpError } from "./http";

/** The YouTube relay (Chromebook) authenticates with RELAY_SECRET. Fails
 * closed when the secret is not configured. */
export function requireRelay(r: Request) {
  const secret = process.env.RELAY_SECRET ?? "";
  const got = Buffer.from(r.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (!secret || got.length !== want.length || !timingSafeEqual(got, want))
    throw new HttpError(401, "unauthorized");
}
