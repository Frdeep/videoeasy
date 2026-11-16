"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Artwork } from "./artwork";
const inspirations = {
  orb: "Une sphère de verre irisée flotte dans un espace sombre. Lumière violette, reflets subtils, mouvement lent de caméra, ambiance cinématographique.",
  dune: "Un paysage de dunes au coucher du soleil. Une brume légère traverse les reliefs, palette ambrée, travelling lent et contemplatif.",
  bloom:
    "Une sculpture florale abstraite aux pétales translucides. Éclairage de studio doux, textures délicates et composition minimaliste.",
};
export function Studio({ preview = false }: { preview?: boolean }) {
  const [kind, setKind] = useState("video");
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState("16:9");
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const draft = localStorage.getItem("videoeasy-prompt-draft");
      if (draft) setPrompt(draft);
      const idea = new URLSearchParams(location.search).get("idea");
      if (idea && idea in inspirations)
        setPrompt(inspirations[idea as keyof typeof inspirations]);
    } catch {}
  }, []);
  function save() {
    try {
      localStorage.setItem("videoeasy-prompt-draft", prompt);
      setSaved(true);
      setNotice("Brouillon enregistré sur cet appareil.");
    } catch {
      setNotice(
        "Le stockage local est indisponible. Copiez votre texte pour le conserver.",
      );
    }
  }
  return (
    <div className="workspace">
      <aside className="studio-sidebar">
        <p className="eyebrow">VOTRE ESPACE CRÉATIF</p>
        <h2>
          Studio<span>✦</span>
        </h2>
        <div className="sidebar-links">
          <Link className="selected" href={preview ? "/explore" : "/studio"}>
            ✧ <span>Créer une idée</span>
            <span>→</span>
          </Link>
          <Link href="/gallery">
            ▦ <span>Mes créations</span>
          </Link>
          <Link href="/account">
            ◷ <span>Mon abonnement</span>
          </Link>
        </div>
        <div className="sidebar-note">
          <span className="status-dot" />
          <h3>Tout commence par une idée.</h3>
          <p>
            Décrivez une scène, une lumière, une émotion. Le reste se construit
            ici.
          </p>
        </div>
        <Link className="sidebar-bottom" href="/pricing">
          Découvrir les formules →
        </Link>
      </aside>
      <div className="studio-main">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {preview ? "DÉCOUVRIR LE STUDIO" : "STUDIO PERSONNEL"}
            </p>
            <h1>Que voulez-vous imaginer ?</h1>
          </div>
          <span className="pill">
            {preview ? "Aperçu interactif" : "Bêta privée"}
          </span>
        </div>
        <div className="studio-columns">
          <section className="composer">
            <div className="tabs" role="group" aria-label="Type de création">
              <button
                className={kind === "video" ? "active" : ""}
                aria-pressed={kind === "video"}
                onClick={() => {
                  setKind("video");
                  setNotice("");
                }}
              >
                ◁ Vidéo
              </button>
              <button
                className={kind === "image" ? "active" : ""}
                aria-pressed={kind === "image"}
                onClick={() => {
                  setKind("image");
                  setNotice("");
                }}
              >
                ▧ Image
              </button>
            </div>
            <label className="field-label" htmlFor="prompt">
              Votre idée <span>{prompt.length}/2500</span>
            </label>
            <textarea
              id="prompt"
              maxLength={2500}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setSaved(false);
              }}
              placeholder="Une ville futuriste sous la pluie, des reflets néon dans les rues, un travelling lent au niveau du sol…"
            />
            <div className="prompt-tools">
              <button
                className="text-link"
                onClick={() => {
                  setPrompt(inspirations[kind === "video" ? "dune" : "bloom"]);
                  setSaved(false);
                }}
              >
                ✦ M’inspirer
              </button>
              <button
                className="text-link"
                onClick={() => {
                  setPrompt("");
                  setSaved(false);
                  try {
                    localStorage.removeItem("videoeasy-prompt-draft");
                  } catch {}
                  setNotice("Brouillon effacé.");
                }}
              >
                Effacer
              </button>
            </div>
            <label className="field-label" htmlFor="model">
              Modèle
            </label>
            <select id="model" disabled>
              <option>Catalogue en cours de validation</option>
            </select>
            <p className="field-hint">
              Les modèles seront proposés après validation de leur coût et de
              leurs conditions d’utilisation.
            </p>
            <label className="field-label">Format de composition</label>
            <div
              className="ratios"
              role="group"
              aria-label="Format de composition"
            >
              {["16:9", "9:16", "1:1"].map((r) => (
                <button
                  key={r}
                  aria-pressed={ratio === r}
                  className={ratio === r ? "active" : ""}
                  onClick={() => setRatio(r)}
                >
                  <span className={"ratio-icon ratio-" + r.replace(":", "-")} />
                  {r}
                </button>
              ))}
            </div>
            <div className="cost-line">
              <span>Coût de génération</span>
              <span>Disponible à l’ouverture</span>
            </div>
            <button className="button primary full" disabled>
              Génération bientôt disponible <span>✦</span>
            </button>
            <button
              className="button secondary full"
              disabled={!prompt.trim() || saved}
              onClick={save}
            >
              {saved ? "Brouillon enregistré" : "Enregistrer mon brouillon"}
            </button>
            <p className="field-hint">
              Le brouillon reste sur cet appareil. Aucune génération ni
              consommation de crédits dans cet aperçu.
            </p>
            <p className="notice" role="status">
              {notice}
            </p>
          </section>
          <section className="studio-preview">
            <div className="preview-stage">
              <div
                className="preview-art"
                style={{ aspectRatio: ratio.replace(":", " / ") }}
              >
                <Artwork
                  variant={kind === "video" ? "orb" : "bloom"}
                  label="Illustration abstraite du studio, pas un résultat généré"
                />
                <span className="preview-badge">ILLUSTRATION · {ratio}</span>
              </div>
            </div>
            <div className="preview-description">
              <span className="outline-star">✦</span>
              <h2>Une place pour votre imagination.</h2>
              <p>
                Votre résultat apparaîtra ici une fois la génération disponible.
                En attendant, préparez votre prochain univers.
              </p>
              {preview && (
                <Link className="text-link" href="/login">
                  Me connecter à mon espace →
                </Link>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
