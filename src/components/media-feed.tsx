"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { showcase, type ShowcaseItem } from "@/lib/showcase";

const filters = ["Tout", "Cinéma", "Nature", "Ville", "Portrait"] as const;

function Media({ item, playing }: { item: ShowcaseItem; playing: boolean }) {
  if (item.video)
    return (
      <video
        src={item.video}
        poster={item.poster}
        muted
        loop
        playsInline
        autoPlay={playing}
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
      <span className="soon">Vidéo à venir</span>
    </div>
  );
}

function Card({
  item,
  offset,
  onSelect,
}: {
  item: ShowcaseItem;
  offset: number;
  onSelect: () => void;
}) {
  const center = offset === 0;
  const d = Math.abs(offset);
  return (
    <button
      type="button"
      className={`fan-card${center ? " is-center" : ""}`}
      style={
        {
          "--x": offset,
          "--d": d,
          zIndex: 20 - d,
        } as React.CSSProperties
      }
      aria-label={center ? item.title : `Afficher « ${item.title} »`}
      aria-current={center || undefined}
      data-far={d > 3 ? "" : undefined}
      tabIndex={d > 2 ? -1 : 0}
      onClick={onSelect}
    >
      <Media item={item} playing={center} />
      <span className="badge badge-left">{item.tag}</span>
      <span className="badge badge-right">
        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="m10 9 5 3-5 3z" />
        </svg>
        Vidéo
      </span>
      <span className="card-caption">
        <strong>{item.title}</strong>
        <small>
          {item.format} · {item.video ? "Exemple VideoEasy" : "Bientôt"}
        </small>
      </span>
    </button>
  );
}

export function MediaFeed({ query = "" }: { query?: string }) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("Tout");
  const shown = useMemo(
    () =>
      showcase.filter(
        (i) =>
          (filter === "Tout" || i.tag === filter) &&
          `${i.title} ${i.tag}`
            .toLocaleLowerCase("fr")
            .includes(query.toLocaleLowerCase("fr")),
      ),
    [filter, query],
  );
  const [active, setActive] = useState(Math.floor(showcase.length / 2));
  const current = Math.min(active, Math.max(shown.length - 1, 0));
  const move = (step: number) =>
    shown.length && setActive((current + step + shown.length) % shown.length);

  return (
    <div className="home">
      <section className="hero">
        <h1>
          {query
            ? `Résultats pour « ${query} »`
            : "Vos idées deviennent des vidéos"}
        </h1>
        <div className="segmented" role="group" aria-label="Filtrer la vitrine">
          {filters.map((f) => (
            <button
              key={f}
              className={f === filter ? "active" : ""}
              aria-pressed={f === filter}
              onClick={() => {
                setFilter(f);
                setActive(0);
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </section>

      {shown.length ? (
        <section
          className="fan"
          aria-roledescription="carrousel"
          aria-label="Vitrine VideoEasy"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") move(1);
            if (e.key === "ArrowLeft") move(-1);
          }}
        >
          <button
            className="fan-arrow left"
            aria-label="Vidéo précédente"
            onClick={() => move(-1)}
          >
            ‹
          </button>
          <div className="fan-stage">
            {shown.map((item, i) => (
              <Card
                key={item.id}
                item={item}
                offset={i - current}
                onSelect={() => setActive(i)}
              />
            ))}
          </div>
          <button
            className="fan-arrow right"
            aria-label="Vidéo suivante"
            onClick={() => move(1)}
          >
            ›
          </button>
        </section>
      ) : (
        <div className="empty-state">
          <h2>Aucune vidéo trouvée</h2>
          <p>Essayez « nature », « ville » ou « cinéma ».</p>
          <Link href="/">Voir toute la vitrine</Link>
        </div>
      )}

      {shown[current] && (
        <div className="hero-cta">
          <Link
            className="button primary"
            href={`/studio?idea=${shown[current].idea}`}
          >
            Créer une vidéo comme celle-ci
          </Link>
          <Link className="button ghost" href="/pricing">
            Voir les formules
          </Link>
        </div>
      )}

      <section className="steps" aria-label="Comment ça marche">
        {[
          ["1", "Décrivez", "Écrivez votre idée en une phrase, en français."],
          [
            "2",
            "Générez",
            "VideoEasy crée une vidéo de 5 s, en 720p, avec le son.",
          ],
          [
            "3",
            "Retrouvez",
            "Votre vidéo arrive dans votre galerie privée, prête à télécharger.",
          ],
        ].map(([n, t, d]) => (
          <article key={n}>
            <span>{n}</span>
            <h2>{t}</h2>
            <p>{d}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
