"use client";
import { useFormStatus } from "react-dom";
import { useT } from "./i18n";
export function AuthSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const { t } = useT();
  return (
    <button
      className="button primary big"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? t("Traitement en cours…") : label}
    </button>
  );
}
