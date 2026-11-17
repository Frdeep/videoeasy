import Link from "next/link";
import { authenticate, resendConfirmation } from "./actions";
import { AuthSubmit } from "@/components/auth-submit";
import { getT } from "@/lib/locale";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const { t } = await getT();
  const resend = params.mode === "resend";
  const mode =
    params.mode === "signup"
      ? "signup"
      : params.mode === "magic"
        ? "magic"
        : "password";
  const sent = !!params.sent;
  return (
    <div className="auth-container">
      <h1>
        {sent
          ? t("Vérifie ta boîte mail")
          : resend
            ? t("Renvoyer la confirmation")
            : mode === "signup"
              ? t("Commencez à créer.")
              : t("Bon retour.")}
      </h1>
      {sent ? (
        <div className="auth-feedback" role="status">
          <h2>{t("Encore une étape avant de te connecter")}</h2>
          <p>
            {params.sent === "magic"
              ? t("Si cette adresse est éligible, un lien de connexion lui a été envoyé.")
              : t("Si cette inscription est éligible, un e-mail de confirmation a été envoyé à l’adresse indiquée.")}
          </p>
          <ol>
            <li>{t("Ouvre ta boîte mail.")}</li>
            <li>{t("Cherche le message de Supabase / VideoEasy, aussi dans les indésirables.")}</li>
            <li>{t("Clique sur le lien le plus récent.")}</li>
          </ol>
          <p>{t("Si tu reçois une confirmation d’inscription, confirme d’abord ton adresse puis reviens te connecter. Ne crée pas un deuxième compte.")}</p>
          <Link className="button primary" href="/login">{t("Mon adresse est confirmée : me connecter")}</Link>
        </div>
      ) : (
        <>
          {params.error && (
            <div className="auth-feedback" role="alert">
              {params.error === "confirmation" ? (
                <>
                  <strong>{t("Ton adresse e-mail n’est pas encore confirmée.")}</strong>
                  <p>{t("Ouvre le dernier message de confirmation envoyé par Supabase / VideoEasy, puis clique sur son lien avant de te connecter. Vérifie aussi tes indésirables.")}</p>
                </>
              ) : params.error === "expired" ? (
                <>
                  <strong>{t("Ce lien a expiré ou a déjà été utilisé.")}</strong>
                  <p>{t("Si ton adresse a déjà été confirmée, connecte-toi avec ton mot de passe. Sinon, demande un nouveau lien et utilise uniquement le dernier reçu.")}</p>
                </>
              ) : params.error === "callback" || params.error === "session" ? (
                <>
                  <strong>{t("La connexion depuis ce lien n’a pas pu être terminée.")}</strong>
                  <p>{t("Si tu as déjà confirmé ton adresse, utilise ton mot de passe. Aucun nouvel e-mail n’est envoyé automatiquement.")}</p>
                </>
              ) : params.error === "wait" ? (
                <p>{t("Une demande vient déjà d’être envoyée. Attends au moins une minute avant de réessayer et vérifie ta boîte mail.")}</p>
              ) : (
                <p>{t("La connexion ou l’inscription n’a pas abouti. Vérifie les informations saisies. Si tu viens de créer ton compte, confirme d’abord ton adresse e-mail.")}</p>
              )}
            </div>
          )}
          <form
            action={resend ? resendConfirmation : authenticate}
            key={resend ? "resend" : mode}
          >
            <input name="mode" type="hidden" value={mode} />
            <label>
              {t("E-mail")}
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
            {!resend && mode !== "magic" && (
              <label>
                {mode === "signup"
                  ? t("Mot de passe (12 caractères minimum)")
                  : t("Mot de passe")}
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  minLength={mode === "signup" ? 12 : 1}
                  maxLength={128}
                  required
                />
              </label>
            )}
            <AuthSubmit
              label={
                resend
                  ? t("Envoyer un nouveau lien de confirmation")
                  : mode === "signup"
                    ? t("Créer mon compte")
                    : mode === "magic"
                      ? t("Recevoir mon lien")
                      : t("Se connecter")
              }
            />
          </form>
          {(params.error === "confirmation" ||
            params.error === "expired" ||
            params.error === "callback" ||
            params.error === "session") &&
            !resend && (
              <p>
                <Link className="button secondary" href="/login?mode=resend">{t("Demander un nouveau lien de confirmation")}</Link>
              </p>
            )}
          {resend && (
            <p>{t("Cette demande envoie un e-mail uniquement après un clic sur le bouton. Une fois ton adresse confirmée, utilise la connexion par mot de passe.")}</p>
          )}
          <p className="auth-switch">
            <Link
              className="button outline"
              href={
                resend
                  ? "/login"
                  : mode === "signup"
                    ? "/login"
                    : "/login?mode=signup"
              }
            >
              {resend
                ? t("Me connecter avec mon mot de passe")
                : mode === "signup"
                  ? t("J’ai déjà un compte")
                  : t("Créer un compte")}
            </Link>
          </p>
          <Link
            className="text-link"
            href={mode === "magic" ? "/login" : "/login?mode=magic"}
          >
            {mode === "magic"
              ? t("Connexion par mot de passe")
              : t("Utiliser un lien de connexion par e-mail")}
          </Link>
        </>
      )}
    </div>
  );
}
