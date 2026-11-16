import Link from "next/link";
import { Artwork } from "@/components/artwork";
const ideas = [
  [
    "orb",
    "01",
    "L’art de l’impossible",
    "Des idées qui prennent une autre dimension.",
  ],
  [
    "dune",
    "02",
    "Des univers à inventer",
    "Donnez une atmosphère à votre prochaine histoire.",
  ],
  [
    "bloom",
    "03",
    "Le détail qui change tout",
    "Explorez de nouvelles directions visuelles.",
  ],
];
export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" /> LE STUDIO DE VOTRE IMAGINATION
          </p>
          <h1>
            Vos idées.
            <br />
            Une nouvelle
            <br />
            <em>dimension.</em>
          </h1>
          <p className="hero-description">
            Imaginez des vidéos et des images qui vous ressemblent. Un seul
            espace pour donner vie à toutes vos idées.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/studio">
              Ouvrir mon studio <span>→</span>
            </Link>
            <Link className="text-link" href="/explore">
              Découvrir l’expérience <span>→</span>
            </Link>
          </div>
          <p className="microcopy">
            Espace privé · Abonnement mensuel · Sans essai gratuit
          </p>
        </div>
        <div className="hero-visual">
          <Artwork label="Composition abstraite : sphère chromée et lumière violette" />
          <div className="visual-caption">
            <span>
              <span className="status-dot" /> L’IMAGINATION SANS CADRE
            </span>
            <span>VIDEOEASY / 001</span>
          </div>
          <div className="floating-label">
            Une idée. Des possibilités infinies. <span>✦</span>
          </div>
        </div>
      </section>
      <section className="manifesto">
        <span>
          DU PREMIER MOT
          <br />À LA DERNIÈRE IMAGE.
        </span>
        <p>
          Un espace pour créer.
          <br />
          <strong>Et laisser parler votre imagination.</strong>
        </p>
        <span className="manifesto-star">✦</span>
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FAITES PLACE AUX IDÉES</p>
            <h2>Quel sera votre prochain univers ?</h2>
          </div>
          <Link className="text-link" href="/explore">
            Explorer le studio →
          </Link>
        </div>
        <div className="inspiration-grid">
          {ideas.map(([variant, num, title, description]) => (
            <Link
              href={`/explore?idea=${variant}`}
              className="inspiration-card"
              key={num}
            >
              <Artwork
                variant={variant}
                label={`Illustration abstraite — ${title}`}
              />
              <div className="card-meta">
                <span>{num} / INSPIRATION</span>
                <span>→</span>
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </Link>
          ))}
        </div>
        <p className="microcopy">
          Compositions graphiques d’illustration. Elles ne sont pas des
          résultats de génération IA.
        </p>
      </section>
      <section className="workflow section">
        <div>
          <p className="eyebrow">SIMPLE, DU DÉBUT À LA FIN</p>
          <h2>
            Moins de friction.
            <br />
            Plus de création.
          </h2>
          <Link className="button secondary" href="/pricing">
            Trouver ma formule →
          </Link>
        </div>
        <ol>
          {[
            ["Imaginez", "Choisissez votre direction et décrivez votre idée."],
            [
              "Composez",
              "Ajustez les paramètres disponibles pour votre modèle.",
            ],
            [
              "Retrouvez",
              "Vos créations seront conservées dans votre galerie privée.",
            ],
          ].map(([title, copy], i) => (
            <li key={title}>
              <span>0{i + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="closing">
        <p className="eyebrow">VOTRE PROCHAINE IDÉE COMMENCE ICI</p>
        <h2>
          À vous de <em>créer.</em>
        </h2>
        <Link className="button primary" href="/explore">
          Explorer VideoEasy →
        </Link>
        <p className="microcopy">
          Bêta en préparation. La génération sera ouverte après validation des
          modèles.
        </p>
      </section>
    </>
  );
}
