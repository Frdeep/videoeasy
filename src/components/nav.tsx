"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const tabs = [
  ["/", "Accueil"],
  ["/studio", "Studio"],
  ["/gallery", "Mes créations"],
  ["/pricing", "Abonnements"],
] as const;

function Dots() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <circle cx="5" cy="5" r="3.2" />
      <circle cx="17" cy="5" r="3.2" />
      <circle cx="5" cy="17" r="3.2" />
      <circle cx="17" cy="17" r="3.2" />
    </svg>
  );
}

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searching) input.current?.focus();
  }, [searching]);
  useEffect(() => setOpen(false), [path]);
  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);
  return (
    <div className="topbar">
      <Link className="brand" href="/" aria-label="VideoEasy — accueil">
        <Dots />
        <span>videoeasy</span>
      </Link>
      <nav className="tabs" aria-label="Navigation principale">
        {tabs.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={active(href) ? "active" : ""}
            aria-current={active(href) ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="top-actions">
        {searching ? (
          <form
            className="top-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const q = input.current?.value.trim() ?? "";
              router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
              setSearching(false);
            }}
          >
            <input
              ref={input}
              type="search"
              name="q"
              aria-label="Rechercher une inspiration"
              placeholder="Rechercher une inspiration"
              onBlur={(e) => !e.currentTarget.value && setSearching(false)}
              onKeyDown={(e) => e.key === "Escape" && setSearching(false)}
            />
          </form>
        ) : (
          <button
            className="icon-button"
            aria-label="Rechercher"
            onClick={() => setSearching(true)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
          </button>
        )}
        <Link className="create-pill" href="/studio">
          Créer
        </Link>
        <Link
          className={`avatar${active("/account") ? " active" : ""}`}
          href="/account"
          aria-label="Mon compte"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="8.5" r="4" />
            <path d="M4 21c1.5-4.2 4.5-6 8-6s6.5 1.8 8 6" />
          </svg>
        </Link>
        <button
          className="icon-button menu-toggle"
          aria-label="Afficher le menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <path
              d={open ? "M6 6l12 12M18 6 6 18" : "M4 7h16M4 12h16M4 17h16"}
            />
          </svg>
        </button>
      </div>
      {open && (
        <nav className="mobile-menu" aria-label="Menu">
          {[...tabs, ["/account", "Mon compte"] as const].map(
            ([href, label]) => (
              <Link
                key={href}
                href={href}
                className={active(href) ? "active" : ""}
              >
                {label}
              </Link>
            ),
          )}
        </nav>
      )}
    </div>
  );
}
