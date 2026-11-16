import { redirect } from "next/navigation";
import { z } from "zod";
import Link from "next/link";
import { supabase } from "@/lib/auth";
import { appUrl } from "@/lib/config";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const mode =
    params.mode === "signup"
      ? "signup"
      : params.mode === "magic"
        ? "magic"
        : "password";
  async function authenticate(form: FormData) {
    "use server";
    const email = z
      .email()
      .max(254)
      .safeParse(String(form.get("email") ?? ""));
    const action = String(form.get("mode"));
    const password = String(form.get("password") ?? "");
    if (
      !email.success ||
      !["signup", "magic", "password"].includes(action) ||
      (action !== "magic" &&
        ((action === "signup" ? password.length < 12 : password.length < 1) ||
          password.length > 128))
    )
      redirect("/login?error=1");
    let error = false;
    let session = false;
    try {
      const client = await supabase();
      if (action === "signup") {
        const result = await client.auth.signUp({
          email: email.data,
          password,
          options: { emailRedirectTo: `${appUrl()}/auth/callback` },
        });
        error = !!result.error;
        session = !!result.data.session;
      } else if (action === "password") {
        const result = await client.auth.signInWithPassword({
          email: email.data,
          password,
        });
        error = !!result.error;
        session = !!result.data.session;
      } else {
        const result = await client.auth.signInWithOtp({
          email: email.data,
          options: { emailRedirectTo: `${appUrl()}/auth/callback` },
        });
        error = !!result.error;
      }
    } catch {
      error = true;
    }
    redirect(error ? "/login?error=1" : session ? "/account" : "/login?sent=1");
  }
  return (
    <div className="auth-container">
      <h1>{mode === "signup" ? "Créer mon compte" : "Connexion"}</h1>
      <p>Retrouvez vos créations dans votre espace privé.</p>
      {params.sent && (
        <p role="status">
          Si votre demande est éligible, vous recevrez un e-mail de
          confirmation. Vérifiez vos indésirables.
        </p>
      )}
      {params.error && (
        <p role="alert">
          Connexion indisponible ou informations invalides. Vérifiez vos
          identifiants et réessayez.
        </p>
      )}
      <form action={authenticate}>
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
        {mode !== "magic" && (
          <label>
            Mot de passe (12 caractères minimum)
            <input
              name="password"
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              minLength={12}
              maxLength={128}
              required
            />
          </label>
        )}
        <button>
          {mode === "signup"
            ? "Créer mon compte"
            : mode === "magic"
              ? "Recevoir mon lien"
              : "Se connecter"}
        </button>
      </form>
      <p>
        <Link href={mode === "signup" ? "/login" : "/login?mode=signup"}>
          {mode === "signup" ? "J’ai déjà un compte" : "Créer un compte"}
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
    </div>
  );
}
