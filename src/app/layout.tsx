import type { ReactNode } from "react";
import { Inclusive_Sans } from "next/font/google";
import { BottomNav, Nav } from "@/components/nav";
import "./style.css";

const inclusive = Inclusive_Sans({
  subsets: ["latin", "latin-ext"],
  weight: "500",
  variable: "--font-inclusive",
  display: "swap",
});

export const metadata = {
  title: "VideoEasy — Votre imagination, en mouvement",
  description:
    "Le studio privé pour imaginer vos vidéos et images IA. Créé par Cisco.",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={inclusive.variable}>
      <body>
        <a className="skip" href="#content">
          Aller au contenu
        </a>
        <div className="app-frame">
          <header className="site-header">
            <Nav />
          </header>
          <main id="content">{children}</main>
        </div>
        <BottomNav />
        <footer className="site-footer">
          <span>videoeasy · Créé par Cisco · Bêta privée</span>
          <a href="/pricing">Formules et conditions de crédits</a>
        </footer>
      </body>
    </html>
  );
}
