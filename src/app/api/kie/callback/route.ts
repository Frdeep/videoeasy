import { onProviderCallback } from "@/lib/generation";
import { safeErrorCode } from "@/lib/db-config";

export const runtime = "nodejs";
export const maxDuration = 60;

// Kie.ai completion notification. Nothing in the body is trusted: we only read
// the task id, look up OUR job by it and re-read the task from Kie server-side.
export async function POST(request: Request) {
  let taskId: unknown;
  try {
    const body = (await request.json()) as { data?: { taskId?: unknown } };
    taskId = body?.data?.taskId;
  } catch {
    return Response.json({ received: false }, { status: 400 });
  }
  if (typeof taskId !== "string" || !/^[\w-]{1,128}$/.test(taskId))
    return Response.json({ received: false }, { status: 400 });
  try {
    await onProviderCallback(taskId);
  } catch (e) {
    console.error("kie_callback_failed", safeErrorCode(e));
  }
  return Response.json({ received: true });
}
