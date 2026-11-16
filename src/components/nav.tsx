"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function Nav() {
  const path = usePathname();
  return (
    <>
      <Link href="/" className="brand">
        <span className="brand-icon">
          v<span>e</span>
        </span>
        videoeasy<span className="beta">BÊTA</span>
      </Link>
      <nav aria-label="Navigation principale">
        {[
          ["/explore", "Explorer"],
          ["/studio", "Studio"],
          ["/gallery", "Mes créations"],
          ["/pricing", "Abonnements"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Link className="nav-account" href="/account">
        Mon espace <span aria-hidden="true">→</span>
      </Link>
    </>
  );
}
