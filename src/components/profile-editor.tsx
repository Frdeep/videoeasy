"use client";
import { useState } from "react";
import { useT } from "./i18n";
export function ProfileEditor() {
  const { t } = useT();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="profile-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const form = new FormData(e.currentTarget);
          const r = await fetch("/api/platform/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: form.get("name") }),
          });
          setMessage(
            r.ok ? t("Profil enregistré.") : t("Enregistrement impossible."),
          );
        } catch {
          setMessage(t("Service indisponible."));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        {t("Nom affiché")}
        <input name="name" required maxLength={80} autoComplete="nickname" />
      </label>
      <button disabled={busy} className="button secondary">
        {t("Enregistrer mon profil")}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
