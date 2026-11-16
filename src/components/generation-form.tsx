"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type Model = {
  id: string;
  name: string;
  kind: string;
  credits: number;
  provider: string;
};
export function GenerationForm() {
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Chargement des modèles…");
  useEffect(() => {
    fetch("/api/platform/models")
      .then(async (r) => {
        if (!r.ok) throw Error();
        const d = await r.json();
        setModels(d.models);
        setModel(d.models[0]?.id ?? "");
        setMessage(
          d.models.length
            ? ""
            : "Aucun modèle activé. Vos crédits ne seront pas débités.",
        );
      })
      .catch(() => setMessage("Catalogue indisponible. Réessayez plus tard."));
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
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
      setMessage(
        e instanceof Error
          ? e.message
          : "Demande non confirmée. Réessayez sans modifier le prompt.",
      );
      setBusy(false);
    }
  }
  return (
    <section className="section private-page">
      <div className="section-heading">
        <div>
          <h1>Nouvelle création</h1>
          <p>
            Décrivez votre idée. La réservation des crédits est vérifiée par le
            serveur.
          </p>
        </div>
        <Link href="/gallery">Mes créations →</Link>
      </div>
      <form className="composer generation-form" onSubmit={submit}>
        <label className="field-label" htmlFor="generation-model">
          Modèle
        </label>
        <select
          id="generation-model"
          disabled={busy || !models.length}
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setId("");
          }}
        >
          {!models.length && <option value="">Aucun modèle activé</option>}
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.credits} crédits{" "}
              {m.provider === "mock" ? "· TEST SIMULÉ" : ""}
            </option>
          ))}
        </select>
        <label className="field-label" htmlFor="generation-prompt">
          Votre prompt
        </label>
        <textarea
          id="generation-prompt"
          disabled={busy}
          minLength={3}
          maxLength={2500}
          required
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setId("");
          }}
          placeholder="Décrivez la scène, la lumière et le cadrage…"
        />
        <p>
          Les modèles marqués « test simulé » produisent un fichier technique,
          pas une création IA. Ils nécessitent un abonnement test payé et sont
          traités par le worker de test.
        </p>
        <button
          className="button primary"
          disabled={busy || !model || prompt.trim().length < 3}
        >
          {busy ? "Envoi de la demande…" : "Envoyer la demande"}
        </button>
        <p role="status">{message}</p>
      </form>
    </section>
  );
}
