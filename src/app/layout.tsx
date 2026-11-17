import type { ReactNode } from "react";
import { Archivo, Inter } from "next/font/google";
import { Nav } from "@/components/nav";
import "./style.css";

const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-display",
  display: "swap",
});
const text = Inter({
  subsets: ["latin"],
  variable: "--font-text",
  display: "swap",
});

export const metadata = {
  title: "VideoEasy — Votre imagination, en mouvement",
  description:
    "Le studio privé pour imaginer vos vidéos et images IA. Créé par Cisco.",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${text.variable}`}>
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
        <footer className="site-footer">
          <span>videoeasy · Créé par Cisco · Bêta privée</span>
          <a href="/pricing">Formules et conditions de crédits</a>
        </footer>
      </body>
    </html>
  );
}
