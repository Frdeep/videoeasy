"use client";
import { useState } from "react";
import Link from "next/link";
const items = [
  {
    image: "lake",
    tag: "Nature",
    title: "L’eau, les montagnes et le silence",
    description: "Un mouvement de caméra lent, une lumière naturelle.",
    idea: "dune",
  },
  {
    image: "city",
    tag: "Architecture",
    title: "La ville comme un décor de cinéma",
    description:
      "Construisez une scène autour des lignes et de la perspective.",
    idea: "orb",
  },
  {
    image: "night",
    tag: "Cinéma",
    title: "Une autre façon de regarder la nuit",
    description: "Imaginez un univers nocturne et ses contrastes.",
    idea: "orb",
  },
  {
    image: "mountain",
    tag: "Nature",
    title: "À hauteur de montagne",
    description: "Explorez un cadrage vertical pour votre prochaine idée.",
    idea: "dune",
  },
  {
    image: "stars",
    tag: "Cinéma",
    title: "Quand la lumière raconte une histoire",
    description: "Préparez une palette et une ambiance.",
    idea: "bloom",
  },
  {
    image: "ocean",
    tag: "Nature",
    title: "Un paysage. Mille histoires possibles.",
    description: "Du premier plan au détail qui change tout.",
    idea: "dune",
  },
];
export function MediaFeed({ query = "" }: { query?: string }) {
  const [filter, setFilter] = useState("Tout");
  const shown = items.filter(
    (i) =>
      (filter === "Tout" || i.tag === filter) &&
      `${i.title} ${i.description} ${i.tag}`
        .toLocaleLowerCase("fr")
        .includes(query.toLocaleLowerCase("fr")),
  );
  return (
    <div className="video-shell">
      <aside className="feed-sidebar">
        <Link className="side-active" href="/">
          ⌂ <span>Accueil</span>
        </Link>
        <Link href="/explore">
          ▣ <span>Studio découverte</span>
        </Link>
        <Link href="/gallery">
          ▦ <span>Mes créations</span>
        </Link>
        <hr />
        <h3>Votre espace</h3>
        <Link href="/studio">
          ＋ <span>Nouvelle création</span>
        </Link>
        <Link href="/account">
          ◉ <span>Mon abonnement</span>
        </Link>
        <Link href="/pricing">
          ◇ <span>Les formules</span>
        </Link>
        <div className="sidebar-signin">
          <p>Vos idées méritent leur espace.</p>
          <Link href="/login">Se connecter →</Link>
        </div>
        <small>
          VideoEasy · Créé par Cisco
          <br />
          Bêta privée
        </small>
      </aside>
      <div className="feed-content">
        <div
          className="feed-filters"
          role="group"
          aria-label="Filtrer les inspirations"
        >
          {["Tout", "Cinéma", "Nature", "Architecture"].map((f) => (
            <button
              aria-pressed={filter === f}
              className={f === filter ? "active" : ""}
              onClick={() => setFilter(f)}
              key={f}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="feed-title">
          <div>
            <h1>
              {query
                ? `Résultats pour « ${query} »`
                : "Votre prochaine idée commence ici."}
            </h1>
            <p>
              Des directions visuelles pour préparer votre prochaine création.
            </p>
          </div>
          <Link href="/studio" className="button primary">
            Ouvrir le studio →
          </Link>
        </div>
        <div className="feed-section-title">
          <h2>{filter === "Tout" ? "À explorer" : filter}</h2>
          <span>Photographies d’inspiration · pas des générations IA</span>
        </div>
        <div className="media-grid">
          {shown.map((item, i) => (
            <Link
              className="media-card"
              href={`/explore?idea=${item.idea}`}
              key={item.title}
            >
              <div className="media-thumb">
                <img
                  src={`/editorial/${item.image}.jpg`}
                  alt={item.title}
                  style={{ objectPosition: i > 2 ? "70% 60%" : "center" }}
                />
                <span className="thumb-label">{item.tag.toUpperCase()}</span>
                <span className="thumb-action">Explorer →</span>
              </div>
              <div className="media-info">
                <div className="channel-avatar">ve</div>
                <div>
                  <h3>{item.title}</h3>
                  <p>VideoEasy · Inspiration</p>
                  <p>{item.description}</p>
                </div>
                <span className="media-more" aria-hidden>
                  ⋮
                </span>
              </div>
            </Link>
          ))}
        </div>
        {!shown.length && (
          <div className="empty-state">
            <h2>Aucune inspiration trouvée</h2>
            <p>Essayez « nature », « cinéma » ou « ville ».</p>
            <Link href="/">Voir toutes les inspirations</Link>
          </div>
        )}
        <section className="feed-banner">
          <div>
            <span>VOTRE STUDIO PERSONNEL</span>
            <h2>De l’idée à votre prochaine création.</h2>
            <p>
              Préparez vos prompts, choisissez votre format et retrouvez votre
              espace privé.
            </p>
          </div>
          <Link href="/explore" className="button primary">
            Découvrir le studio →
          </Link>
        </section>
      </div>
    </div>
  );
}
