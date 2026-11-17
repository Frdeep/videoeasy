"use client";
import { createContext, useContext, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dateLocale, LOCALE_COOKIE, translate, type Locale } from "@/lib/i18n";

const LocaleContext = createContext<Locale>("fr");

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useT() {
  const locale = useContext(LocaleContext);
  return useMemo(
    () => ({
      locale,
      dl: dateLocale(locale),
      t: (s: string, v?: Record<string, string | number>) => translate(locale, s, v),
    }),
    [locale],
  );
}

function FlagFR() {
  return (
    <svg viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="1" height="2" fill="#0055A4" />
      <rect x="1" width="1" height="2" fill="#fff" />
      <rect x="2" width="1" height="2" fill="#EF4135" />
    </svg>
  );
}
function FlagGB() {
  return (
    <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <clipPath id="gb-c">
        <path d="M30 15h30v15zv15H0zH0V0zV0h30z" />
      </clipPath>
      <path d="M0 0v30h60V0z" fill="#012169" />
      <path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6" />
      <path d="M0 0l60 30m0-30L0 30" clipPath="url(#gb-c)" stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

/** Two-flag switch, top right. Stores the choice for a year. */
export function LangSwitch() {
  const { locale } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (l: Locale) => {
    if (l === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
    start(() => router.refresh());
  };
  return (
    <div
      className={`lang-switch${pending ? " pending" : ""}`}
      role="group"
      aria-label={locale === "en" ? "Language" : "Langue"}
    >
      <button
        type="button"
        className={locale === "fr" ? "on" : ""}
        aria-pressed={locale === "fr"}
        aria-label="Français"
        title="Français"
        onClick={() => set("fr")}
      >
        <FlagFR />
      </button>
      <button
        type="button"
        className={locale === "en" ? "on" : ""}
        aria-pressed={locale === "en"}
        aria-label="English"
        title="English"
        onClick={() => set("en")}
      >
        <FlagGB />
      </button>
    </div>
  );
}
