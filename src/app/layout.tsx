import type { ReactNode } from "react";
import { Nav } from "@/components/nav";
import "./style.css";
export const metadata = {
  title: "VideoEasy — Votre imagination, en mouvement",
  description:
    "Le studio privé pour imaginer vos vidéos et images IA. Créé par Cisco.",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <a className="skip" href="#content">
          Aller au contenu
        </a>
        <header className="site-header">
          <Nav />
        </header>
        <main id="content">{children}</main>
        <footer>
          <a className="footer-brand" href="/">
            videoeasy<span>✦</span>
          </a>
          <span>Créé par Cisco · Bêta privée</span>
          <a href="/pricing">Formules et conditions de crédits</a>
        </footer>
      </body>
    </html>
  );
}
