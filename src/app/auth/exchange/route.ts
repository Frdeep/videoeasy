import { supabase, requireOrigin } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { z } from "zod";
export async function POST(request: Request) {
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  };
  try {
    requireOrigin(request);
    const body = z
      .object({ code: z.string().min(1).max(4096) })
      .strict()
      .safeParse(await request.json());
    if (!body.success)
      return Response.json({ error: "invalid" }, { status: 400, headers });
    const client = await supabase();
    const { data, error } = await client.auth.exchangeCodeForSession(
      body.data.code,
    );
    if (error || !data.session)
      return Response.json(
        { error: error?.code === "otp_expired" ? "expired" : "session" },
        { status: 400, headers },
      );
    const verified = await client.auth.getUser();
    if (verified.error || !verified.data.user)
      return Response.json({ error: "session" }, { status: 401, headers });
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    return Response.json(
      { error: "session" },
      { status: error instanceof HttpError ? error.status : 400, headers },
    );
  }
}
