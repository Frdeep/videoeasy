import "server-only";
import Stripe from "stripe";
import { env } from "./config";
let instance: Stripe;
export function stripe() {
  const key = env("STRIPE_SECRET_KEY");
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_"))
    throw new Error("Test Stripe key required");
  // Version fixed to the installed SDK; see docs/setup.md before upgrading.
  return (instance ??= new Stripe(key, {
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
