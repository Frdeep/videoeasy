import Link from "next/link";
import { authenticate, resendConfirmation } from "./actions";
import { AuthSubmit } from "@/components/auth-submit";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; mode?: string }>;
}) {
  const params = await searchParams;
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
          ? "Vérifie ta boîte mail"
          : resend
            ? "Renvoyer la confirmation"
            : mode === "signup"
              ? "Créer mon compte"
              : "Connexion"}
      </h1>
      {sent ? (
        <div className="auth-feedback" role="status">
          <h2>Encore une étape avant de te connecter</h2>
          <p>
            {params.sent === "magic"
              ? "Si cette adresse est éligible, un lien de connexion lui a été envoyé."
              : "Si cette inscription est éligible, un e-mail de confirmation a été envoyé à l’adresse indiquée."}
          </p>
          <ol>
            <li>Ouvre ta boîte mail.</li>
            <li>
              Cherche le message de Supabase / VideoEasy, aussi dans les
              indésirables.
            </li>
            <li>Clique sur le lien le plus récent.</li>
          </ol>
          <p>
            Si tu reçois une confirmation d’inscription, confirme d’abord ton
            adresse puis reviens te connecter. Ne crée pas un deuxième compte.
          </p>
          <Link className="button primary" href="/login">
            Mon adresse est confirmée : me connecter
          </Link>
        </div>
      ) : (
        <>
          <p>Retrouve tes créations dans ton espace privé.</p>
          {params.error && (
            <div className="auth-feedback" role="alert">
              {params.error === "confirmation" ? (
                <>
                  <strong>
                    Ton adresse e-mail n’est pas encore confirmée.
                  </strong>
                  <p>
                    Ouvre le dernier message de confirmation envoyé par Supabase
                    / VideoEasy, puis clique sur son lien avant de te connecter.
                    Vérifie aussi tes indésirables.
                  </p>
                </>
              ) : params.error === "expired" ? (
                <>
                  <strong>Ce lien a expiré ou a déjà été utilisé.</strong>
                  <p>
                    Si ton adresse a déjà été confirmée, connecte-toi avec ton
                    mot de passe. Sinon, demande un nouveau lien et utilise
                    uniquement le dernier reçu.
                  </p>
                </>
              ) : params.error === "callback" || params.error === "session" ? (
                <>
                  <strong>
                    La connexion depuis ce lien n’a pas pu être terminée.
                  </strong>
                  <p>
                    Si tu as déjà confirmé ton adresse, utilise ton mot de
                    passe. Aucun nouvel e-mail n’est envoyé automatiquement.
                  </p>
                </>
              ) : params.error === "wait" ? (
                <p>
                  Une demande vient déjà d’être envoyée. Attends au moins une
                  minute avant de réessayer et vérifie ta boîte mail.
                </p>
              ) : (
                <p>
                  La connexion ou l’inscription n’a pas abouti. Vérifie les
                  informations saisies. Si tu viens de créer ton compte,
                  confirme d’abord ton adresse e-mail.
                </p>
              )}
            </div>
          )}
          <form
            action={resend ? resendConfirmation : authenticate}
            key={resend ? "resend" : mode}
          >
            <input name="mode" type="hidden" value={mode} />
            <label>
              E-mail
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
                  ? "Mot de passe (12 caractères minimum)"
                  : "Mot de passe"}
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
                  ? "Envoyer un nouveau lien de confirmation"
                  : mode === "signup"
                    ? "Créer mon compte"
                    : mode === "magic"
                      ? "Recevoir mon lien"
                      : "Se connecter"
              }
            />
          </form>
          {(params.error === "confirmation" ||
            params.error === "expired" ||
            params.error === "callback" ||
            params.error === "session") &&
            !resend && (
              <p>
                <Link className="button secondary" href="/login?mode=resend">
                  Demander un nouveau lien de confirmation
                </Link>
              </p>
            )}
          {resend && (
            <p>
              Cette demande envoie un e-mail uniquement après un clic sur le
              bouton. Une fois ton adresse confirmée, utilise la connexion par
              mot de passe.
            </p>
          )}
          <p>
            <Link
              href={
                resend
                  ? "/login"
                  : mode === "signup"
                    ? "/login"
                    : "/login?mode=signup"
              }
            >
              {resend
                ? "Me connecter avec mon mot de passe"
                : mode === "signup"
                  ? "J’ai déjà un compte"
                  : "Créer un compte"}
            </Link>
          </p>
          <Link
            className="text-link"
            href={mode === "magic" ? "/login" : "/login?mode=magic"}
          >
            {mode === "magic"
              ? "Connexion par mot de passe"
              : "Utiliser un lien de connexion par e-mail"}
          </Link>
        </>
      )}
    </div>
  );
}
