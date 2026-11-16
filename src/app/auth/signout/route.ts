import { requireOrigin, supabase } from "@/lib/auth";
import { failure } from "@/lib/http";
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    await (await supabase()).auth.signOut();
    return Response.json({ success: true });
  } catch (error) {
    return failure(error);
  }
}
