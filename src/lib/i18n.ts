import { EN } from "./i18n-en";

// Bilingual UI (French source, English translation). Keys are the French
// strings themselves: a missing translation simply falls back to French.
export type Locale = "fr" | "en";
export const LOCALE_COOKIE = "lang";

export function isLocale(v: unknown): v is Locale {
  return v === "fr" || v === "en";
}

export function translate(
  locale: Locale,
  text: string,
  vars?: Record<string, string | number>,
) {
  let out = locale === "en" ? (EN[text] ?? text) : text;
  if (vars)
    for (const [k, v] of Object.entries(vars))
      out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

/** BCP 47 tag for dates and numbers. */
export const dateLocale = (l: Locale) => (l === "en" ? "en-GB" : "fr-FR");
