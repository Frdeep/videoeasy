import "server-only";
import { z } from "zod";
import { db } from "./db";
import { HttpError } from "./http";
import { hfConfigured, hfSignedPut, hfSize } from "./hf-storage";
import { signedUrl } from "./media-store";
import { ownedVideoKey } from "./montage";
import { clipForEditor } from "./shorts";

// Bridge between VideoEasy and the editor (apps/editor, OpenCut classic,
// served under /editor on the same domain). Opening = a short-lived signed
// link (+ caption cues for shorts). Sending back = a browser upload straight
// to the private Hugging Face bucket, recorded as a « montage » so it shows
// up in Créations with download / transfer / edit.

const REF = /^(job|montage):([0-9a-f-]{36})$|^short:([0-9a-f-]{36}):(\d)$/;

export async function openInEditor(userId: string, ref: string) {
  const m = REF.exec(ref);
  if (!m) throw new HttpError(400, "Identifiant invalide.");
  if (m[3]) {
    const clip = await clipForEditor(userId, m[3], Number(m[4]));
    if (!clip) throw new HttpError(404, "Vidéo introuvable.");
    const { rows: [run] } = await db().query<{ options: { ratio: string; caption: string } }>(
      "select options from platform.shorts_jobs where id=$1 and user_id=$2",
      [m[3], userId],
    );
    return {
      url: await signedUrl(clip.key, false),
      name: `Short ${Number(m[4]) + 1}`,
      ratio: run?.options.ratio ?? "9:16",
      captionStyle: run?.options.caption ?? "karaoke",
      // Captions come as editable text only when the clean version exists.
      cues: clip.clean ? clip.cues : [],
    };
  }
  const kind = m[1] as "job" | "montage";
  const key = await ownedVideoKey(userId, kind, m[2]);
  if (!key) throw new HttpError(404, "Vidéo introuvable.");
  let ratio = "9:16";
  if (kind === "job") {
    const { rows: [j] } = await db().query<{ model_id: string }>("select model_id from platform.jobs where id=$1", [m[2]]);
    ratio = j?.model_id.includes("16x9") ? "16:9" : "9:16";
  } else {
    const { rows: [mo] } = await db().query<{ options: { ratio: string } }>("select options from platform.montages where id=$1", [m[2]]);
    ratio = mo?.options.ratio ?? "9:16";
  }
  return { url: await signedUrl(key, false), name: kind === "job" ? "Vidéo IA" : "Montage", ratio, captionStyle: null, cues: [] };
}

export const exportInput = z
  .object({
    id: z.uuid(),
    bytes: z.number().int().positive().max(4 * 1024 ** 3),
    type: z.enum(["video/mp4", "video/webm"]),
    ratio: z.enum(["9:16", "16:9", "1:1"]),
    name: z.string().trim().max(120),
  })
  .strict();

/** Reserves a montage row and returns a presigned PUT for the browser. */
export async function startExport(userId: string, input: z.infer<typeof exportInput>) {
  if (!hfConfigured()) throw new HttpError(503, "Stockage indisponible.");
  const ext = input.type === "video/webm" ? "webm" : "mp4";
  const put = await hfSignedPut(`${userId}/montages/${input.id}.${ext}`, input.type);
  const { rowCount } = await db().query(
    `insert into platform.montages(id,user_id,status,sources,options,free,engine_state)
     values($1,$2,'processing','[]'::jsonb,$3,false,'editor_upload') on conflict (id) do nothing`,
    [input.id, userId, JSON.stringify({ ratio: input.ratio, text: input.name, transition: "editor" })],
  );
  if (!rowCount) {
    const { rows: [own] } = await db().query("select 1 from platform.montages where id=$1 and user_id=$2 and status='processing'", [input.id, userId]);
    if (!own) throw new HttpError(409, "Cette demande existe déjà.");
  }
  return { uploadUrl: put.url, key: put.key };
}

export async function finishExport(userId: string, id: string, key: string) {
  if (!key.startsWith("hf:") || !key.includes(`${userId}/montages/${id}.`))
    throw new HttpError(400, "Clé inattendue.");
  const size = await hfSize(key);
  if (!size) throw new HttpError(409, "La vidéo n’a pas fini d’être envoyée.");
  const { rowCount } = await db().query(
    "update platform.montages set status='succeeded', engine_state='stored', object_key=$3, finished_at=now() where id=$1 and user_id=$2 and status='processing' and engine_state='editor_upload'",
    [id, userId, key],
  );
  if (!rowCount) throw new HttpError(404, "Demande introuvable.");
}
