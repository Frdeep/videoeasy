"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Reveal, RiseText, Segmented } from "./motion";

// Clipping (long video -> shorts). Interface and presets are ready; the
// processing pipeline (transcription, moment detection, render) is NOT live
// yet, so launching stays disabled and clearly labelled.
const captionStyles = [
  { id: "karaoke", name: "Karaoké" },
  { id: "bold", name: "Bold" },
  { id: "box", name: "Box" },
  { id: "pop", name: "Pop" },
  { id: "minimal", name: "Minimal" },
] as const;
const montages = [
  { id: "dynamic", name: "Dynamique", desc: "Zooms, coupes rapides, B-roll" },
  { id: "podcast", name: "Podcast", desc: "Cadrage sur qui parle" },
  { id: "tuto", name: "Tuto", desc: "Sous-titres + emojis" },
  { id: "story", name: "Storytime", desc: "Musique douce, rythme posé" },
] as const;
const lengths = ["15 s", "30 s", "60 s", "90 s"] as const;
const counts = ["3", "5", "10"] as const;
const ratios = ["9:16", "1:1", "16:9"] as const;
const sample = "Personne ne te dit ça sur la création de contenu".split(" ");

function CaptionPreview({ style }: { style: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % sample.length), 420);
    return () => clearInterval(t);
  }, []);
  const start = Math.max(0, Math.min(i - 1, sample.length - 3));
  const words = sample.slice(start, start + 3);
  return (
    <div className={`cap cap-${style}`} aria-hidden>
      {words.map((w, n) => (
        <span key={`${start}-${n}`} className={start + n === i ? "on" : ""}>
          {w}
        </span>
      ))}
    </div>
  );
}

export function ShortsStudio() {
  const [source, setSource] = useState("");
  const [caption, setCaption] = useState<string>("karaoke");
  const [montage, setMontage] = useState<string>("dynamic");
  const [length, setLength] = useState<(typeof lengths)[number]>("30 s");
  const [count, setCount] = useState<(typeof counts)[number]>("5");
  const [ratio, setRatio] = useState<(typeof ratios)[number]>("9:16");

  return (
    <div className="page shorts-page">
      <header className="shorts-hero">
        <span className="soon-pill">Bientôt</span>
        <RiseText text="Une vidéo longue. Dix shorts." />
        <p className="hero-sub">
          L’IA trouve les meilleurs moments, recadre et sous-titre.
        </p>
      </header>

      <div className="shorts-layout">
        <section className="composer">
          <label className="field-label" htmlFor="src">
            Source
          </label>
          <div className="drop">
            <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
            </svg>
            <input
              id="src"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Collez un lien YouTube ou déposez une vidéo"
            />
          </div>

          <span className="field-label">Sous-titres</span>
          <div
            className="cap-grid"
            role="radiogroup"
            aria-label="Style de sous-titres"
          >
            {captionStyles.map((c) => (
              <button
                type="button"
                role="radio"
                aria-checked={c.id === caption}
                key={c.id}
                className={c.id === caption ? "cap-card on" : "cap-card"}
                onClick={() => setCaption(c.id)}
              >
                <CaptionPreview style={c.id} />
                <strong>{c.name}</strong>
              </button>
            ))}
          </div>

          <span className="field-label">Montage</span>
          <div className="preset-grid">
            {montages.map((m) => (
              <button
                type="button"
                key={m.id}
                className={m.id === montage ? "preset on" : "preset"}
                onClick={() => setMontage(m.id)}
              >
                <strong>{m.name}</strong>
                <span>{m.desc}</span>
              </button>
            ))}
          </div>

          <div className="shorts-options">
            <div>
              <span className="field-label">Durée</span>
              <Segmented
                options={lengths}
                value={length}
                onChange={setLength}
                label="Durée"
              />
            </div>
            <div>
              <span className="field-label">Clips</span>
              <Segmented
                options={counts}
                value={count}
                onChange={setCount}
                label="Nombre de clips"
              />
            </div>
            <div>
              <span className="field-label">Format</span>
              <Segmented
                options={ratios}
                value={ratio}
                onChange={setRatio}
                label="Format"
              />
            </div>
          </div>

          <div className="launch">
            <div>
              <strong>
                {count} shorts · {length}
              </strong>
              <span>
                {ratio} · {captionStyles.find((c) => c.id === caption)?.name} ·{" "}
                {montages.find((m) => m.id === montage)?.name}
              </span>
            </div>
            <button className="button primary big" disabled>
              Bientôt disponible
            </button>
          </div>
        </section>

        <Reveal className="phone-preview">
          <div className={`phone r-${ratio.replace(":", "x")}`}>
            <div className="phone-screen">
              <span className="phone-tag">Clip 1 / {count}</span>
              <CaptionPreview style={caption} />
            </div>
          </div>
          <p className="fine-print">
            En attendant : créez vos vidéos IA dans le{" "}
            <Link href="/studio">Studio</Link>.
          </p>
        </Reveal>
      </div>
    </div>
  );
}
