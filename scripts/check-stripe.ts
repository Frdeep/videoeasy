// Read-only readiness check. Never prints keys or the full Stripe response.
import { verifyAccount, stripe } from "../src/lib/stripe";
import { env, priceId } from "../src/lib/config";
import { plans, type Plan } from "../src/lib/plans";
try {
  await verifyAccount();
  for (const plan of Object.keys(plans) as Plan[]) {
    const price = await stripe().prices.retrieve(priceId(plan));
    if (
      price.livemode ||
      !price.active ||
      price.currency !== "eur" ||
      price.unit_amount !== plans[plan].cents ||
      price.recurring?.interval !== "month" ||
      price.recurring.interval_count !== 1 ||
      price.recurring.usage_type !== "licensed"
    )
      throw new Error("Invalid price");
    console.log(`${plan}: test price valid`);
  }
  const config = await stripe().billingPortal.configurations.retrieve(
    env("STRIPE_PORTAL_CONFIGURATION_ID"),
  );
  if (
    config.livemode ||
    !config.active ||
    config.features.subscription_update.enabled ||
    !config.features.subscription_cancel.enabled ||
    config.features.subscription_cancel.mode !== "at_period_end" ||
    !config.features.invoice_history.enabled ||
    !config.features.payment_method_update.enabled
  )
    throw new Error("Invalid portal");
  console.log(
    "Test account, prices and portal verified. Webhook delivery and payments still require end-to-end tests.",
  );
} catch {
  console.error(
    "Stripe configuration check failed. Check test environment, account, prices and portal without sharing secrets.",
  );
  process.exitCode = 1;
}
