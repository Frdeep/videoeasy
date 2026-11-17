"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Paywall } from "./paywall";
import { RiseText, Segmented } from "./motion";
import { genres, starters, type Genre } from "@/lib/showcase";

type Model = {
  id: string;
  name: string;
  kind: string;
  credits: number;
  provider: string;
};
type Sub = { status: string; plan: string; available_credits: string | number };

const isTall = (m: Model) => m.name.includes("9:16");

export function GenerationForm() {
  const [models, setModels] = useState<Model[]>([]);
  const [sub, setSub] = useState<Sub | null | undefined>(undefined);
  const [model, setModel] = useState("");
  const [genre, setGenre] = useState<Genre>("Réaliste");
  const [prompt, setPrompt] = useState("");
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const g = new URLSearchParams(location.search).get("genre");
    if (g && (genres as readonly string[]).includes(g)) {
      setGenre(g as Genre);
      setPrompt(starters[g as Genre]);
    }
    Promise.all([
      fetch("/api/platform/models").then((r) =>
        r.ok ? r.json() : { models: [] },
      ),
      fetch("/api/billing/status").then((r) =>
        r.ok ? r.json() : { subscriptions: [] },
      ),
    ])
      .then(([m, s]) => {
        setModels(m.models ?? []);
        setModel(m.models?.[0]?.id ?? "");
        setSub(
          (s.subscriptions ?? []).find((x: Sub) => x.status === "active") ??
            null,
        );
      })
      .catch(() => {
        setSub(null);
        setError("Studio indisponible. Réessayez.");
      });
  }, []);

  const selected = models.find((m) => m.id === model);
  const balance = sub ? Number(sub.available_credits) : 0;
  const enough = !!selected && balance >= selected.credits;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const jobId = id || crypto.randomUUID();
    setId(jobId);
    try {
      const r = await fetch("/api/platform/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: jobId, model, prompt }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      location.assign("/gallery");
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Non confirmé. Réessayez sans modifier le texte.",
      );
      setBusy(false);
    }
  }

  if (sub === undefined)
    return (
      <div className="page studio-page">
        <div className="skeleton" aria-busy="true" aria-label="Chargement" />
      </div>
    );

  if (sub === null)
    return (
      <div className="page">
        <Paywall
          compact
          title="Débloquez le studio."
          subtitle="Choisissez une formule. Créez tout de suite."
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );

  return (
    <div className="page studio-page">
      <header className="page-head">
        <RiseText text="Créer." />
        <div className="balance" aria-live="polite">
          <strong>{balance.toLocaleString("fr-FR")}</strong> crédits
        </div>
      </header>

      <form className="composer" onSubmit={submit}>
        <span className="field-label">Genre</span>
        <Segmented
          options={genres}
          value={genre}
          label="Genre"
          onChange={(g) => {
            setGenre(g);
            if (!prompt.trim() || Object.values(starters).includes(prompt))
              setPrompt(starters[g]);
            setId("");
          }}
        />

        <label className="field-label" htmlFor="generation-prompt">
          Prompt
        </label>
        <textarea
          id="generation-prompt"
          disabled={busy}
          minLength={3}
          maxLength={2500}
          required
          rows={5}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setId("");
          }}
          placeholder="Sujet, mouvement de caméra, lumière."
        />
        <div className="hint-row">
          <span>Sujet · caméra · lumière</span>
          <span>{prompt.length}/2500</span>
        </div>

        <span className="field-label">Format</span>
        <div className="format-choice" role="radiogroup" aria-label="Format">
          {models.map((m) => (
            <button
              type="button"
              role="radio"
              aria-checked={m.id === model}
              key={m.id}
              className={m.id === model ? "active" : ""}
              disabled={busy}
              onClick={() => {
                setModel(m.id);
                setId("");
              }}
            >
              <span
                className={`ratio ${isTall(m) ? "tall" : "wide"}`}
                aria-hidden
              />
              <strong>{isTall(m) ? "9:16" : "16:9"}</strong>
              <small>{isTall(m) ? "Reels · TikTok" : "YouTube · Web"}</small>
            </button>
          ))}
          {!models.length && <p>Aucun format disponible.</p>}
        </div>

        <div className="launch">
          <div>
            <strong>{selected ? `${selected.credits} crédits` : "—"}</strong>
            <span>{enough ? "HD 720p · son" : "Crédits insuffisants"}</span>
          </div>
          <button
            className="button primary big"
            disabled={busy || !enough || prompt.trim().length < 3}
          >
            {busy ? "Lancement…" : "Générer"}
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="fine-print">
          Prête en quelques minutes dans{" "}
          <Link href="/gallery">Mes créations</Link>. Échec = crédits rendus.
        </p>
      </form>
    </div>
  );
}
