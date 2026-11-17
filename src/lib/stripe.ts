import "server-only";
import Stripe from "stripe";
import { env } from "./config";
import { keyMatchesMode, stripeMode } from "./stripe-mode";
let instance: Stripe | undefined;
let instanceKey: string | undefined;
export function stripe() {
  const key = env("STRIPE_SECRET_KEY");
  if (!keyMatchesMode(key))
    throw new Error(`Stripe key does not match STRIPE_MODE=${stripeMode()}`);
  if (instance && instanceKey === key) return instance;
  instanceKey = key;
  // Version fixed to the installed SDK; see docs/setup.md before upgrading.
  return (instance = new Stripe(key, {
    apiVersion: "2026-10-28.endive",
    maxNetworkRetries: 2,
    timeout: 15000,
  }));
}
let verified: Promise<void> | undefined;
export function verifyAccount() {
  return (verified ??= stripe()
    .accounts.retrieve(null)
    .then((account) => {
      if (account.id !== env("STRIPE_ACCOUNT_ID"))
        throw new Error("Wrong Stripe account");
    })
    .catch((error) => {
      verified = undefined;
      throw error;
    }));
}
