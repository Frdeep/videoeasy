"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabase } from "@/lib/auth";
import { appUrl } from "@/lib/config";
export async function authenticate(form: FormData) {
  const email = z
    .email()
    .max(254)
    .safeParse(String(form.get("email") ?? "").trim());
  const action = String(form.get("mode"));
  const password = String(form.get("password") ?? "");
  const mode = ["signup", "magic", "password"].includes(action)
    ? action
    : "password";
  const errorUrl = (code: string) => `/login?mode=${mode}&error=${code}`;
  if (
    !email.success ||
    action !== mode ||
    (mode !== "magic" &&
      (password.length < (mode === "signup" ? 12 : 1) || password.length > 128))
  )
    redirect(errorUrl("invalid"));
  let destination = errorUrl("invalid");
  try {
    const client = await supabase();
    const result =
      mode === "signup"
        ? await client.auth.signUp({
            email: email.data,
            password,
            options: { emailRedirectTo: `${appUrl()}/auth/callback` },
          })
        : mode === "password"
          ? await client.auth.signInWithPassword({
              email: email.data,
              password,
            })
          : await client.auth.signInWithOtp({
              email: email.data,
              options: {
                emailRedirectTo: `${appUrl()}/auth/callback`,
                shouldCreateUser: false,
              },
            });
    if (result.error) {
      if (result.error.code === "email_not_confirmed")
        destination = errorUrl("confirmation");
      else if (
        ["over_email_send_rate_limit", "over_request_rate_limit"].includes(
          result.error.code ?? "",
        )
      )
        destination = errorUrl("wait");
    } else if ("session" in result.data && result.data.session)
      destination = "/account";
    else if (mode === "signup") destination = "/login?sent=confirmation";
    else if (mode === "magic") destination = "/login?sent=magic";
  } catch {
    /* No credentials or raw provider errors in logs or URLs. */
  }
  redirect(destination);
}

// Email confirmation is re-sent only when the person explicitly requests it.
// Password login never calls this action or the signup/OTP APIs.
export async function resendConfirmation(form: FormData) {
  const email = z
    .email()
    .max(254)
    .safeParse(String(form.get("email") ?? "").trim());
  if (!email.success) redirect("/login?mode=resend&error=invalid");
  let destination = "/login?sent=confirmation";
  try {
    const client = await supabase();
    const result = await client.auth.resend({
      type: "signup",
      email: email.data,
      options: { emailRedirectTo: `${appUrl()}/auth/callback` },
    });
    if (result.error)
      destination = [
        "over_email_send_rate_limit",
        "over_request_rate_limit",
      ].includes(result.error.code ?? "")
        ? "/login?mode=resend&error=wait"
        : "/login?mode=resend&error=invalid";
  } catch {
    destination = "/login?mode=resend&error=invalid";
  }
  redirect(destination);
}
