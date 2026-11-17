"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Reveal, RiseText, Segmented } from "./motion";
import { useSnapIndex } from "./use-mobile";
import { useT } from "./i18n";
import { TransferDialog } from "./video-actions";

// Long video -> shorts. Upload goes straight from the browser to private
// storage (signed URL); the server hands it to the engine and imports the
// clips back. Montage styles beyond centred reframing are not live yet.
const captionStyles = [
  { id: "karaoke", name: "Karaoké" },
  { id: "bold", name: "Bold" },
  { id: "box", name: "Box" },
  { id: "pop", name: "Pop" },
  { id: "minimal", name: "Minimal" },
] as const;
const montages = [
  { id: "dynamic", name: "Dynamique", desc: "Zooms, coupes rapides" },
  { id: "podcast", name: "Podcast", desc: "Cadrage sur qui parle" },
  { id: "tuto", name: "Tuto", desc: "Sous-titres + emojis" },
  { id: "story", name: "Storytime", desc: "Rythme posé" },
] as const;
const lengths = ["15 s", "30 s", "60 s", "90 s"] as const;
const counts = ["3", "5", "10"] as const;
const ratios = ["9:16", "1:1", "16:9"] as const;
const SAMPLE = "Personne ne te dit ça sur la création de contenu";
const MAX_BYTES = 200 * 1024 * 1024;
const STEP: Record<string, string> = {
  submitting: "Envoi au moteur",
  queued: "En file d’attente",
  downloading: "Réception de la vidéo",
  transcribing: "Transcription",
  rendering: "Montage des clips",
  importing: "Finalisation",
};
const ERRORS: Record<string, string> = {
  "no speech detected": "Aucune voix détectée dans la vidéo.",
  "no audio stream": "La vidéo n’a pas de son.",
  "source too long": "Vidéo trop longue (90 min maximum).",
  "source too short for the requested clip length":
    "Vidéo trop courte pour cette durée de clip.",
};

type Clip = { index: number; start: number; end: number; text: string; ready: boolean };
type Run = {
  id: string;
  status: "processing" | "importing" | "succeeded" | "failed";
  engine_state: string | null;
  options: { count: number; length: number; ratio: string; caption: string };
  clips: Clip[];
  error_code: string | null;
  created_at: string;
};
type Quota = { freeUsed: number; freeLimit: number; subscribed: boolean };

function CaptionPreview({ style }: { style: string }) {
  const { t } = useT();
  const sample = t(SAMPLE).split(" ");
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % sample.length), 420);
    return () => clearInterval(t);
  }, [sample.length]);
  const start = Math.max(0, Math.min(i - 1, sample.length - 3));
  return (
    <div className={`cap cap-${style}`} aria-hidden>
      {sample.slice(start, start + 3).map((w, n) => (
        <span key={`${start}-${n}`} className={start + n === i ? "on" : ""}>
          {w}
        </span>
      ))}
    </div>
  );
}

const clipUrl = (run: string, n: number, view = true) =>
  `/api/shorts/${run}/clips/${n}${view ? "?view=1" : ""}`;

/** Full-screen vertical swipe viewer, one clip per screen (TikTok-like). */
function ClipViewer({
  run,
  start,
  onClose,
}: {
  run: Run;
  start: number;
  onClose: () => void;
}) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const current = useSnapIndex(ref, "y");
  const [sending, setSending] = useState<number | null>(null);
  const clips = run.clips.filter((c) => c.ready);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = start * el.clientHeight;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [start]);
  useEffect(() => {
    ref.current?.querySelectorAll("video").forEach((v, i) => {
      if (i === current) void v.play().catch(() => {});
      else v.pause();
    });
  }, [current]);
  return (
    <div className="viewer" role="dialog" aria-modal aria-label={t("Vos shorts")}>
      <div className="viewer-track" ref={ref}>
        {clips.map((c) => (
          <section key={c.index} className="viewer-slide">
            <video
              src={clipUrl(run.id, c.index)}
              playsInline
              loop
              preload="metadata"
              controls={false}
              onClick={(e) =>
                e.currentTarget.paused
                  ? void e.currentTarget.play()
                  : e.currentTarget.pause()
              }
            />
            <div className="viewer-meta">
              <strong>{t("Short {n}", { n: c.index + 1 })}</strong>
              <p>{c.text}</p>
            </div>
          </section>
        ))}
      </div>
      <button className="viewer-close" onClick={onClose} aria-label={t("Fermer")}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
      {clips[current] && (
        <a
          className="viewer-download"
          href={clipUrl(run.id, clips[current].index, false)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
          </svg>
          {t("Télécharger")}
        </a>
      )}
      {clips[current] && (
        <button className="viewer-transfer" onClick={() => setSending(clips[current].index)}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <path d="M4 12h13M12 6l6 6-6 6" />
          </svg>
          {t("Transférer")}
        </button>
      )}
      {sending !== null && (
        <TransferDialog video={{ kind: "short", id: run.id, index: sending }} onClose={() => setSending(null)} />
      )}
      <span className="viewer-count">
        {current + 1} / {clips.length}
      </span>
    </div>
  );
}

