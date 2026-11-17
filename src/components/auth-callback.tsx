"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { callbackOutcome } from "@/lib/auth-callback";
import { useT } from "./i18n";
export function AuthCallback() {
  const { t } = useT();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const result = callbackOutcome(location.search, location.hash);
    history.replaceState(null, "", "/auth/callback");
    if ("error" in result) {
      location.replace(`/login?error=${result.error}`);
      return;
    }
    fetch("/auth/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: result.code }),
    })
      .then(async (response) => {
        if (response.ok) {
          location.replace("/account");
          return;
        }
        const data = await response.json();
        location.replace(
          `/login?error=${data.error === "expired" ? "expired" : "session"}`,
        );
      })
      .catch(() => setFailed(true));
  }, []);
  return (
    <div className="auth-container">
      <h1>{failed ? t("Connexion interrompue") : t("Vérification du lien…")}</h1>
      <p role="status">
        {failed
          ? t("La vérification n’a pas pu aboutir. Tu peux essayer la connexion par mot de passe.")
          : t("Merci de patienter pendant la vérification. Aucun nouvel e-mail n’est envoyé.")}
      </p>
      <Link className="text-link" href="/login">
        {t("Me connecter avec mon mot de passe")}
      </Link>
      <noscript>
        {t("Active JavaScript pour terminer la connexion depuis ce lien, ou utilise la connexion par mot de passe.")}
      </noscript>
    </div>
  );
}
