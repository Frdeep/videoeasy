import { getT } from "@/lib/locale";
export default async function Cancel() {
  const { t } = await getT();
  return (
    <div className="return-page">
      <h1>{t("Paiement interrompu")}</h1>
      <p>
        {t("Aucun crédit n’est attribué par cette page. Vous pouvez reprendre votre commande depuis les abonnements. Une session ouverte expire après 30 minutes.")}
      </p>
      <a href="/">{t("Retour aux abonnements")}</a>
    </div>
  );
}
