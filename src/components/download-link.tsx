"use client";
import { useState, type ReactNode } from "react";
import { useT } from "./i18n";

/** Saves the file on the device. Asks the route for a signed link, fetches
 * it (the storage CDN allows it) and saves it under a clean name; falls back
 * to a normal navigation if anything fails. */
export function DownloadLink({
  href,
  className,
  children,
  label,
}: {
  href: string;
  className?: string;
  children?: ReactNode;
  label?: string;
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  return (
    <a
      className={className}
      href={href}
      aria-label={label}
      aria-busy={busy}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy) return;
        setBusy(true);
        try {
          const meta = await fetch(`${href}${href.includes("?") ? "&" : "?"}format=url`).then((r) => {
            if (!r.ok) throw new Error();
            return r.json() as Promise<{ url: string; name: string }>;
          });
          const blob = await fetch(meta.url).then((r) => {
            if (!r.ok) throw new Error();
            return r.blob();
          });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = meta.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 30000);
        } catch {
          location.assign(href);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? t("Téléchargement…") : children}
    </a>
  );
}
