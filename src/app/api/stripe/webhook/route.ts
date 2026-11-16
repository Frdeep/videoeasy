import { stripe } from "@/lib/stripe";
import { env } from "@/lib/config";
import { processEvent } from "@/lib/sync";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  let event;
  try {
    event = stripe().webhooks.constructEvent(
      await request.text(),
      request.headers.get("stripe-signature") ?? "",
      env("STRIPE_WEBHOOK_SECRET"),
    );
    if (event.livemode)
      return Response.json({ error: "Test events only" }, { status: 400 });
  } catch {
    return Response.json(
      { error: "Invalid webhook signature or configuration" },
      { status: 400 },
    );
  }
  try {
    await processEvent(event);
    return Response.json({ received: true });
  } catch {
    console.error("stripe_webhook_processing_failed", {
      eventId: event.id,
      type: event.type,
    });
    return Response.json(
      {
        error: "Synchronization failed; delivery must be retried",
        event_id: event.id,
      },
      { status: 503 },
    );
  }
}
