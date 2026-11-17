"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Paywall } from "./paywall";

type Model = {
  id: string;
  name: string;
  kind: string;
  credits: number;
  provider: string;
};
type Sub = { status: string; plan: string; available_credits: string | number };

const ideas: Record<string, string> = {
  dune: "Lever de soleil sur une vallée brumeuse, travelling lent vers l’avant, lumière dorée, ambiance calme et cinématographique.",
  orb: "Rue de ville la nuit sous la pluie, reflets de néons sur le sol mouillé, caméra à l’épaule qui avance doucement.",
  bloom:
    "Portrait en gros plan d’une femme qui se retourne vers la caméra, lumière douce de fin de journée, fond flou.",
};

function formatOf(m: Model) {
  return m.name.includes("9:16")
    ? "Vertical 9:16"
    : m.name.includes("16:9")
      ? "Paysage 16:9"
      : m.name;
}

export function GenerationForm() {
  const [models, setModels] = useState<Model[]>([]);
  const [sub, setSub] = useState<Sub | null | undefined>(undefined);
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const idea = new URLSearchParams(location.search).get("idea");
    if (idea && ideas[idea]) setPrompt(ideas[idea]);
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
        setError(
          "Le studio est momentanément indisponible. Réessayez dans un instant.",
        );
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
          : "Demande non confirmée. Réessayez sans modifier votre texte.",
      );
      setBusy(false);
    }
  }

  if (sub === undefined)
    return (
      <div className="page studio-page">
        <div
          className="skeleton"
          aria-busy="true"
          aria-label="Chargement du studio"
        />
      </div>
    );

  if (sub === null)
    return (
      <div className="page">
        <Paywall
          compact
          title="Débloquez la création vidéo"
          subtitle="Choisissez une formule pour lancer vos premières vidéos. Vos crédits sont disponibles dès le paiement confirmé."
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
        <div>
          <span className="eyebrow">Studio</span>
          <h1>Nouvelle vidéo</h1>
        </div>
        <div className="balance" aria-live="polite">
          <strong>{balance.toLocaleString("fr-FR")}</strong> crédits disponibles
        </div>
      </header>

      <form className="composer" onSubmit={submit}>
        <label className="field-label" htmlFor="generation-prompt">
          1. Décrivez votre vidéo
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
          placeholder="Ex. : Un phare sous l’orage, vagues qui s’écrasent, caméra en drone qui tourne autour, lumière dramatique."
        />
        <div className="hint-row">
          <span>
            Conseil : décrivez le sujet, le mouvement de caméra et la lumière.
          </span>
          <span>{prompt.length} / 2500</span>
        </div>

        <span className="field-label">2. Choisissez le format</span>
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
                className={`ratio ${m.name.includes("9:16") ? "tall" : "wide"}`}
                aria-hidden
              />
              <strong>{formatOf(m)}</strong>
              <small>5 s · 720p · son</small>
            </button>
          ))}
          {!models.length && <p>Aucun format disponible pour le moment.</p>}
        </div>

        <div className="launch">
          <div>
            <strong>{selected ? `${selected.credits} crédits` : "—"}</strong>
            <span>
              {enough
                ? `Il vous restera ${(balance - (selected?.credits ?? 0)).toLocaleString("fr-FR")} crédits`
                : "Crédits insuffisants pour cette vidéo"}
            </span>
          </div>
          <button
            className="button primary big"
            disabled={busy || !enough || prompt.trim().length < 3}
          >
            {busy ? "Lancement…" : "Générer la vidéo"}
          </button>
        </div>
        <p className="fine-print">
          La génération prend quelques minutes. Vous pouvez quitter la page : la
          vidéo arrivera dans <Link href="/gallery">Mes créations</Link>. En cas
          d’échec, vos crédits vous sont rendus.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
