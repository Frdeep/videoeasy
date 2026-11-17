"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RiseText } from "./motion";
import { channels } from "./schedule-button";

type Job = {
  id: string;
  prompt: string;
  model_id: string;
  status: string;
  scheduled_at: string | null;
  schedule_channel: string | null;
  schedule_note: string | null;
};
const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const label = (c: string | null) => channels.find(([v]) => v === c)?.[1] ?? "";

function googleLink(j: Job) {
  const start = new Date(j.scheduled_at!);
  const end = new Date(start.getTime() + 30 * 60000);
  const f = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `Publier ma vidéo${j.schedule_channel ? ` sur ${label(j.schedule_channel)}` : ""}`,
    dates: `${f(start)}/${f(end)}`,
    details: [j.schedule_note, j.prompt].filter(Boolean).join("\n\n"),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export function ContentCalendar() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string>(key(new Date()));

  useEffect(() => {
    fetch("/api/platform/jobs")
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((d) => setJobs(d.jobs ?? []))
      .catch(() => setJobs([]));
  }, []);

  const scheduled = useMemo(
    () =>
      (jobs ?? [])
        .filter((j) => j.scheduled_at)
        .sort(
          (a, b) => +new Date(a.scheduled_at!) - +new Date(b.scheduled_at!),
        ),
    [jobs],
  );
  const byDay = useMemo(() => {
    const m = new Map<string, Job[]>();
    for (const j of scheduled) {
      const k = key(new Date(j.scheduled_at!));
      m.set(k, [...(m.get(k) ?? []), j]);
    }
    return m;
  }, [scheduled]);

  const cells = useMemo(() => {
    const first = new Date(cursor);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);
  const today = key(new Date());
  const upcoming = scheduled.filter(
    (j) => +new Date(j.scheduled_at!) >= Date.now() - 3600000,
  );
  const dayJobs = byDay.get(selected) ?? [];

  return (
    <div className="page calendar-page">
      <header className="page-head">
        <RiseText text="Calendrier." />
        <Link className="button primary" href="/gallery">
          Planifier une vidéo
        </Link>
      </header>

      <div className="cal-layout">
        <section className="cal" aria-label="Mois">
          <div className="cal-head">
            <button
              className="fan-arrow"
              aria-label="Mois précédent"
              onClick={() =>
                setCursor(
                  new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
                )
              }
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path d="m15 5-7 7 7 7" />
              </svg>
            </button>
            <h2>
              {cursor.toLocaleDateString("fr-FR", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <button
              className="fan-arrow"
              aria-label="Mois suivant"
              onClick={() =>
                setCursor(
                  new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
                )
              }
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path d="m9 5 7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="cal-grid">
            {days.map((d) => (
              <span className="cal-dow" key={d}>
                {d}
              </span>
            ))}
            {cells.map((d) => {
              const k = key(d);
              const items = byDay.get(k) ?? [];
              return (
                <button
                  key={k}
                  className={[
                    "cal-day",
                    d.getMonth() !== cursor.getMonth() ? "out" : "",
                    k === today ? "today" : "",
                    k === selected ? "sel" : "",
                    items.length ? "has" : "",
                  ].join(" ")}
                  onClick={() => setSelected(k)}
                  aria-label={`${d.toLocaleDateString("fr-FR", { dateStyle: "full" })}, ${items.length} vidéo(s)`}
                >
                  <span>{d.getDate()}</span>
                  {items.slice(0, 3).map((j) => (
                    <i key={j.id} title={j.prompt} />
                  ))}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="cal-side">
          <h2 className="cap-first">
            {dayJobs.length
              ? new Date(dayJobs[0].scheduled_at!).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
              : "À venir"}
          </h2>
          {jobs === null ? (
            <div className="skeleton small" />
          ) : (dayJobs.length ? dayJobs : upcoming).length ? (
            <ul className="cal-list">
              {(dayJobs.length ? dayJobs : upcoming).map((j) => (
                <li key={j.id}>
                  <video
                    src={`/api/platform/jobs/${j.id}/download?view=1`}
                    muted
                    playsInline
                    preload="metadata"
                    className={j.model_id.includes("9x16") ? "tall" : "wide"}
                  />
                  <div>
                    <strong>
                      {new Date(j.scheduled_at!).toLocaleString("fr-FR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </strong>
                    {j.schedule_channel && (
                      <span className="tag">{label(j.schedule_channel)}</span>
                    )}
                    <p>{j.schedule_note || j.prompt}</p>
                    <a
                      className="text-link"
                      href={googleLink(j)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ajouter à Google Agenda
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <p>Rien de planifié.</p>
              <Link className="text-link" href="/gallery">
                Choisir une vidéo
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
