import { stripe } from "@/lib/stripe";
import { env } from "@/lib/config";
import { processEvent } from "@/lib/sync";
import { matchesMode } from "@/lib/stripe-mode";
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
    if (!matchesMode(event.livemode))
      return Response.json(
        { error: "Event mode does not match STRIPE_MODE" },
        { status: 400 },
      );
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
