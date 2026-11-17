import "server-only";
import type Stripe from "stripe";
import type { PoolClient } from "pg";
import { stripe, verifyAccount } from "./stripe";
import { db, withUserLock, transaction } from "./db";
import { planForPrice } from "./config";
import { allocation } from "./invoice-policy";
import { assertMode, matchesMode } from "./stripe-mode";

export const handledEvents = new Set([
  "checkout.session.completed",
  "checkout.session.expired",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.voided",
  "invoice.marked_uncollectible",
]);
export function objectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id;
}
export async function persistInvoice(
  c: PoolClient,
  userId: string,
  invoice: Stripe.Invoice,
  lines: Stripe.InvoiceLineItem[],
) {
  const sub = objectId(invoice.parent?.subscription_details?.subscription);
  await c.query(
    `insert into billing.invoices(id,user_id,subscription_id,status,billing_reason,amount_paid,currency,hosted_invoice_url)
    values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(id) do update set status=excluded.status,
    amount_paid=excluded.amount_paid,hosted_invoice_url=excluded.hosted_invoice_url,synced_at=now()`,
    [
      invoice.id,
      userId,
      sub,
      invoice.status,
      invoice.billing_reason,
      invoice.amount_paid,
      invoice.currency,
      invoice.hosted_invoice_url,
    ],
  );
  const grant = allocation(invoice, lines, planForPrice);
  if (!grant) return;
  const result = await c.query(
    `insert into billing.credit_grants(invoice_id,user_id,subscription_id,plan,period_start,period_end,credits,remaining)
    values($1,$2,$3,$4,$5,$6,$7,$7) on conflict do nothing returning invoice_id`,
    [
      invoice.id,
      userId,
      grant.subscription,
      grant.plan,
      grant.start,
      grant.end,
      grant.credits,
    ],
  );
  if (result.rowCount)
    await c.query(
      `insert into billing.credit_movements(user_id,invoice_id,kind,credits) values($1,$2,'grant',$3)`,
      [userId, invoice.id, grant.credits],
    );
}
export async function expireGrants(c: PoolClient, userId: string) {
  await c.query(
    `with previous as (select invoice_id,remaining from billing.credit_grants
    where user_id=$1 and remaining>0 and period_end<=extract(epoch from now()) for update),
    expired as (update billing.credit_grants g set remaining=0 from previous p
    where g.invoice_id=p.invoice_id returning g.invoice_id,p.remaining)
    insert into billing.credit_movements(user_id,invoice_id,kind,credits)
    select $1,invoice_id,'expire',-remaining from expired`,
    [userId],
  );
}
// Caller owns the user lock. Always retrieve current Stripe resources INSIDE that lock.
// The event is a notification, never a trusted state snapshot.
export async function syncCustomer(
  c: PoolClient,
  userId: string,
  customerId: string,
) {
  await verifyAccount();
  const customer = await stripe().customers.retrieve(customerId);
  if (
    customer.deleted ||
    !matchesMode(customer.livemode) ||
    customer.metadata.supabase_user_id !== userId
  )
    throw new Error("Invalid customer for this Stripe mode");
  for await (const sub of stripe().subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  })) {
    assertMode(sub.livemode, "subscription");
    const item = sub.items.data[0];
    const plan =
      sub.items.data.length === 1 && !sub.items.has_more && item.quantity === 1
        ? planForPrice(item.price.id)
        : undefined;
    await c.query(
      `insert into billing.subscriptions(id,user_id,status,price_id,plan,period_start,period_end,cancel_at,cancel_at_period_end)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(id) do update set status=excluded.status,price_id=excluded.price_id,
      plan=excluded.plan,period_start=excluded.period_start,period_end=excluded.period_end,cancel_at=excluded.cancel_at,
      cancel_at_period_end=excluded.cancel_at_period_end,synced_at=now()`,
      [
        sub.id,
        userId,
        sub.status,
        item?.price.id,
        plan,
        item?.current_period_start,
        item?.current_period_end,
        sub.cancel_at,
        sub.cancel_at_period_end,
      ],
    );
  }
  // Complete pagination repairs missed invoice events and expired periods without regranting them.
  for await (const invoice of stripe().invoices.list({
    customer: customerId,
    limit: 100,
  })) {
    assertMode(invoice.livemode, "invoice");
    if (!invoice.parent?.subscription_details) continue;
    const lines: Stripe.InvoiceLineItem[] = [];
    for await (const line of stripe().invoices.listLineItems(invoice.id, {
      limit: 100,
    }))
      lines.push(line);
    await persistInvoice(c, userId, invoice, lines);
  }
  await expireGrants(c, userId);
}
export async function processEvent(event: Stripe.Event) {
  assertMode(event.livemode, "event");
  if (!handledEvents.has(event.type)) return;
  const customerId = objectId(
    (event.data.object as { customer?: string | { id: string } }).customer,
  );
  if (!customerId) throw new Error("Event customer missing");
  const mapping = await db().query(
    "select user_id from billing.customers where customer_id=$1",
    [customerId],
  );
  if (!mapping.rowCount)
    throw new Error("Customer mapping missing; retry after reconciliation");
  const userId: string = mapping.rows[0].user_id;
  await withUserLock(userId, (c) =>
    transaction(c, async () => {
      const inserted = await c.query(
        "insert into billing.events(id,type,created) values($1,$2,$3) on conflict do nothing returning id",
        [event.id, event.type, event.created],
      );
      if (!inserted.rowCount) return;
      await syncCustomer(c, userId, customerId);
    }),
  );
}
