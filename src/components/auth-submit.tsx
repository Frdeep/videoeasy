"use client";
import { useFormStatus } from "react-dom";
export function AuthSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} aria-busy={pending}>
      {pending ? "Traitement en cours…" : label}
    </button>
  );
}
