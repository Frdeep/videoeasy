"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RiseText, Segmented } from "./motion";
import { useT } from "./i18n";

type Item = { kind: "job" | "montage"; id: string; label: string; ratio: string; src: string };
type Clip = Item & { start: number; end: number; duration: number };
type Quota = { freeUsed: number; freeLimit: number; subscribed: boolean };
const transitions = ["Coupe nette", "Fondu"] as const;
const MAX_CLIPS = 10;

/** Montage: pick finished videos, order them, trim each one, optional text,
 * cut or crossfade. Rendered by the engine; the result lands in Créations. */
export function MontageStudio() {
  const { t } = useT();
  const [items, setItems] = useState<Item[] | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [text, setText] = useState("");
  const [transition, setTransition] = useState<(typeof transitions)[number]>("Fondu");
  const [quota, setQuota] = useState<Quota | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/platform/jobs").then((r) => (r.ok ? r.json() : { jobs: [] })),
      fetch("/api/montage").then((r) => (r.ok ? r.json() : { montages: [] })),
    ])
      .then(([j, m]) => {
        const list: Item[] = [
          ...(m.montages ?? [])
            .filter((x: { status: string }) => x.status === "succeeded")
            .map((x: { id: string; options: { ratio: string; text: string } }) => ({
              kind: "montage" as const,
              id: x.id,
              label: x.options.text || t("Montage"),
              ratio: x.options.ratio,
              src: `/api/montage/${x.id}/download?view=1`,
            })),
          ...(j.jobs ?? [])
            .filter(
              (x: { status: string; mock_result: boolean; content_type: string | null }) =>
                x.status === "succeeded" && !x.mock_result && x.content_type?.startsWith("video/"),
            )
            .map((x: { id: string; prompt: string; model_id: string }) => ({
              kind: "job" as const,
              id: x.id,
              label: x.prompt,
              ratio: x.model_id.includes("9x16") ? "9:16" : "16:9",
              src: `/api/platform/jobs/${x.id}/download?view=1`,
            })),
        ];
        setItems(list);
        setQuota(m.quota ?? null);
        const from = new URLSearchParams(location.search).get("from");
        const first = list.find((i) => `${i.kind}:${i.id}` === from);
        if (first) setClips([{ ...first, start: 0, end: 0, duration: 0 }]);
      })
      .catch(() => setItems([]));
  }, [t]);

  const ratio = clips[0]?.ratio;
  const choices = useMemo(
    () => (items ?? []).filter((i) => !ratio || i.ratio === ratio),
    [items, ratio],
  );
  const total = clips.reduce((s, c) => s + Math.max(0, (c.end || c.duration) - c.start), 0);
  const freeLeft = quota && !quota.subscribed ? quota.freeLimit - quota.freeUsed : null;

  const update = (i: number, patch: Partial<Clip>) =>
    setClips((cs) => cs.map((c, n) => (n === i ? { ...c, ...patch } : c)));
  const move = (i: number, d: number) =>
    setClips((cs) => {
      const j = i + d;
      if (j < 0 || j >= cs.length) return cs;
      const next = [...cs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  async function launch() {
    if (!clips.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/montage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          sources: clips.map((c) => ({
            kind: c.kind,
            id: c.id,
            start: Math.round(c.start * 10) / 10,
            end: Math.round((c.end || c.duration) * 10) / 10,
          })),
          ratio: clips[0].ratio,
          text: text.trim(),
          transition: transition === "Fondu" ? "fade" : "cut",
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(t(d.error ?? "Lancement impossible."));
      location.assign("/gallery");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="page montage-page">
      <header className="page-head">
        <RiseText text="Monter." />
        {freeLeft !== null && (
          <span className="soon-pill">
            {freeLeft > 0
              ? t(freeLeft > 1 ? "{n} montages offerts" : "{n} montage offert", { n: freeLeft })
              : t("Offre gratuite utilisée")}
          </span>
        )}
      </header>

      {items === null ? (
        <div className="skeleton" aria-busy="true" aria-label={t("Chargement")} />
      ) : !items.length ? (
        <div className="empty-state">
          <h2>{t("Aucune vidéo à monter pour l’instant.")}</h2>
          <Link className="button primary" href="/studio">
            {t("Créer une vidéo")}
          </Link>
        </div>
      ) : (
        <div className="composer">
          <span className="field-label">{t("Vos vidéos")}</span>
          <div className="pick-rail">
            {choices.map((it) => {
              const n = clips.filter((c) => c.id === it.id).length;
              return (
                <button
                  key={`${it.kind}-${it.id}`}
                  className={`pick${n ? " on" : ""}`}
                  disabled={clips.length >= MAX_CLIPS}
                  onClick={() => setClips((cs) => [...cs, { ...it, start: 0, end: 0, duration: 0 }])}
                  title={it.label}
                >
                  <video src={`${it.src}#t=0.5`} muted playsInline preload="metadata" />
                  {n > 0 && <b>{n}</b>}
                  <span>+</span>
                </button>
              );
            })}
          </div>
          {ratio && <p className="fine-print">{t("Format {r} : seules les vidéos du même format sont proposées.", { r: ratio })}</p>}

          {clips.length > 0 && (
            <>
              <span className="field-label">{t("Ordre et découpe")}</span>
              <ol className="timeline">
                {clips.map((c, i) => (
                  <li key={`${c.id}-${i}`}>
                    <video
                      src={c.src}
                      muted
                      playsInline
                      preload="metadata"
                      onLoadedMetadata={(e) => {
                        const d = Math.round(e.currentTarget.duration * 10) / 10;
                        if (!c.duration) update(i, { duration: d, end: d });
                      }}
                    />
                    <div className="trim">
                      <strong>
                        {i + 1}. {c.label}
                      </strong>
                      <label>
                        {t("Début")}
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          max={Math.max(0, (c.end || c.duration) - 0.5)}
                          value={c.start}
                          onChange={(e) => update(i, { start: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </label>
                      <label>
                        {t("Fin")}
                        <input
                          type="number"
                          min={c.start + 0.5}
                          step={0.1}
                          max={c.duration || undefined}
                          value={c.end || c.duration}
                          onChange={(e) =>
                            update(i, { end: Math.min(c.duration || 600, Number(e.target.value) || 0) })
                          }
                        />
                      </label>
                    </div>
                    <div className="tl-actions">
                      <button aria-label={t("Monter d’un cran")} onClick={() => move(i, -1)} disabled={i === 0}>
                        ↑
                      </button>
                      <button
                        aria-label={t("Descendre d’un cran")}
                        onClick={() => move(i, 1)}
                        disabled={i === clips.length - 1}
                      >
                        ↓
                      </button>
                      <button aria-label={t("Retirer")} onClick={() => setClips((cs) => cs.filter((_, n) => n !== i))}>
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ol>

              <span className="field-label">{t("Transition")}</span>
              <Segmented options={transitions} value={transition} onChange={setTransition} label="Transition" />

              <label className="field-label" htmlFor="montage-text">
                {t("Texte à l’écran (facultatif)")}
              </label>
              <input
                id="montage-text"
                maxLength={200}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("Ex. : -20 % ce week-end")}
              />
            </>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="launch">
            <div>
              <strong>
                {t("{n} clip(s)", { n: clips.length })} · {Math.round(total)} s
              </strong>
              <span>{ratio ?? t("Choisissez une vidéo")}</span>
            </div>
            {freeLeft !== null && freeLeft <= 0 ? (
              <Link className="button primary big" href="/pricing">
                {t("S’abonner")}
              </Link>
            ) : (
              <button
                className="button primary big"
                disabled={!clips.length || busy || total > 180}
                onClick={() => void launch()}
              >
                {busy ? t("Lancement…") : t("Monter la vidéo")}
              </button>
            )}
          </div>
          {total > 180 && <p className="form-error">{t("3 minutes maximum au total.")}</p>}
        </div>
      )}
    </div>
  );
}
