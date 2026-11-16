import Link from "next/link";
export default function Gallery() {
  return (
    <section className="section private-page">
      <p className="eyebrow">VOTRE COLLECTION PERSONNELLE</p>
      <h1>
        Mes créations<span className="accent">.</span>
      </h1>
      <p>
        Vos vidéos et vos images, réunies dans un espace qui vous appartient.
      </p>
      <div className="empty-state">
        <span>▦</span>
        <h2>Votre collection commence ici.</h2>
        <p>
          Aucune création pour le moment. Le stockage privé et les
          téléchargements seront ouverts avec la génération.
        </p>
        <Link className="button primary" href="/studio">
          Préparer ma première idée →
        </Link>
      </div>
    </section>
  );
}
