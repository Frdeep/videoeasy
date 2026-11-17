"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LangSwitch, useT } from "./i18n";

const tabs = [
  ["/", "Accueil"],
  ["/studio", "Studio"],
  ["/shorts", "Shorts"],
  ["/gallery", "Créations"],
  ["/calendar", "Calendrier"],
  ["/pricing", "Tarifs"],
] as const;

const icons: Record<string, string> = {
  "/": "M4 11.5 12 5l8 6.5V20h-5v-5H9v5H4z",
  "/gallery": "M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v6H4zM13 14h7v6h-7z",
  "/pricing": "M3 8h18v10H3zM3 11h18M7 15h3",
  "/calendar": "M3 6h18v15H3zM3 10h18M8 3v5M16 3v5",
  "/shorts": "M7 3h10v18H7zM10 9l5 3-5 3z",
  "/account":
    "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6",
};

function Dots() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      aria-hidden
      className="dots-logo"
    >
      <circle cx="5" cy="5" r="3.2" />
      <circle cx="17" cy="5" r="3.2" />
      <circle cx="5" cy="17" r="3.2" />
      <circle cx="17" cy="17" r="3.2" />
    </svg>
  );
}

const useIsoLayout =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function Nav() {
  const { t } = useT();
  const path = usePathname();
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const tabsRef = useRef<HTMLElement>(null);
  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  useEffect(() => {
    if (searching) input.current?.focus();
  }, [searching]);

  // Sliding underline under the active tab.
  useIsoLayout(() => {
    const measure = () => {
      const el = tabsRef.current?.querySelector<HTMLAnchorElement>("a.active");
      setBar(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [path]);

  return (
    <>
      <div className="topbar">
        <Link className="brand" href="/" aria-label={t("VideoEasy — accueil")}>
          <Dots />
          <span>videoeasy</span>
        </Link>
        <nav className="tabs" aria-label={t("Navigation principale")} ref={tabsRef}>
          {tabs.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={active(href) ? "active" : ""}
              aria-current={active(href) ? "page" : undefined}
            >
              {t(label)}
            </Link>
          ))}
          {bar && (
            <span
              className="tab-bar"
              aria-hidden
              style={{ transform: `translateX(${bar.x}px)`, width: bar.w }}
            />
          )}
        </nav>
        <div className="top-actions">
          <form
            className={`top-search${searching ? " open" : ""}`}
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const q = input.current?.value.trim() ?? "";
              router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
              setSearching(false);
            }}
          >
            <button
              type="button"
              className="icon-button"
              aria-label={t("Rechercher")}
              onClick={() => setSearching(!searching)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
            </button>
            <input
              ref={input}
              type="search"
              name="q"
              tabIndex={searching ? 0 : -1}
              aria-label={t("Rechercher")}
              placeholder={t("Rechercher")}
              onBlur={(e) => !e.currentTarget.value && setSearching(false)}
              onKeyDown={(e) => e.key === "Escape" && setSearching(false)}
            />
          </form>
          <Link className="create-pill" href="/studio">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t("Créer")}
          </Link>
          <Link
            className={`avatar${active("/account") ? " active" : ""}`}
            href="/account"
            aria-label={t("Mon compte")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
              <path d={icons["/account"]} />
            </svg>
          </Link>
          <LangSwitch />
        </div>
      </div>
    </>
  );
}

/** Mobile app-style navigation: compact floating pill. Both bars slide away
 * while scrolling down and come back on the slightest scroll up. Rendered
 * outside the sticky header, otherwise `position: fixed` would be relative
 * to the header. */
export function BottomNav() {
  const { t } = useT();
  const path = usePathname();
  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const root = document.documentElement;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (Math.abs(y - last) < 6) return;
        root.dataset.scroll = y > last && y > 80 ? "down" : "up";
        last = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      delete root.dataset.scroll;
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.scroll = "up";
  }, [path]);

  return (
    <nav className="bottom-nav" aria-label={t("Navigation")}>
      {[
        ["/", "Accueil"],
        ["/shorts", "Shorts"],
        ["/studio", "Créer"],
        ["/gallery", "Créations"],
        ["/account", "Compte"],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className={`${active(href) ? "active" : ""}${href === "/studio" ? " fab" : ""}`}
          aria-current={active(href) ? "page" : undefined}
          aria-label={t(label)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
            <path d={href === "/studio" ? "M12 5v14M5 12h14" : icons[href]} />
          </svg>
          {href !== "/studio" && <span>{t(label)}</span>}
        </Link>
      ))}
    </nav>
  );
}
