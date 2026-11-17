import "server-only";
import { env } from "./config";
import { db } from "./db";
import { HttpError } from "./http";

// Automatic script rewrite through Kie.ai's Anthropic-compatible endpoint
// (docs.kie.ai/market/claude/claude-haiku-5-5, read 17/11/2026).
const ENDPOINT = "https://api.kie.ai/claude/v1/messages";
const MODEL = "claude-haiku-5-5";
export const DAILY_LIMIT = 40;

const SYSTEM = `Tu réécris des idées de vidéo en prompts pour un modèle texte-vers-vidéo (5 secondes, un seul plan, avec le son).
Règles :
- Réponds UNIQUEMENT par le prompt final, en français, sans titre, guillemets ni explication.
- 1 à 3 phrases, 70 mots maximum.
- Précise : sujet et action, cadre et mouvement de caméra, lumière, ambiance, et le son si utile.
- Respecte l'intention et le genre demandés. N'invente ni marque ni personne réelle.
- Si la demande est vide, dangereuse, sexuelle, haineuse ou viole des droits, réponds exactement : REFUS`;

export async function rewriteScript(
  userId: string,
  input: { prompt: string; genre: string; ratio: string },
) {
  const {
    rows: [{ n }],
  } = await db().query<{ n: number }>(
    "select count(*)::int as n from platform.rewrites where user_id=$1 and created_at > now() - interval '1 day'",
    [userId],
  );
  if (n >= DAILY_LIMIT)
    throw new HttpError(
      429,
      "Limite de réécritures atteinte pour aujourd’hui.",
    );
  await db().query("insert into platform.rewrites(user_id) values($1)", [
    userId,
  ]);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("KIE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        stream: false,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Genre : ${input.genre}\nFormat : ${input.ratio}\nIdée : ${input.prompt}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
    });
  } catch {
    throw new HttpError(503, "Réécriture indisponible. Réessayez.");
  }
  const data = (await response.json().catch(() => null)) as {
    content?: { type?: string; text?: string }[];
    code?: number;
  } | null;
  const text = data?.content
    ?.filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join(" ")
    .trim();
  if (!response.ok || !text) {
    console.error("rewrite_failed", response.status, data?.code ?? "");
    throw new HttpError(503, "Réécriture indisponible. Réessayez.");
  }
  if (text === "REFUS")
    throw new HttpError(422, "Cette idée ne peut pas être réécrite.");
  return text.replace(/^["«\s]+|["»\s]+$/g, "").slice(0, 2500);
}
