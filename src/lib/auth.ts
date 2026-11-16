import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env, appUrl } from "./config";
import { HttpError } from "./http";
export async function supabase() {
  const jar = await cookies();
  return createServerClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) =>
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          ),
      },
    },
  );
}
export async function requireUser() {
  const { data, error } = await (await supabase()).auth.getUser();
  if (error || !data.user)
    throw new HttpError(401, "Connectez-vous pour continuer.");
  return data.user;
}
export function requireOrigin(request: Request) {
  if (request.headers.get("origin") !== appUrl())
    throw new HttpError(403, "Origine non autorisée.");
}
