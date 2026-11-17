"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { genres, showcase, type ShowcaseItem } from "@/lib/showcase";
import { Reveal, RiseText, Segmented } from "./motion";
import { useIsMobile, useSnapIndex } from "./use-mobile";

const filters = ["Tout", ...genres] as const;
type Filter = (typeof filters)[number];
const AUTOPLAY_MS = 3800;

function Media({ item, playing }: { item: ShowcaseItem; playing: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playing) void v.play().catch(() => {});
    else v.pause();
  }, [playing]);
  if (item.video)
    return (
      <video
        ref={ref}
        src={item.video}
        poster={item.poster}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={item.title}
      />
    );
  return (
    <div className="placeholder" aria-hidden>
      <span className="play">
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </div>
  );
}

/** Mobile: edge-to-edge native swipe rail, no frame; only the centred card plays. */
function Rail({ items }: { items: ShowcaseItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const current = useSnapIndex(ref, "x", [items.length]);
  useEffect(() => {
    ref.current?.scrollTo({ left: 0 });
  }, [items]);
  return (
    <section className="rail-wrap" aria-label="Exemples de vidéos">
      <div className="rail" ref={ref}>
        {items.map((it, i) => (
          <article key={it.id} className={`rail-card${i === current ? " on" : ""}`}>
            <Media item={it} playing={i === current} />
            <span className="badge badge-left">{it.genre}</span>
            <span className="badge badge-right">{it.format}</span>
            <span className="card-caption">
              <strong>{it.title}</strong>
            </span>
          </article>
        ))}
      </div>
      <div className="rail-dots" aria-hidden>
        {items.map((it, i) => (
          <span key={it.id} className={i === current ? "on" : ""} />
        ))}
      </div>
    </section>
  );
}

function Bento({ genre }: { genre?: string }) {
  return (
    <section className="bento" aria-label="Raccourcis">
      <Link className="tile tile-create" href={genre ? `/studio?genre=${encodeURIComponent(genre)}` : "/studio"}>
        <span className="tile-kicker">Studio</span>
        <strong>Créer une vidéo</strong>
        <span className="tile-sub">Une phrase suffit. HD, avec le son.</span>
        <i className="tile-go" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </i>
      </Link>
      <Link className="tile tile-shorts" href="/shorts">
        <span className="tile-kicker">Shorts</span>
        <strong>1 vidéo → 10 shorts</strong>
        <span className="tile-sub">Sous-titrés, recadrés.</span>
      </Link>
      <Link className="tile tile-gallery" href="/gallery">
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden><path d="M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v6H4zM13 14h7v6h-7z" /></svg>
        <strong>Créations</strong>
      </Link>
      <Link className="tile tile-cal" href="/calendar">
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden><path d="M3 6h18v15H3zM3 10h18M8 3v5M16 3v5" /></svg>
        <strong>Calendrier</strong>
      </Link>
      <Link className="tile tile-price" href="/pricing">
        <span className="tile-kicker">Dès 23 € / mois</span>
        <strong>1 000 crédits</strong>
      </Link>
      <div className="tile tile-genres">
        <span className="tile-kicker">Formats qui performent</span>
        <div className="chips">
          {genres.map((g) => (
            <Link key={g} href={`/studio?genre=${encodeURIComponent(g)}`}>{g}</Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MediaFeed({ query = "" }: { query?: string }) {
  const [filter, setFilter] = useState<Filter>("Tout");
  const shown = useMemo(
    () =>
      showcase.filter(
        (i) =>
          (filter === "Tout" || i.genre === filter) &&
          `${i.title} ${i.genre}`
            .toLocaleLowerCase("fr")
            .includes(query.toLocaleLowerCase("fr")),
      ),
    [filter, query],
  );
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const drag = useRef<number | null>(null);
  const current = Math.min(active, Math.max(shown.length - 1, 0));
  const count = shown.length;

  const move = useCallback(
    (step: number) =>
      setActive((a) =>
        count ? (Math.min(a, count - 1) + step + count) % count : 0,
      ),
    [count],
  );

  // Fan-out entrance on load and on every genre change.
  useEffect(() => {
    setReady(false);
    setActive(Math.floor(count / 2));
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, [count, filter]);

  // Wheel autoplay, paused on hover, focus, drag and reduced motion.
  useEffect(() => {
    if (paused || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => move(1), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, move, count]);

  const item = shown[current];
  const mobile = useIsMobile();

  if (mobile)
    return (
      <div className="home home-m">
        <section className="hero">
          <RiseText text={query ? `« ${query} »` : "Une idée. Une vidéo."} />
          <p className="hero-sub">Des vidéos IA prêtes à publier.</p>
        </section>
        <nav className="chip-row" aria-label="Genres">
          {filters.map((f) => (
            <button key={f} className={f === filter ? "on" : ""} aria-pressed={f === filter} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </nav>
        {count ? (
          <Rail items={shown} />
        ) : (
          <div className="empty-state">
            <h2>Rien ici.</h2>
            <Link className="text-link" href="/">Tout voir</Link>
          </div>
        )}
        <Bento genre={filter === "Tout" ? undefined : filter} />
      </div>
    );

  return (
    <div className="home">
      <section className="hero">
        <RiseText text={query ? `« ${query} »` : "Une idée. Une vidéo."} />
        <p className="hero-sub">
          Des vidéos IA prêtes à publier. En quelques minutes.
        </p>
        <Segmented
          options={filters}
          value={filter}
          onChange={setFilter}
          label="Genres"
        />
      </section>

      {count ? (
        <section
          className={`fan${ready ? " ready" : ""}`}
          aria-roledescription="carrousel"
          aria-label="Exemples de vidéos"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") move(1);
            if (e.key === "ArrowLeft") move(-1);
          }}
          onPointerDown={(e) => {
            drag.current = e.clientX;
            setPaused(true);
          }}
          onPointerUp={(e) => {
            const start = drag.current;
            drag.current = null;
            setPaused(false);
            if (start === null) return;
            const dx = e.clientX - start;
            if (Math.abs(dx) > 40) move(dx < 0 ? 1 : -1);
          }}
          onPointerCancel={() => {
            drag.current = null;
            setPaused(false);
          }}
        >
          <div className="fan-stage">
            {shown.map((it, i) => {
              let x = i - current;
              if (x > count / 2) x -= count;
              if (x < -count / 2) x += count;
              const d = Math.abs(x);
              const center = x === 0;
              return (
                <button
                  type="button"
                  key={it.id}
                  className={`fan-card${center ? " is-center" : ""}`}
                  style={
                    {
                      "--x": x,
                      "--d": d,
                      zIndex: 20 - d,
                    } as React.CSSProperties
                  }
                  data-far={d > 3 ? "" : undefined}
                  tabIndex={d > 2 ? -1 : 0}
                  aria-label={center ? it.title : `Voir « ${it.title} »`}
                  aria-current={center || undefined}
                  onClick={() => !center && setActive(i)}
                >
                  <Media item={it} playing={center && ready} />
                  <span className="badge badge-left">{it.genre}</span>
                  <span className="badge badge-right">{it.format}</span>
                  <span className="card-caption">
                    <strong>{it.title}</strong>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="fan-controls">
            <button
              className="fan-arrow"
              aria-label="Précédente"
              onClick={() => move(-1)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path d="m15 5-7 7 7 7" />
              </svg>
            </button>
            <div className="dots" aria-hidden>
              {shown.map((it, i) => (
                <span key={it.id} className={i === current ? "on" : ""} />
              ))}
            </div>
            <button
              className="fan-arrow"
              aria-label="Suivante"
              onClick={() => move(1)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path d="m9 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        </section>
      ) : (
        <div className="empty-state">
          <h2>Rien ici.</h2>
          <Link className="text-link" href="/">
            Tout voir
          </Link>
        </div>
      )}

      {item && (
        <div className="hero-cta">
          <Link
            className="button primary big"
            href={`/studio?genre=${encodeURIComponent(item.genre)}`}
          >
            Créer ma vidéo
          </Link>
          <Link className="button ghost big" href="/pricing">
            Tarifs
          </Link>
        </div>
      )}

      <section className="steps" aria-label="Comment ça marche">
        {[
          ["01", "Écrivez", "Une phrase suffit."],
          ["02", "Générez", "Vidéo HD avec le son."],
          ["03", "Publiez", "Téléchargez. Postez."],
        ].map(([n, t, d], i) => (
          <Reveal key={n} delay={i * 110}>
            <article>
              <span>{n}</span>
              <h2>{t}</h2>
              <p>{d}</p>
            </article>
          </Reveal>
        ))}
      </section>

      <Reveal className="genre-band">
        <h2>Tous les formats qui performent.</h2>
        <ul>
          {genres.map((g) => (
            <li key={g}>
              <Link href={`/studio?genre=${encodeURIComponent(g)}`}>{g}</Link>
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}
