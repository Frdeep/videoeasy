import { supabase } from "@/lib/auth";
import { appUrl } from "@/lib/config";
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    const { error } = await (
      await supabase()
    ).auth.exchangeCodeForSession(code);
    if (!error) return Response.redirect(appUrl());
  }
  return Response.redirect(`${appUrl()}/login?error=1`);
}
