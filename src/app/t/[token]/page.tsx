import { liveTransfer } from "@/lib/transfers";
import { getT } from "@/lib/locale";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function TransferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t, dl } = await getT();
  const tr = await liveTransfer(token);
  if (!tr)
    return (
      <section className="page transfer-page">
        <h1>{t("Lien expiré.")}</h1>
        <p>{t("Ce lien de transfert a expiré ou n’existe pas. Demandez un nouveau lien à l’expéditeur.")}</p>
      </section>
    );
  return (
    <section className="page transfer-page">
      <span className="soon-pill">{t("Transfert VideoEasy")}</span>
      <h1>{t("Une vidéo pour vous.")}</h1>
      {tr.message && <blockquote className="transfer-message">{tr.message}</blockquote>}
      <video className="transfer-video" src={`/t/${token}/file?view=1`} controls playsInline preload="metadata" />
      <a className="button primary big" href={`/t/${token}/file`}>
        {t("Télécharger")}
      </a>
      <p className="fine-print">
        {t("Disponible jusqu’au {date}.", {
          date: new Date(tr.expires_at).toLocaleString(dl, { dateStyle: "long", timeStyle: "short" }),
        })}{" "}
        {tr.file_name}
      </p>
    </section>
  );
}
