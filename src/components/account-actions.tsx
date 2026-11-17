"use client";
import { useState } from "react";
import { useT } from "./i18n";
export function AccountActions() {
  const { t } = useT();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function act(path: string) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(t(data.error ?? "Service indisponible."));
      location.assign(data.url ?? "/");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("Service indisponible."));
      setBusy(false);
    }
  }
  return (
    <div className="account-actions">
      <button
        disabled={busy}
        className="text-link"
        onClick={() => act("/api/billing/portal")}
      >
        {t("Factures et moyen de paiement")} →
      </button>
      <button
        disabled={busy}
        className="text-link"
        onClick={() => act("/auth/signout")}
      >
        {t("Me déconnecter")}
      </button>
      <p role="alert">{message}</p>
    </div>
  );
}
