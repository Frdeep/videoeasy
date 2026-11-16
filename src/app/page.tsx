"use client";
import { useState } from "react";
import { plans } from "@/lib/plans";
export default function Home() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function open(path: string, body: object = {}) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (response.status === 401) {
        location.assign("/login");
        return;
      }
      if (!response.ok) throw new Error(data.error);
      location.assign(data.url);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Service indisponible.",
      );
      setBusy(false);
    }
  }
  return (
    <>
      <p className="eyebrow">CRÉEZ AVEC VIDEOEASY</p>
      <h1>Une formule pour vos créations.</h1>
      <p>Un abonnement mensuel, des crédits pour vos images et vidéos IA.</p>
      <div className="plans">
        {Object.entries(plans).map(([id, plan]) => (
          <article key={id}>
            <h2>{plan.name}</h2>
            <p className="price">
              {plan.cents / 100} € <small>/ mois</small>
            </p>
            <p>{plan.credits.toLocaleString("fr-FR")} crédits par mois</p>
            <p>
              {plan.concurrency} génération{plan.concurrency > 1 ? "s" : ""}{" "}
              simultanée{plan.concurrency > 1 ? "s" : ""}
            </p>
            <button
              disabled={busy}
              onClick={() => open("/api/billing/checkout", { plan: id })}
            >
              Choisir {plan.name}
            </button>
          </article>
        ))}
      </div>
      <p>
        Sans essai gratuit. Les crédits disponibles expirent à la fin de chaque
        période mensuelle. Les générations déjà réservées restent suivies.
        Annulation à la fin de la période payée ; changement de formule
        indisponible au lancement.
      </p>
      <p>
        Prix TTC envisagés. Configuration fiscale à confirmer avant toute
        commercialisation.
      </p>
      <button disabled={busy} onClick={() => open("/api/billing/portal")}>
        Factures et gestion de l’abonnement
      </button>{" "}
      <a href="/login">Se connecter</a>
      <p role="alert">{message}</p>
    </>
  );
}
