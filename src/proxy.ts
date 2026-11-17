import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
// Refresh auth cookies before Server Components run. Authorization remains in
// each private page/API; this proxy never treats an unverified session as a user.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values)
          response.cookies.set(name, value, options);
      },
    },
  });
  try {
    await client.auth.getUser();
  } catch {
    /* Downstream handlers return a controlled auth/service error. */
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/studio/:path*",
    "/gallery/:path*",
    "/account/:path*",
    "/admin/:path*",
    "/api/platform/:path*",
    "/api/billing/:path*",
  ],
};
