// Explicit Stripe environment shared by every check (key, account resources, events, invoices).
// Absent => "test" (historical behaviour). Live requires STRIPE_MODE=live written explicitly.
// Any other value fails closed so a typo can never silently mix test and live objects.
export type StripeMode = "test" | "live";

export function stripeMode(): StripeMode {
  const value = process.env.STRIPE_MODE;
  if (value === undefined || value === "") return "test";
  if (value === "test" || value === "live") return value;
  throw new Error("Invalid STRIPE_MODE (expected test or live)");
}

/** True when a Stripe object's livemode flag belongs to the configured mode. */
export function matchesMode(livemode: boolean | null | undefined) {
  return livemode === (stripeMode() === "live");
}

export function assertMode(livemode: boolean | null | undefined, what: string) {
  if (!matchesMode(livemode))
    throw new Error(`Stripe mode mismatch: ${what} is not ${stripeMode()}`);
}

/** Secret or restricted key prefixes allowed for the configured mode. */
export function keyMatchesMode(key: string) {
  const mode = stripeMode();
  return key.startsWith(`sk_${mode}_`) || key.startsWith(`rk_${mode}_`);
}
