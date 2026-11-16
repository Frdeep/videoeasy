import type { ReactNode } from "react";
import "./style.css";
export const metadata = {
  title: "VideoEasy · Abonnements",
  description: "Abonnements VideoEasy — environnement de test",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <header>
          <a href="/">VideoEasy</a>
          <span>Environnement de test</span>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
