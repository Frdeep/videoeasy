import "server-only";
import type { User } from "@supabase/supabase-js";
import type { PoolClient } from "pg";
import { stripe, verifyAccount } from "./stripe";
import { withUserLock, transaction } from "./db";
import { appUrl, env, priceId } from "./config";
import { plans, type Plan } from "./plans";
import { HttpError } from "./http";
import { syncCustomer } from "./sync";
import { assertMode, matchesMode } from "./stripe-mode";

async function customerForUser(c: PoolClient, user: User) {
  await c.query(
    "insert into billing.customers(user_id,email_snapshot) values($1,$2) on conflict do nothing",
    [user.id, user.email ?? null],
  );
  const {
    rows: [row],
  } = await c.query("select * from billing.customers where user_id=$1", [
    user.id,
  ]);
  if (row.customer_id) {
    const customer = await stripe().customers.retrieve(row.customer_id);
    if (
      customer.deleted ||
      !matchesMode(customer.livemode) ||
      customer.metadata.supabase_user_id !== user.id
    )
      throw new Error("Customer ownership mismatch");
    return row.customer_id as string;
  }
  // Fail closed beyond Stripe's >=24h idempotency retention. An operator must reconcile.
  if (Date.now() - new Date(row.created_at).getTime() > 23 * 3600_000)
    throw new HttpError(409, "Association Stripe à vérifier par le support.");
  const customer = await stripe().customers.create(
    {
      ...(row.email_snapshot ? { email: row.email_snapshot } : {}),
      metadata: { supabase_user_id: user.id },
    },
    { idempotencyKey: `customer-${row.creation_key}` },
  );
  assertMode(customer.livemode, "customer");
  await c.query(
    "update billing.customers set customer_id=$2 where user_id=$1",
    [user.id, customer.id],
  );
  return customer.id;
}
export async function createCheckout(user: User, plan: Plan) {
  await verifyAccount();
  return withUserLock(user.id, async (c) => {
    const customer = await customerForUser(c, user);
    for await (const sub of stripe().subscriptions.list({
      customer,
      status: "all",
      limit: 100,
    })) {
      if (!["canceled", "incomplete_expired"].includes(sub.status))
        throw new HttpError(
          409,
          "Un abonnement existe déjà. Utilisez le portail client.",
        );
    }
    let {
      rows: [attempt],
    } = await c.query(
      "select * from billing.checkout_attempts where user_id=$1 and not closed",
      [user.id],
    );
    if (attempt?.session_id) {
      const existing = await stripe().checkout.sessions.retrieve(
        attempt.session_id,
      );
      if (existing.status === "open") {
        if (attempt.plan !== plan)
          throw new HttpError(
            409,
            "Une autre commande est ouverte. Terminez-la ou attendez son expiration (30 min).",
          );
        return existing.url!;
      }
      if (existing.status === "complete") {
        const id =
          typeof existing.subscription === "string"
            ? existing.subscription
            : existing.subscription?.id;
        const prior = id
          ? await stripe().subscriptions.retrieve(id)
          : undefined;
        if (
          !prior ||
          !["canceled", "incomplete_expired"].includes(prior.status)
        ) {
          await transaction(c, () => syncCustomer(c, user.id, customer));
          throw new HttpError(
            409,
            "Paiement déjà envoyé. Consultez votre abonnement avant de recommencer.",
          );
        }
      }
      await c.query(
        "update billing.checkout_attempts set closed=true where id=$1",
        [attempt.id],
      );
      attempt = undefined;
    }
    if (
      attempt &&
      Date.now() - new Date(attempt.created_at).getTime() > 23 * 3600_000
    )
      throw new HttpError(
        409,
        "Commande à vérifier par le support avant une nouvelle tentative.",
      );
    if (!attempt) {
      const price = await stripe().prices.retrieve(priceId(plan));
      if (
        !matchesMode(price.livemode) ||
        !price.active ||
        price.currency !== "eur" ||
        price.unit_amount !== plans[plan].cents ||
        price.type !== "recurring" ||
        price.recurring?.interval !== "month" ||
        price.recurring.interval_count !== 1 ||
        price.recurring.usage_type !== "licensed"
      )
        throw new Error("Invalid configured price");
      ({
        rows: [attempt],
      } = await c.query(
        "insert into billing.checkout_attempts(user_id,plan,expires_at,price_id,app_origin) values($1,$2,$3,$4,$5) returning *",
        [
          user.id,
          plan,
          Math.floor(Date.now() / 1000) + 1860,
          priceId(plan),
          appUrl(),
        ],
      ));
    }
    if (attempt.plan !== plan)
      throw new HttpError(
        409,
        "Reprenez la formule de la commande précédente.",
      );
    // Durable attempt before external write. After a timeout, replay EXACT same request.
    // If a response is lost until expires_at, support must reconcile; never mint a second key.
    if (Number(attempt.expires_at) <= Date.now() / 1000 && !attempt.session_id)
      throw new HttpError(
        409,
        "Commande incertaine à réconcilier par le support.",
      );
    const session = await stripe().checkout.sessions.create(
      {
        mode: "subscription",
        customer,
        client_reference_id: user.id,
        line_items: [{ price: attempt.price_id, quantity: 1 }],
        subscription_data: {
          billing_mode: { type: "flexible" },
          metadata: { supabase_user_id: user.id, plan },
        },
        metadata: { supabase_user_id: user.id, plan },
        success_url: `${attempt.app_origin}/billing/success`,
        cancel_url: `${attempt.app_origin}/billing/cancel`,
        expires_at: Number(attempt.expires_at),
        automatic_tax: { enabled: false },
        allow_promotion_codes: false,
      },
      { idempotencyKey: `checkout-${attempt.id}` },
    );
    if (!matchesMode(session.livemode) || !session.url)
      throw new Error("Invalid checkout session");
    await c.query(
      "update billing.checkout_attempts set session_id=$2 where id=$1",
      [attempt.id, session.id],
    );
    return session.url;
  });
}
export async function createPortal(user: User) {
  await verifyAccount();
  return withUserLock(user.id, async (c) => {
    const {
      rows: [row],
    } = await c.query(
      "select customer_id from billing.customers where user_id=$1",
      [user.id],
    );
    if (!row?.customer_id)
      throw new HttpError(409, "Aucun compte de facturation.");
    const customer = await stripe().customers.retrieve(row.customer_id);
    if (
      customer.deleted ||
      !matchesMode(customer.livemode) ||
      customer.metadata.supabase_user_id !== user.id
    )
      throw new Error("Customer ownership mismatch");
    const configuration = await stripe().billingPortal.configurations.retrieve(
      env("STRIPE_PORTAL_CONFIGURATION_ID"),
    );
    const features = configuration.features;
    if (
      !matchesMode(configuration.livemode) ||
      !configuration.active ||
      !features.invoice_history.enabled ||
      !features.payment_method_update.enabled ||
      features.subscription_update.enabled ||
      !features.subscription_cancel.enabled ||
      features.subscription_cancel.mode !== "at_period_end"
    )
      throw new Error("Unsafe portal configuration");
    const session = await stripe().billingPortal.sessions.create({
      customer: row.customer_id,
      configuration: configuration.id,
      return_url: appUrl(),
    });
    return session.url;
  });
}
