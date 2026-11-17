import type { ReactNode } from "react";
import { Inclusive_Sans } from "next/font/google";
import { BottomNav, Nav } from "@/components/nav";
import { LocaleProvider } from "@/components/i18n";
import { FounderNote } from "@/components/founder-note";
import { getT } from "@/lib/locale";
import "./style.css";

const inclusive = Inclusive_Sans({
  subsets: ["latin", "latin-ext"],
  weight: "500",
  variable: "--font-inclusive",
  display: "swap",
});

export async function generateMetadata() {
  const { t } = await getT();
  return {
    title: t("VideoEasy — Votre imagination, en mouvement"),
    description: t(
      "Le studio privé pour imaginer vos vidéos et images IA. Créé par Cisco.",
    ),
  };
}
export default async function Layout({ children }: { children: ReactNode }) {
  const { locale, t } = await getT();
  return (
    <html lang={locale} className={inclusive.variable}>
      <body>
        <LocaleProvider locale={locale}>
          <a className="skip" href="#content">
            {t("Aller au contenu")}
          </a>
          <div className="app-frame">
            <header className="site-header">
              <Nav />
            </header>
            <main id="content">{children}</main>
          </div>
          <BottomNav />
          <footer className="site-footer">
            <FounderNote />
            <div className="footer-line">
              <span>{t("videoeasy · Créé par Cisco · Bêta privée")}</span>
              <a href="/pricing">{t("Formules et conditions de crédits")}</a>
            </div>
          </footer>
        </LocaleProvider>
      </body>
    </html>
  );
}
