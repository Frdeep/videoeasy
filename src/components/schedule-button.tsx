"use client";
import { useState } from "react";

export const channels = [
  ["tiktok", "TikTok"],
  ["instagram", "Instagram"],
  ["youtube", "YouTube"],
  ["facebook", "Facebook"],
  ["linkedin", "LinkedIn"],
  ["autre", "Autre"],
] as const;

function toLocalInput(iso: string | null) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 86400000);
  if (!iso) d.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Puts a finished video in the personal calendar (date, network, note). */
export function ScheduleButton({
  jobId,
  scheduledAt,
  channel,
  note,
  onSaved,
}: {
  jobId: string;
  scheduledAt: string | null;
  channel: string | null;
  note: string | null;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState(toLocalInput(scheduledAt));
  const [net, setNet] = useState(channel ?? "tiktok");
  const [text, setText] = useState(note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(remove = false) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/platform/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          remove
            ? { scheduledAt: null }
            : {
                scheduledAt: new Date(when).toISOString(),
                channel: net,
                note: text || null,
              },
        ),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setOpen(false);
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Enregistrement impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <button className="schedule-open" onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        {scheduledAt
          ? new Date(scheduledAt).toLocaleString("fr-FR", {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "Planifier"}
      </button>
    );

  return (
    <div className="schedule-panel">
      <label className="field-label" htmlFor={`when-${jobId}`}>
        Date de publication
      </label>
      <input
        id={`when-${jobId}`}
        type="datetime-local"
        value={when}
        onChange={(e) => setWhen(e.target.value)}
      />
      <div className="chips">
        {channels.map(([v, l]) => (
          <button
            type="button"
            key={v}
            className={v === net ? "chip on" : "chip"}
            onClick={() => setNet(v)}
          >
            {l}
          </button>
        ))}
      </div>
      <input
        value={text}
        maxLength={280}
        placeholder="Note (légende, hashtags…)"
        onChange={(e) => setText(e.target.value)}
      />
      {error && <p className="form-error">{error}</p>}
      <div className="schedule-actions">
        <button
          className="button primary"
          disabled={busy || !when}
          onClick={() => save()}
        >
          {busy ? "…" : "Enregistrer"}
        </button>
        {scheduledAt && (
          <button
            className="button ghost"
            disabled={busy}
            onClick={() => save(true)}
          >
            Retirer
          </button>
        )}
        <button
          className="text-link"
          type="button"
          onClick={() => setOpen(false)}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
