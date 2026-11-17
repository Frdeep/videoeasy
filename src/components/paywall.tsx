"use client";
import { useState } from "react";
import { plans, type Plan } from "@/lib/plans";
import { Reveal, RiseText } from "./motion";

const QUALITY = "Vidéo HD 720p";

export function Paywall({
  title = "Choisissez. Créez.",
  subtitle = "Sans engagement.",
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
          : "Paiement indisponible. Réessayez.",
      );
      setBusy(null);
    }
  }
  return (
    <section className={`paywall${compact ? " compact" : ""}`}>
      <header className="paywall-head">
        <RiseText text={title} />
        <p>{subtitle}</p>
      </header>
      <div className="plan-grid">
        {(Object.keys(plans) as Plan[]).map((id, i) => {
          const plan = plans[id];
          const featured = id === "metal";
          return (
            <Reveal
              key={id}
              delay={i * 120}
              className={featured ? "plan-slot featured" : "plan-slot"}
            >
              <article className={`plan-card${featured ? " featured" : ""}`}>
                <div className="plan-top">
                  <h2>{plan.name}</h2>
                  {featured && <span className="plan-flag">Recommandé</span>}
                </div>
                <p className="plan-price">
                  <strong>{plan.cents / 100}€</strong>
                  <span>/mois</span>
                </p>
                <ul>
                  <li>
                    <strong>
                      {plan.credits
                        .toString()
                        .replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f")}
                    </strong>{" "}
                    crédits / mois
                  </li>
                  <li>{QUALITY}</li>
                </ul>
                <button
                  className={`button big ${featured ? "primary" : "outline"}`}
                  disabled={busy !== null}
                  aria-busy={busy === id}
                  onClick={() =>
                    open("/api/billing/checkout", id, { plan: id })
                  }
                >
                  {busy === id ? "Redirection…" : `Choisir ${plan.name}`}
                </button>
              </article>
            </Reveal>
          );
        })}
      </div>
      <ul className="trust">
        <li>Paiement sécurisé Stripe</li>
        <li>Résiliable à tout moment</li>
      </ul>
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      {!compact && (
        <>
          <p className="fine-print">
            Prix TTC. Crédits valables un mois. Génération échouée = crédits
            rendus.
          </p>
          <button
            className="text-link"
            disabled={busy !== null}
            onClick={() => open("/api/billing/portal", "portal")}
          >
            Gérer mon abonnement
          </button>
        </>
      )}
    </section>
  );
}
