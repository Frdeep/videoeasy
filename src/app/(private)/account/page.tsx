import { ProfileEditor } from "@/components/profile-editor";
import Link from "next/link";
import { requirePageUser } from "@/lib/page-user";
import { db } from "@/lib/db";
import { plans, type Plan } from "@/lib/plans";
import { AccountActions } from "@/components/account-actions";
import { Paywall } from "@/components/paywall";
export default async function Account() {
  const user = await requirePageUser();
  let subscription;
  let available = 0;
  let unavailable = false;
  try {
    const { rows } = await db().query(
      `select s.* from billing.subscriptions s where user_id=$1 and status not in ('canceled','incomplete_expired') order by period_start desc limit 1`,
      [user.id],
    );
    subscription = rows[0];
    if (subscription?.status === "active") {
      const result = await db().query(
        `select coalesce(sum(remaining),0) as total from billing.credit_grants where user_id=$1 and subscription_id=$2 and period_start=$3 and period_end=$4 and period_end>extract(epoch from now()) and period_start<=extract(epoch from now())`,
        [
          user.id,
          subscription.id,
          subscription.period_start,
          subscription.period_end,
        ],
      );
      available = Number(result.rows[0].total);
    }
  } catch {
    unavailable = true;
  }
  return (
    <section className="section private-page">
      <h1>Mon compte.</h1>
      <p>{user.email}</p>
      {unavailable ? (
        <p role="alert" className="notice">
          Vos informations de facturation sont momentanément indisponibles.
        </p>
      ) : (
        <div className="account-stats">
          <article>
            <p>Formule</p>
            <h2>
              {plans[subscription?.plan as Plan]?.name ?? "Aucune formule"}
            </h2>
            <p>
              {subscription?.status === "active"
                ? "Actif"
                : subscription
                  ? "Paiement en attente"
                  : "Aucun abonnement"}
            </p>
          </article>
          <article>
            <p>Crédits</p>
            <h2>{available.toLocaleString("fr-FR")}</h2>
            <p>Valables ce mois-ci</p>
          </article>
          <article>
            <p>Échéance</p>
            <h2>
              {subscription?.period_end
                ? new Date(
                    Number(subscription.period_end) * 1000,
                  ).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })
                : "—"}
            </h2>
            <p>
              {subscription?.cancel_at || subscription?.cancel_at_period_end
                ? "Se termine"
                : "Renouvellement"}
            </p>
          </article>
        </div>
      )}
      {!unavailable && subscription?.status !== "active" && (
        <Paywall
          compact
          title="Passez à la création."
          subtitle="Choisissez une formule."
        />
      )}
      <div className="hero-actions">
        <Link className="button primary" href="/studio">
          Ouvrir le studio →
        </Link>
        <Link className="button secondary" href="/pricing">
          Voir les formules
        </Link>
      </div>
      <ProfileEditor />
      <AccountActions />
    </section>
  );
}
