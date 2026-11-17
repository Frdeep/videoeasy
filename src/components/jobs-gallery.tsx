"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ScheduleButton } from "./schedule-button";
import { useT } from "./i18n";
import { NextSteps, TransferDialog, type VideoRef } from "./video-actions";
import { DownloadLink } from "./download-link";
type Job = {
  id: string;
  prompt: string;
  status: string;
  model_id: string;
  credits: number;
  created_at: string;
  mock_result: boolean;
  provider_state: string | null;
  content_type: string | null;
  scheduled_at: string | null;
  schedule_channel: string | null;
  schedule_note: string | null;
};
const progress: Record<string, string> = {
  submitting: "Envoi au générateur…",
  waiting: "Dans la file du générateur…",
  queuing: "Dans la file du générateur…",
  generating: "Génération en cours…",
  importing: "Enregistrement de la vidéo…",
  import_retry: "Enregistrement de la vidéo…",
};
type Montage = {
  id: string;
  status: "processing" | "importing" | "succeeded" | "failed";
  engine_state: string | null;
  options: { ratio: string; text: string; transition: string };
  duration: string | null;
  error_code: string | null;
  created_at: string;
};

export function JobsGallery() {
  const { t, dl } = useT();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [montages, setMontages] = useState<Montage[]>([]);
  const [transfer, setTransfer] = useState<VideoRef | null>(null);
  const [message, setMessage] = useState("Chargement…");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      const r = await fetch("/api/platform/jobs");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setJobs(d.jobs);
      setMessage("");
      const m = await fetch("/api/montage").then((x) => (x.ok ? x.json() : null)).catch(() => null);
      if (m) setMontages(m.montages);
    } catch {
      setMessage(t("Galerie indisponible. Réessayez."));
    }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, []);
  async function remove(id: string, kind: "job" | "montage" = "job") {
    if (!confirm(t("Retirer cette création de votre galerie ?"))) return;
    setBusy(true);
    try {
      const r = await fetch(
        kind === "job" ? `/api/platform/jobs/${id}` : `/api/montage/${id}`,
        { method: "DELETE" },
      );
      if (!r.ok) throw Error();
      await refresh();
    } catch {
      setMessage(t("Suppression impossible. Réessayez."));
    } finally {
      setBusy(false);
    }
  }
  const labels: Record<string, string> = {
    queued: "En attente",
    running: "En cours",
    succeeded: "Terminée",
    failed: "Échec · crédits rendus",
    uncertain: "À vérifier",
  };
  return (
    <>
      <div className="feed-filters">
        {[
          ["all", "Tout"],
          ["succeeded", "Terminées"],
          ["queued", "En attente"],
          ["failed", "Échecs"],
        ].map(([key, label]) => (
          <button
            className={filter === key ? "active" : ""}
            key={key}
            onClick={() => setFilter(key)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <p role="status">{message === "Chargement…" ? t(message) : message}</p>
      {!message && !jobs.length && !montages.length && (
        <div className="empty-state">
          <h2>{t("Votre première vidéo vous attend.")}</h2>

          <Link className="button primary" href="/studio">
            {t("Créer une vidéo")}
          </Link>
        </div>
      )}
      <div className="media-grid">
        {(filter === "all" || filter === "succeeded" || filter === "failed") &&
          montages
            .filter((m) => filter === "all" || m.status === filter)
            .map((m) => (
              <article className="job-card" key={m.id}>
                <div className="job-preview">
                  {m.status === "succeeded" ? (
                    <video controls playsInline preload="metadata" src={`/api/montage/${m.id}/download?view=1`} />
                  ) : m.status === "failed" ? (
                    t("Le montage a échoué. Il ne compte pas dans votre quota.")
                  ) : (
                    t("Montage en cours…")
                  )}
                </div>
                <h3>
                  <span className="tag">{t("Montage")}</span> {m.options.text || t("Sans texte")}
                </h3>
                <p>
                  {m.options.ratio}
                  {m.duration ? ` · ${Math.round(Number(m.duration))} s` : ""}
                </p>
                <p>{new Date(m.created_at).toLocaleString(dl)}</p>
                {m.status === "succeeded" && (
                  <>
                    <NextSteps video={{ kind: "montage", id: m.id }} onTransfer={() => setTransfer({ kind: "montage", id: m.id })} />
                    <div className="card-actions">
                      <DownloadLink className="text-link" href={`/api/montage/${m.id}/download`}>
                        {t("Télécharger")}
                      </DownloadLink>
                      <button className="text-link" onClick={() => setTransfer({ kind: "montage", id: m.id })}>
                        {t("Transférer")}
                      </button>
                      <a className="text-link" href={`/montage?from=montage:${m.id}`}>
                        {t("Monter")}
                      </a>
                      <a className="text-link" href={`/editor/open?ref=montage:${m.id}`}>
                        {t("Modifier")}
                      </a>
                    </div>
                  </>
                )}
                {["failed", "succeeded"].includes(m.status) && (
                  <button disabled={busy} onClick={() => remove(m.id, "montage")}>
                    {t("Retirer")}
                  </button>
                )}
              </article>
            ))}
        {jobs
          .filter((j) => filter === "all" || j.status === filter)
          .map((j) => (
            <article className="job-card" key={j.id}>
              <div className="job-preview">
                {j.status === "succeeded" &&
                !j.mock_result &&
                j.content_type?.startsWith("video/") ? (
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    src={`/api/platform/jobs/${j.id}/download?view=1`}
                  />
                ) : j.status === "succeeded" &&
                  !j.mock_result &&
                  j.content_type?.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={j.prompt}
                    src={`/api/platform/jobs/${j.id}/download?view=1`}
                  />
                ) : j.mock_result ? (
                  t("TEST TECHNIQUE SIMULÉ")
                ) : j.status === "running" ? (
                  t(progress[j.provider_state ?? ""] ?? "En cours…")
                ) : j.status === "uncertain" ? (
                  t("Vérification en cours par l'équipe")
                ) : (
                  t(labels[j.status] ?? "")
                )}
              </div>
              <h3>{j.prompt}</h3>
              <p>
                {j.model_id.includes("9x16")
                  ? t("Vertical 9:16")
                  : j.model_id.includes("16x9")
                    ? t("Paysage 16:9")
                    : j.model_id}
                {j.status === "failed" ? ` · ${t("crédits rendus")}` : ""}
              </p>
              <p>{new Date(j.created_at).toLocaleString(dl)}</p>
              {j.status === "succeeded" && !j.mock_result && j.content_type?.startsWith("video/") && (
                <NextSteps video={{ kind: "job", id: j.id }} onTransfer={() => setTransfer({ kind: "job", id: j.id })} />
              )}
              {j.status === "succeeded" && (
                <div className="card-actions">
                  <DownloadLink className="text-link" href={`/api/platform/jobs/${j.id}/download`}>
                    {t("Télécharger")}
                  </DownloadLink>
                  {!j.mock_result && j.content_type?.startsWith("video/") && (
                    <>
                      <button className="text-link" onClick={() => setTransfer({ kind: "job", id: j.id })}>
                        {t("Transférer")}
                      </button>
                      <a className="text-link" href={`/montage?from=job:${j.id}`}>
                        {t("Monter")}
                      </a>
                      <a className="text-link" href={`/editor/open?ref=job:${j.id}`}>
                        {t("Modifier")}
                      </a>
                    </>
                  )}
                </div>
              )}
              {j.status === "succeeded" && !j.mock_result && (
                <ScheduleButton
                  jobId={j.id}
                  scheduledAt={j.scheduled_at}
                  channel={j.schedule_channel}
                  note={j.schedule_note}
                  onSaved={refresh}
                />
              )}
              {["failed", "succeeded"].includes(j.status) && (
                <button disabled={busy} onClick={() => remove(j.id)}>
                  {t("Retirer")}
                </button>
              )}
            </article>
          ))}
      </div>
      {transfer && <TransferDialog video={transfer} onClose={() => setTransfer(null)} />}
    </>
  );
}
