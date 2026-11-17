"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ScheduleButton } from "./schedule-button";
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
export function JobsGallery() {
  const [jobs, setJobs] = useState<Job[]>([]);
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
    } catch {
      setMessage("Galerie indisponible. Réessayez.");
    }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, []);
  async function remove(id: string) {
    if (!confirm("Retirer cette création de votre galerie ?")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/platform/jobs/${id}`, { method: "DELETE" });
      if (!r.ok) throw Error();
      await refresh();
    } catch {
      setMessage("Suppression impossible. Réessayez.");
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
            {label}
          </button>
        ))}
      </div>
      <p role="status">{message}</p>
      {!message && !jobs.length && (
        <div className="empty-state">
          <h2>Votre première vidéo vous attend.</h2>

          <Link className="button primary" href="/studio">
            Créer une vidéo
          </Link>
        </div>
      )}
      <div className="media-grid">
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
                  "TEST TECHNIQUE SIMULÉ"
                ) : j.status === "running" ? (
                  (progress[j.provider_state ?? ""] ?? "En cours…")
                ) : j.status === "uncertain" ? (
                  "Vérification en cours par l'équipe"
                ) : (
                  labels[j.status]
                )}
              </div>
              <h3>{j.prompt}</h3>
              <p>
                {j.model_id.includes("9x16")
                  ? "Vertical 9:16"
                  : j.model_id.includes("16x9")
                    ? "Paysage 16:9"
                    : j.model_id}
                {j.status === "failed" ? " · crédits rendus" : ""}
              </p>
              <p>{new Date(j.created_at).toLocaleString("fr-FR")}</p>
              {j.status === "succeeded" && (
                <a
                  className="text-link"
                  href={`/api/platform/jobs/${j.id}/download`}
                >
                  Télécharger
                </a>
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
                  Retirer
                </button>
              )}
            </article>
          ))}
      </div>
    </>
  );
}
