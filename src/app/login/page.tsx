import { redirect } from "next/navigation";
import { supabase } from "@/lib/auth";
import { appUrl } from "@/lib/config";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  async function signIn(form: FormData) {
    "use server";
    const email = String(form.get("email") ?? "").trim();
    if (!email || email.length > 254) redirect("/login?error=1");
    let failed = false;
    try {
      const { error } = await (
        await supabase()
      ).auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${appUrl()}/auth/callback` },
      });
      failed = !!error;
    } catch {
      failed = true;
    }
    redirect(failed ? "/login?error=1" : "/login?sent=1");
  }
  return (
    <>
      <h1>Connexion à VideoEasy</h1>
      <p>Recevez un lien de connexion par e-mail.</p>
      {params.sent && (
        <p role="status">
          Demande envoyée. Consultez votre boîte et vos indésirables.
        </p>
      )}
      {params.error && (
        <p role="alert">
          Connexion indisponible ou lien expiré. Réessayez dans une minute, ou
          contactez le support.
        </p>
      )}
      <form action={signIn}>
        <label>
          E-mail <input name="email" type="email" required maxLength={254} />
        </label>
        <button>Recevoir mon lien</button>
      </form>
    </>
  );
}
