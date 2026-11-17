"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "./i18n";
import { Segmented } from "./motion";

export type VideoRef = { kind: "job" | "montage" | "short"; id: string; index?: number };

const durations = ["24 h", "7 jours", "30 jours"] as const;
const DAYS: Record<(typeof durations)[number], 1 | 7 | 30> = {
  "24 h": 1,
  "7 jours": 7,
  "30 jours": 30,
};

/** File transfer: creates an expiring private link to one video and lets the
 * user copy or share it (WhatsApp, e-mail, native share sheet). */
export function TransferDialog({ video, onClose }: { video: VideoRef; onClose: () => void }) {
  const { t, dl } = useT();
  const [duration, setDuration] = useState<(typeof durations)[number]>("7 jours");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  async function create() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: video.kind,
          id: video.id,
          ...(video.kind === "short" ? { index: video.index ?? 0 } : {}),
          days: DAYS[duration],
          ...(message.trim() ? { message: message.trim() } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(t(d.error ?? "Transfert impossible."));
      setLink(d);
    } catch (e) {
      setError((e as Error).message || t("Transfert impossible."));
    } finally {
      setBusy(false);
    }
  }

  const text = link ? `${message.trim() ? `${message.trim()}\n` : ""}${link.url}` : "";
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal
        aria-label={t("Transférer la vidéo")}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="sheet-grip" aria-hidden />
        <h2>{t("Transférer la vidéo")}</h2>
        {!link ? (
          <>
            <p className="sheet-sub">
              {t("Créez un lien privé. La personne pourra voir et télécharger la vidéo, sans compte.")}
            </p>
            <span className="field-label">{t("Valable")}</span>
            <Segmented options={durations} value={duration} onChange={setDuration} label="Valable" />
            <label className="field-label" htmlFor="transfer-msg">
              {t("Message (facultatif)")}
            </label>
            <textarea
              id="transfer-msg"
              rows={3}
              maxLength={280}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("Voici la vidéo dont je t’ai parlé.")}
            />
            {error && <p className="form-error">{error}</p>}
            <div className="sheet-actions">
              <button className="button primary big" disabled={busy} onClick={() => void create()}>
                {busy ? t("Création…") : t("Créer le lien")}
              </button>
              <button className="text-link" onClick={onClose}>
                {t("Annuler")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="sheet-sub">
              {t("Lien prêt. Valable jusqu’au {date}.", {
                date: new Date(link.expiresAt).toLocaleDateString(dl, { dateStyle: "long" }),
              })}
            </p>
            <input className="link-field" readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} />
            <div className="share-grid">
              <button
                className="button primary"
                onClick={() =>
                  void navigator.clipboard.writeText(link.url).then(() => setCopied(true))
                }
              >
                {copied ? t("Copié") : t("Copier le lien")}
              </button>
              <a
                className="button outline"
                href={`https://wa.me/?text=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
              <a
                className="button outline"
                href={`mailto:?subject=${encodeURIComponent(t("Une vidéo pour vous"))}&body=${encodeURIComponent(text)}`}
              >
                {t("E-mail")}
              </a>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <button
                  className="button outline"
                  onClick={() =>
                    void navigator.share({ title: t("Une vidéo pour vous"), text, url: link.url }).catch(() => {})
                  }
                >
                  {t("Partager…")}
                </button>
              )}
            </div>
            <button className="text-link" onClick={onClose}>
              {t("Terminé")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const KEPT = "videoeasy-kept";
function readKept(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEPT) ?? "[]");
  } catch {
    return [];
  }
}

/** Guide shown on a freshly finished video: edit, transfer, or keep as is.
 * Every step is optional; « Garder comme ça » hides the guide for that video. */
export function NextSteps({ video, onTransfer }: { video: VideoRef; onTransfer: () => void }) {
  const { t } = useT();
  const [hidden, setHidden] = useState(true);
  useEffect(() => setHidden(readKept().includes(video.id)), [video.id]);
  if (hidden) return null;
  const keep = () => {
    try {
      localStorage.setItem(KEPT, JSON.stringify([...readKept(), video.id].slice(-300)));
    } catch {}
    setHidden(true);
  };
  return (
    <div className="next-steps">
      <strong>{t("Et maintenant ?")}</strong>
      <div>
        <Link className="step-btn" href={`/montage?from=${video.kind}:${video.id}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path d="M6 4v16M18 4v16M6 8h12M6 16h12" />
          </svg>
          {t("Monter")}
        </Link>
        <button className="step-btn" onClick={onTransfer}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path d="M4 12h13M12 6l6 6-6 6" />
          </svg>
          {t("Transférer")}
        </button>
        <button className="step-btn ghost" onClick={keep}>
          {t("Garder comme ça")}
        </button>
      </div>
    </div>
  );
}
