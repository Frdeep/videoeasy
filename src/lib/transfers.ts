import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { appUrl } from "./config";
import { db } from "./db";
import { HttpError } from "./http";
import { ownedVideoKey } from "./montage";
import { clipKey } from "./shorts";

// File transfer: the owner creates an unguessable, expiring link to one of
// their finished videos, to send to anyone (no account needed to download).

const DAILY = 30;

export const transferInput = z
  .object({
    kind: z.enum(["job", "montage", "short"]),
    id: z.uuid(),
    index: z.number().int().min(0).max(9).optional(),
    days: z.union([z.literal(1), z.literal(7), z.literal(30)]),
    message: z.string().trim().max(280).optional(),
  })
  .strict();

export async function createTransfer(userId: string, input: z.infer<typeof transferInput>) {
  const key =
    input.kind === "short"
      ? await clipKey(userId, input.id, input.index ?? 0)
      : await ownedVideoKey(userId, input.kind, input.id);
  if (!key) throw new HttpError(404, "Vidéo introuvable.");
  const { rows: [{ n }] } = await db().query<{ n: number }>(
    "select count(*)::int as n from platform.transfers where user_id=$1 and created_at > now() - interval '1 day'",
    [userId],
  );
  if (n >= DAILY) throw new HttpError(429, "Limite quotidienne atteinte. Revenez demain.");
  const token = randomBytes(24).toString("base64url");
  const name = `videoeasy-${input.id.slice(0, 8)}${input.kind === "short" ? `-${(input.index ?? 0) + 1}` : ""}.mp4`;
  const { rows: [row] } = await db().query<{ expires_at: string }>(
    `insert into platform.transfers(token,user_id,object_key,file_name,message,expires_at)
     values($1,$2,$3,$4,$5, now() + make_interval(days => $6)) returning expires_at`,
    [token, userId, key, name, input.message || null, input.days],
  );
  return { url: `${appUrl()}/t/${token}`, expiresAt: row.expires_at };
}

/** Public lookup by token: only live (not expired, not revoked) transfers. */
export async function liveTransfer(token: string) {
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return null;
  const { rows } = await db().query<{
    object_key: string;
    file_name: string;
    message: string | null;
    expires_at: string;
  }>(
    "select object_key,file_name,message,expires_at from platform.transfers where token=$1 and revoked_at is null and expires_at > now()",
    [token],
  );
  return rows[0] ?? null;
}

export async function countDownload(token: string) {
  await db().query("update platform.transfers set downloads=downloads+1 where token=$1", [token]);
}
