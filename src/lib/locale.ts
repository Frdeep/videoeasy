import "server-only";
import { cookies, headers } from "next/headers";
import { dateLocale, isLocale, LOCALE_COOKIE, translate, type Locale } from "./i18n";

/** Cookie choice first, then the browser language, French by default. */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  const accept = (await headers()).get("accept-language") ?? "";
  return /^en\b/i.test(accept.trim()) ? "en" : "fr";
}

export async function getT() {
  const locale = await getLocale();
  return {
    locale,
    dl: dateLocale(locale),
    t: (s: string, v?: Record<string, string | number>) => translate(locale, s, v),
  };
}