function RunCard({ run, onOpen }: { run: Run; onOpen: (n: number) => void }) {
  const { t, dl } = useT();
  const busy = run.status === "processing" || run.status === "importing";
  const ready = run.clips.filter((c) => c.ready);
  const when = new Date(run.created_at).toLocaleString(dl, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <article className={`run run-${run.status}`}>
      <header>
        <strong>
          {t("{n} shorts", { n: run.options.count })} · {run.options.length} s ·{" "}
          {run.options.ratio}
        </strong>
        <span>{when}</span>
      </header>
      {busy && (
        <div className="run-progress">
          <i />
          <span>
            {t(STEP[run.engine_state ?? "queued"] ?? "Traitement")}…{" "}
            {t("quelques minutes.")}
          </span>
        </div>
      )}
      {run.status === "failed" && (
        <p className="run-error">
          {t(
            ERRORS[run.error_code ?? ""] ??
              "Le découpage a échoué. Il ne compte pas dans votre quota.",
          )}
        </p>
      )}
      {run.status === "succeeded" && (
        <div className="clip-rail">
          {ready.map((c, i) => (
            <div
              key={c.index}
              className="clip-thumb"
              role="button"
              tabIndex={0}
              onClick={() => onOpen(i)}
              onKeyDown={(e) => e.key === "Enter" && onOpen(i)}
            >
              <video src={`${clipUrl(run.id, c.index)}#t=0.5`} muted playsInline preload="metadata" />
              <span>{Math.round(c.end - c.start)} s</span>
              <a
                className="thumb-dl"
                href={clipUrl(run.id, c.index, false)}
                onClick={(e) => e.stopPropagation()}
                aria-label={t("Télécharger")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
                </svg>
              </a>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export function ShortsStudio() {
  const { t } = useT();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState<string>("karaoke");
  const [length, setLength] = useState<(typeof lengths)[number]>("30 s");
  const [count, setCount] = useState<(typeof counts)[number]>("5");
  const [ratio, setRatio] = useState<(typeof ratios)[number]>("9:16");
  const [runs, setRuns] = useState<Run[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [viewer, setViewer] = useState<{ run: Run; start: number } | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/shorts", { cache: "no-store" }).catch(() => null);
    if (!r) return;
    if (r.status === 401) return setSignedOut(true);
    if (!r.ok) return;
    const data = (await r.json()) as { shorts: Run[]; quota: Quota };
    setRuns(data.shorts);
    setQuota(data.quota);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  const busy = runs.some((r) => r.status === "processing" || r.status === "importing");
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => void refresh(), 6000);
    return () => clearInterval(t);
  }, [busy, refresh]);

  const pick = (f: File | undefined) => {
    setError("");
    if (!f) return;
    if (!["video/mp4", "video/quicktime", "video/webm"].includes(f.type))
      return setError(t("Format accepté : MP4, MOV ou WebM."));
    if (f.size > MAX_BYTES) return setError(t("200 Mo maximum par vidéo."));
    setFile(f);
  };

  const launch = async () => {
    if (!file || progress !== null) return;
    setError("");
    const id = crypto.randomUUID();
    try {
      setProgress(0);
      const res = await fetch("/api/shorts/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, bytes: file.size, type: file.type }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) return setSignedOut(true);
      if (!res.ok) throw new Error(t(data.error ?? "Envoi impossible."));
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", data.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) =>
          e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () =>
          xhr.status < 300 ? resolve() : reject(new Error(t("Envoi interrompu. Réessayez.")));
        xhr.onerror = () => reject(new Error(t("Connexion perdue pendant l’envoi.")));
        xhr.send(file);
      });
      const go = await fetch(`/api/shorts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: Number(count),
          length: parseInt(length, 10),
          ratio,
          caption,
        }),
      });
      if (!go.ok) throw new Error(t((await go.json().catch(() => ({}))).error ?? "Lancement impossible."));
      setFile(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const freeLeft = quota && !quota.subscribed ? quota.freeLimit - quota.freeUsed : null;
  const blocked = freeLeft !== null && freeLeft <= 0;

  return (
    <div className="page shorts-page">
      <header className="shorts-hero">
        {freeLeft !== null && (
          <span className="soon-pill">
            {freeLeft > 0
              ? t(freeLeft > 1 ? "{n} découpages offerts" : "{n} découpage offert", { n: freeLeft })
              : t("Offre gratuite utilisée")}
          </span>
        )}
        <RiseText text="Une vidéo longue. Dix shorts." />
        <p className="hero-sub">
          {t("L’IA trouve les meilleurs moments, recadre et sous-titre.")}
        </p>
      </header>

      {runs.length > 0 && (
        <section className="runs" aria-label={t("Vos découpages")}>
          {runs.map((r) => (
            <RunCard key={r.id} run={r} onOpen={(n) => setViewer({ run: r, start: n })} />
          ))}
        </section>
      )}

      <div className="shorts-layout">
        <section className="composer">
          <span className="field-label">{t("Source")}</span>
          <button
            type="button"
            className={`drop${file ? " has-file" : ""}`}
            onClick={() => picker.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pick(e.dataTransfer.files[0]);
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
            </svg>
            <span>
              {file
                ? `${file.name} · ${(file.size / 1048576).toFixed(0)} Mo`
                : t("Choisir une vidéo (MP4, MOV, WebM · 200 Mo max)")}
            </span>
          </button>
          <input
            ref={picker}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            hidden
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <p className="fine-print">
            {t("La vidéo doit contenir de la parole. Les liens YouTube ne sont pas pris en charge.")}
          </p>

          <span className="field-label">{t("Sous-titres")}</span>
          <div className="cap-grid" role="radiogroup" aria-label={t("Style de sous-titres")}>
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
                <strong>{t(c.name)}</strong>
              </button>
            ))}
          </div>

          <span className="field-label">
            {t("Montage")} <em className="soon-tag">{t("Bientôt")}</em>
          </span>
          <div className="preset-grid" aria-disabled>
            {montages.map((m) => (
              <div key={m.id} className="preset off">
                <strong>{t(m.name)}</strong>
                <span>{t(m.desc)}</span>
              </div>
            ))}
          </div>

          <div className="shorts-options">
            <div>
              <span className="field-label">{t("Durée")}</span>
              <Segmented options={lengths} value={length} onChange={setLength} label="Durée" />
            </div>
            <div>
              <span className="field-label">{t("Clips")}</span>
              <Segmented options={counts} value={count} onChange={setCount} label="Nombre de clips" />
            </div>
            <div>
              <span className="field-label">{t("Format")}</span>
              <Segmented options={ratios} value={ratio} onChange={setRatio} label="Format" />
            </div>
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="launch">
            <div>
              <strong>
                {t("{n} shorts", { n: count })} · {length}
              </strong>
              <span>
                {progress !== null
                  ? t("Envoi {p} %", { p: progress })
                  : `${ratio} · ${t(captionStyles.find((c) => c.id === caption)?.name ?? "")}`}
              </span>
            </div>
            {signedOut ? (
              <Link className="button primary big" href="/login">
                {t("Se connecter")}
              </Link>
            ) : blocked ? (
              <Link className="button primary big" href="/pricing">
                {t("S’abonner")}
              </Link>
            ) : (
              <button
                className="button primary big"
                disabled={!file || progress !== null || busy}
                onClick={() => void launch()}
              >
                {progress !== null ? t("Envoi…") : busy ? t("En cours…") : t("Lancer")}
              </button>
            )}
          </div>
        </section>

        <Reveal className="phone-preview">
          <div className={`phone r-${ratio.replace(":", "x")}`}>
            <div className="phone-screen">
              <span className="phone-tag">{t("Clip 1 / {n}", { n: count })}</span>
              <CaptionPreview style={caption} />
            </div>
          </div>
        </Reveal>
      </div>

      {viewer && (
        <ClipViewer run={viewer.run} start={viewer.start} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}
