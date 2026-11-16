"use client";
import Link from "next/link";
import { useState } from "react";
export function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="menu-button"
        aria-label="Afficher le menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ☰
      </button>
      <Link className="brand" href="/">
        videoeasy<span className="brand-play">▶</span>
      </Link>
      <form className="global-search" action="/">
        <input
          type="search"
          name="q"
          aria-label="Rechercher une inspiration"
          placeholder="Rechercher une inspiration"
        />
        <button aria-label="Rechercher">⌕</button>
      </form>
      <Link className="create-top" href="/studio">
        ＋ Créer
      </Link>
      <Link className="nav-account" href="/account">
        Mon compte
      </Link>
      {open && (
        <nav className="menu-popover" aria-label="Menu">
          {[
            ["/", "Accueil"],
            ["/studio", "Studio"],
            ["/gallery", "Mes créations"],
            ["/pricing", "Abonnements"],
            ["/account", "Mon compte"],
          ].map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
