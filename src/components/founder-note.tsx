"use client";
import { useRef, useState } from "react";
import { founderVideo } from "@/lib/showcase";
import { useT } from "./i18n";

/** « Le mot du fondateur » — Cisco's video, shown in the footer of every page.
 * Hidden until `founderVideo.src` is set in src/lib/showcase.ts. */
export function FounderNote() {
  const { t } = useT();
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  if (!founderVideo.src) return null;
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      v.muted = false;
      void v.play();
    } else v.pause();
  };
  return (
    <section className="founder" aria-label={t("Le mot du fondateur")}>
      <div className={`founder-media${playing ? " playing" : ""}`}>
        <video
          ref={ref}
          src={founderVideo.src}
          poster={founderVideo.poster || undefined}
          playsInline
          preload="metadata"
          controls={playing}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
        {!playing && (
          <button className="founder-play" onClick={toggle} aria-label={t("Lire la vidéo")}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        )}
      </div>
      <div className="founder-text">
        <span className="founder-kicker">{t("Le mot du fondateur")}</span>
        <h2>{t("Pourquoi j’ai créé VideoEasy.")}</h2>
        <p>{t("Cisco, fondateur de VideoEasy")}</p>
      </div>
    </section>
  );
}
