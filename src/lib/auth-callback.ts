// Supabase can put verification errors in the URL fragment, invisible to a
// server-only GET handler. Never preserve tokens or arbitrary redirect targets.
export function callbackOutcome(search: string, hash: string) {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const error = query.get("error_code") ?? fragment.get("error_code");
  if (error === "otp_expired") return { error: "expired" } as const;
  if (error || query.has("error") || fragment.has("error"))
    return { error: "callback" } as const;
  const code = query.get("code");
  if (code && code.length <= 4096) return { code } as const;
  return { error: "session" } as const;
}
