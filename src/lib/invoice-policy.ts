import type Stripe from "stripe";
import { plans, type Plan } from "./plans";
export function allocation(
  invoice: Stripe.Invoice,
  lines: Stripe.InvoiceLineItem[],
  resolvePlan: (id: string) => Plan | undefined,
) {
  if (
    invoice.livemode ||
    invoice.status !== "paid" ||
    invoice.amount_paid <= 0 ||
    invoice.currency !== "eur"
  )
    return;
  if (
    !["subscription_create", "subscription_cycle"].includes(
      invoice.billing_reason ?? "",
    )
  )
    return;
  const sub = invoice.parent?.subscription_details?.subscription;
  const subscription = typeof sub === "string" ? sub : sub?.id;
  if (!subscription || lines.length !== 1) return;
  const line = lines[0];
  const details = line.parent?.subscription_item_details;
  const price = line.pricing?.price_details?.price;
  const priceValue = typeof price === "string" ? price : price?.id;
  const plan = priceValue ? resolvePlan(priceValue) : undefined;
  if (
    !plan ||
    !details ||
    details.proration ||
    line.quantity !== 1 ||
    line.amount !== plans[plan].cents
  )
    return;
  const lineSubscription = details.subscription;
  if (lineSubscription !== subscription || line.period.end <= line.period.start)
    return;
  return {
    subscription,
    plan,
    price: priceValue!,
    start: line.period.start,
    end: line.period.end,
    credits: plans[plan].credits,
  };
}
