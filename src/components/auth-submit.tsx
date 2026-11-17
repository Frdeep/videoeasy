"use client";
import { useFormStatus } from "react-dom";
export function AuthSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="button primary big"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? "Traitement en cours…" : label}
    </button>
  );
}
