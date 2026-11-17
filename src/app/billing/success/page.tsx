"use client";
import { useEffect, useState } from "react";
import { useT } from "@/components/i18n";
export default function Success() {
  const { t } = useT();
  const [message, setMessage] = useState(
    "Paiement transmis. Vérification serveur en cours…",
  );
  useEffect(() => {
    let stopped = false;
    async function refresh() {
      try {
        const response = await fetch("/api/billing/status");
        const data = await response.json();
        if (!stopped)
          setMessage(
            response.ok &&
              data.subscriptions.some(
                (s: { status: string; available_credits: string }) =>
                  s.status === "active" && Number(s.available_credits) > 0,
              )
              ? "Votre abonnement et vos crédits sont disponibles."
              : "Confirmation en attente. Les droits seront activés après vérification de la facture payée.",
          );
      } catch {
        if (!stopped)
          setMessage(
            "Vérification momentanément indisponible. Revenez dans quelques instants.",
          );
      }
    }
    void refresh();
    const timer = setInterval(refresh, 5000);
    const end = setTimeout(() => clearInterval(timer), 60000);
    return () => {
      stopped = true;
      clearInterval(timer);
      clearTimeout(end);
    };
  }, []);
  return (
    <div className="return-page">
      <h1>{t("Votre abonnement")}</h1>
      <p role="status">{t(message)}</p>
      <a href="/">{t("Retour aux abonnements")}</a>
    </div>
  );
}
