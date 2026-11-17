"use client";
import { useState } from "react";
import { plans, type Plan } from "@/lib/plans";

// Cost of the current video model (5 s, 720p, sound). Used only to translate
// credits into an understandable number of videos; the server decides the cost.
const VIDEO_CREDITS = 75;

const perks: Record<Plan, string[]> = {
  standard: [
    "Vidéos 5 s en 720p avec le son",
    "Formats paysage et vertical",
    "Galerie privée et téléchargement",
  ],
  metal: [
    "Tout Standard",
    "2 vidéos générées en même temps",
    "Idéal pour un rythme hebdomadaire",
  ],
  gold: [
    "Tout Metal",
    "3 vidéos générées en même temps",
    "Pour publier tous les jours",
  ],
};

export function Paywall({
  title = "Choisissez votre formule",
  subtitle = "Un abonnement mensuel, des crédits pour créer vos vidéos. Sans engagement.",
  compact = false,
}: {
  title?: string;
  subtitle?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState<Plan | "portal" | null>(null);
  const [message, setMessage] = useState("");
  async function open(path: string, key: Plan | "portal", body: object = {}) {
    setBusy(key);
    setMessage("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        location.assign("/login?mode=signup");
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      location.assign(data.url);
    } catch (error) {
      setMessage(
        error instanceof Error && error.message
          ? error.message
          : "Le paiement est momentanément indisponible. Réessayez dans un instant.",
      );
      setBusy(null);
    }
  }
  return (
    <section className={`paywall${compact ? " compact" : ""}`}>
      <header className="paywall-head">
        <span className="eyebrow">Abonnement VideoEasy</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </header>
      <div className="plan-grid">
        {(Object.keys(plans) as Plan[]).map((id) => {
          const plan = plans[id];
          const featured = id === "metal";
          const videos = Math.floor(plan.credits / VIDEO_CREDITS);
          return (
            <article
              key={id}
              className={`plan-card${featured ? " featured" : ""}`}
            >
              {featured && <span className="plan-flag">Recommandé</span>}
              <h2>{plan.name}</h2>
              <p className="plan-price">
                <strong>{plan.cents / 100} €</strong>
                <span>/ mois</span>
              </p>
              <p className="plan-videos">
                Jusqu’à <strong>{videos} vidéos</strong> par mois
              </p>
              <p className="plan-credits">
                {plan.credits.toLocaleString("fr-FR")} crédits · {VIDEO_CREDITS}{" "}
                crédits par vidéo
              </p>
              <ul>
                {perks[id].map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <button
                className={`button ${featured ? "primary" : "outline"}`}
                disabled={busy !== null}
                aria-busy={busy === id}
                onClick={() => open("/api/billing/checkout", id, { plan: id })}
              >
                {busy === id
                  ? "Ouverture du paiement…"
                  : `Choisir ${plan.name}`}
              </button>
            </article>
          );
        })}
      </div>
      <ul className="trust">
        <li>Paiement sécurisé par Stripe</li>
        <li>Résiliable en un clic, effectif en fin de mois</li>
        <li>Vos vidéos restent privées</li>
      </ul>
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      {!compact && (
        <>
          <p className="fine-print">
            Prix TTC, facturés chaque mois. Sans essai gratuit. Les crédits non
            utilisés expirent à la fin de chaque période mensuelle ; une
            génération échouée vous est recréditée. Changement de formule
            indisponible pour l’instant.
          </p>
          <button
            className="text-link"
            disabled={busy !== null}
            onClick={() => open("/api/billing/portal", "portal")}
          >
            Déjà abonné ? Factures et gestion de l’abonnement →
          </button>
        </>
      )}
    </section>
  );
}
