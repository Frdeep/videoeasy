import type Stripe from "stripe";
export function invoice(
  id = "in_fixture",
  start = Math.floor(Date.now() / 1000) - 100,
  end = start + 2592000,
) {
  const line = {
    id: "il_fixture",
    amount: 2300,
    quantity: 1,
    currency: "eur",
    period: { start, end },
    parent: {
      type: "subscription_item_details",
      subscription_item_details: {
        subscription: "sub_fixture",
        proration: false,
      },
    },
    pricing: {
      type: "price_details",
      price_details: { price: "price_fixture_standard" },
    },
  };
  return {
    id,
    livemode: false,
    customer: "cus_fixture",
    status: "paid",
    amount_paid: 2300,
    currency: "eur",
    billing_reason: "subscription_cycle",
    parent: {
      type: "subscription_details",
      subscription_details: { subscription: "sub_fixture" },
    },
    lines: { data: [line], has_more: false },
    hosted_invoice_url: null,
  } as unknown as Stripe.Invoice;
}
export function event(id = "evt_fixture", type = "invoice.paid") {
  return {
    id,
    type,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: { object: { customer: "cus_fixture", status: "stale" } },
  } as unknown as Stripe.Event;
}
export function subscription(start: number, end: number, status = "active") {
  return {
    id: "sub_fixture",
    livemode: false,
    status,
    cancel_at: null,
    cancel_at_period_end: false,
    items: {
      data: [
        {
          quantity: 1,
          price: { id: "price_fixture_standard" },
          current_period_start: start,
          current_period_end: end,
        },
      ],
      has_more: false,
    },
  };
}
