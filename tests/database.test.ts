import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { invoice, event, subscription } from "./fixtures";
const mock = vi.hoisted(() => ({
  stripe: {
    customers: { retrieve: vi.fn(), create: vi.fn() },
    subscriptions: { list: vi.fn(), retrieve: vi.fn() },
    invoices: { list: vi.fn(), listLineItems: vi.fn() },
    prices: { retrieve: vi.fn() },
    checkout: { sessions: { retrieve: vi.fn(), create: vi.fn() } },
    billingPortal: {
      configurations: { retrieve: vi.fn() },
      sessions: { create: vi.fn() },
    },
  },
  verifyAccount: vi.fn(),
}));
vi.mock("../src/lib/stripe", () => ({
  stripe: () => mock.stripe,
  verifyAccount: mock.verifyAccount,
}));
import { db, withUserLock, transaction } from "../src/lib/db";
import { processEvent, expireGrants } from "../src/lib/sync";
import { createCheckout, createPortal } from "../src/lib/billing";
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const uid = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const user = { id: uid, email: "fixture@example.invalid" } as User;
async function* list<T>(values: T[]) {
  for (const value of values) yield value;
}
let invoices: Stripe.Invoice[];
let subs: ReturnType<typeof subscription>[];
async function credits() {
  return (await db().query("select * from billing.credit_grants")).rows;
}
async function reserve(cost = 100, job = randomUUID()) {
  await db().query("select billing.reserve_credits($1,$2,$3)", [
    uid,
    job,
    cost,
  ]);
  return job;
}
suite(
  "PostgreSQL integration with simulated Stripe API (never live payments)",
  () => {
    beforeAll(async () => {
      // Require an explicitly supplied disposable DB. This bootstrap does not run on Supabase.
      const url = new URL(process.env.TEST_DATABASE_URL!);
      if (!["localhost", "127.0.0.1"].includes(url.hostname))
        throw new Error("Local disposable database required");
      await db()
        .query(`do $$ begin create role anon; exception when duplicate_object then null; end $$;
     do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
     create schema if not exists auth; create table if not exists auth.users(id uuid primary key); drop schema if exists billing cascade;`);
      await db().query(
        await readFile("supabase/migrations/202611160001_billing.sql", "utf8"),
      );
    });
    beforeEach(async () => {
      vi.clearAllMocks();
      await db().query("truncate billing.customers cascade");
      await db().query("truncate billing.events");
      await db().query(
        "insert into auth.users values($1),($2) on conflict do nothing",
        [uid, other],
      );
      await db().query(
        "insert into billing.customers(user_id,customer_id) values($1,'cus_fixture')",
        [uid],
      );
      const inv = invoice();
      invoices = [inv];
      subs = [
        subscription(
          inv.lines.data[0].period.start,
          inv.lines.data[0].period.end,
        ),
      ];
      mock.stripe.customers.retrieve.mockResolvedValue({
        id: "cus_fixture",
        livemode: false,
        metadata: { supabase_user_id: uid },
      });
      mock.stripe.subscriptions.list.mockImplementation(() => list(subs));
      mock.stripe.invoices.list.mockImplementation(() => list(invoices));
      mock.stripe.invoices.listLineItems.mockImplementation((id: string) =>
        list(invoices.find((i) => i.id === id)!.lines.data),
      );
      mock.stripe.prices.retrieve.mockResolvedValue({
        id: "price_fixture_standard",
        active: true,
        livemode: false,
        currency: "eur",
        unit_amount: 2300,
        type: "recurring",
        recurring: {
          interval: "month",
          interval_count: 1,
          usage_type: "licensed",
        },
      });
      mock.stripe.billingPortal.configurations.retrieve.mockResolvedValue({
        id: "bpc_fixture",
        active: true,
        livemode: false,
        features: {
          invoice_history: { enabled: true },
          payment_method_update: { enabled: true },
          subscription_update: { enabled: false },
          subscription_cancel: { enabled: true, mode: "at_period_end" },
        },
      });
    });
    afterAll(async () => {
      await db().end();
    });
    it("initial payment and renewal grant once, with repeated delivery", async () => {
      invoices[0].billing_reason = "subscription_create";
      await processEvent(event());
      await processEvent(event());
      expect((await credits())[0].remaining).toBe(1000);
      expect(
        (
          await db().query(
            "select * from billing.credit_movements where kind='grant'",
          )
        ).rowCount,
      ).toBe(1);
      expect(mock.stripe.subscriptions.list).toHaveBeenCalledTimes(1);
    });
    it("two independent event workers for the same invoice grant only once", async () => {
      await Promise.all([
        processEvent(event("evt_a")),
        processEvent(event("evt_b")),
        processEvent(event("evt_a")),
      ]);
      expect(await credits()).toHaveLength(1);
      expect(
        (
          await db().query(
            "select * from billing.credit_movements where kind='grant'",
          )
        ).rowCount,
      ).toBe(1);
    });
    it("out of order events read current Stripe state and do not resurrect canceled access", async () => {
      subs[0].status = "canceled";
      await processEvent(event("evt_deleted", "customer.subscription.deleted"));
      await processEvent(
        event("evt_stale_update", "customer.subscription.updated"),
      );
      expect(
        (await db().query("select status from billing.subscriptions")).rows[0]
          .status,
      ).toBe("canceled");
      await expect(reserve()).rejects.toThrow("payment_required");
    });
    it("failed renewal blocks generation; paid recovery restores one allocation", async () => {
      invoices[0].status = "open";
      invoices[0].amount_paid = 0;
      subs[0].status = "past_due";
      await processEvent(event("evt_failed", "invoice.payment_failed"));
      expect(await credits()).toHaveLength(0);
      await expect(reserve()).rejects.toThrow("payment_required");
      invoices[0].status = "paid";
      invoices[0].amount_paid = 2300;
      subs[0].status = "active";
      await processEvent(event("evt_recovered"));
      expect((await credits())[0].remaining).toBe(1000);
      await reserve();
    });
    it("scheduled cancellation retains paid access and enforces concurrency", async () => {
      subs[0].cancel_at_period_end = true;
      await processEvent(event());
      const job = await reserve();
      await expect(reserve()).rejects.toThrow("concurrency_limit");
      await db().query("select billing.settle_reservation($1,$2,true)", [
        uid,
        job,
      ]);
      await reserve();
    });
    it("concurrent generation reservations never exceed Standard concurrency", async () => {
      await processEvent(event());
      const results = await Promise.allSettled([reserve(), reserve()]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect((await credits())[0].remaining).toBe(900);
    });
    it("renewal expires unused credits and keeps reserved jobs; late failure cannot replenish new month", async () => {
      const now = Math.floor(Date.now() / 1000);
      invoices = [invoice("in_old", now - 1000, now + 100)];
      subs = [subscription(now - 1000, now + 100)];
      await processEvent(event("evt_old"));
      const job = await reserve(150);
      // Move old period into the past without using wall-clock sleeps.
      await db().query("update billing.credit_grants set period_end=$1", [
        now - 1,
      ]);
      invoices = [invoice("in_new", now - 1, now + 2592000)];
      subs = [subscription(now - 1, now + 2592000)];
      await processEvent(event("evt_new"));
      expect(
        (
          await db().query(
            "select remaining from billing.credit_grants where invoice_id=$1",
            ["in_old"],
          )
        ).rows[0].remaining,
      ).toBe(0);
      expect(
        (
          await db().query(
            "select state from billing.reservations where id=$1",
            [job],
          )
        ).rows[0].state,
      ).toBe("reserved");
      await db().query("select billing.settle_reservation($1,$2,false)", [
        uid,
        job,
      ]);
      expect(
        (
          await db().query(
            "select remaining from billing.credit_grants where invoice_id=$1",
            ["in_new"],
          )
        ).rows[0].remaining,
      ).toBe(1000);
      expect(
        (
          await db().query(
            "select * from billing.credit_movements where kind='release_expired'",
          )
        ).rowCount,
      ).toBe(1);
    });
    it("a late old invoice cannot replace current credits", async () => {
      await processEvent(event("evt_current"));
      const start = invoices[0].lines.data[0].period.start;
      invoices.push(invoice("in_old", start - 2592000, start));
      await processEvent(event("evt_late"));
      await reserve();
      expect(
        (
          await db().query(
            "select remaining from billing.credit_grants where invoice_id=$1",
            ["in_old"],
          )
        ).rows[0].remaining,
      ).toBe(0);
    });
    it("proration does not allocate monthly credits", async () => {
      invoices[0].billing_reason = "subscription_update";
      await processEvent(event());
      expect(await credits()).toHaveLength(0);
    });
    it("failed processing rolls back event marker and retries successfully", async () => {
      mock.stripe.invoices.list.mockImplementationOnce(() => {
        throw new Error("network fixture");
      });
      await expect(processEvent(event())).rejects.toThrow();
      expect((await db().query("select * from billing.events")).rowCount).toBe(
        0,
      );
      await processEvent(event());
      expect(await credits()).toHaveLength(1);
    });
    it("RLS/privileges prohibit subscription, credits and privileged functions for browser roles", async () => {
      const c = await db().connect();
      try {
        await c.query("set role authenticated");
        await expect(
          c.query("update billing.customers set customer_id=$1", [
            "cus_attacker",
          ]),
        ).rejects.toThrow("permission denied");
        await expect(
          c.query("select billing.reserve_credits($1,$2,1)", [
            uid,
            randomUUID(),
          ]),
        ).rejects.toThrow("permission denied");
        await expect(
          c.query("insert into billing.credit_grants default values"),
        ).rejects.toThrow("permission denied");
      } finally {
        await c.query("reset role");
        c.release();
      }
    });
    it("customer ownership mismatch cannot open another user portal", async () => {
      mock.stripe.customers.retrieve.mockResolvedValue({
        livemode: false,
        metadata: { supabase_user_id: other },
      });
      await expect(createPortal(user)).rejects.toThrow("ownership");
      expect(mock.stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
    });
    it("portal fails closed if plan changes or immediate cancellation are enabled", async () => {
      mock.stripe.billingPortal.configurations.retrieve.mockResolvedValue({
        active: true,
        features: {
          invoice_history: { enabled: true },
          payment_method_update: { enabled: true },
          subscription_update: { enabled: true },
          subscription_cancel: { enabled: true, mode: "immediately" },
        },
      });
      await expect(createPortal(user)).rejects.toThrow("Unsafe portal");
    });
    it("two concurrent Checkouts return the same session and create only one", async () => {
      subs = [];
      mock.stripe.checkout.sessions.create.mockResolvedValue({
        id: "cs_fixture",
        url: "https://checkout.stripe.com/fixture",
        livemode: false,
      });
      mock.stripe.checkout.sessions.retrieve.mockResolvedValue({
        id: "cs_fixture",
        status: "open",
        url: "https://checkout.stripe.com/fixture",
      });
      const urls = await Promise.all([
        createCheckout(user, "standard"),
        createCheckout(user, "standard"),
      ]);
      expect(urls[0]).toBe(urls[1]);
      expect(mock.stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    });
    it("existing subscription blocks a new Checkout", async () => {
      await expect(createCheckout(user, "standard")).rejects.toMatchObject({
        status: 409,
      });
      expect(mock.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });
    it("uncertain network result retries the same durable idempotency key and parameters", async () => {
      subs = [];
      mock.stripe.checkout.sessions.create
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValueOnce({
          id: "cs_fixture",
          url: "https://checkout.stripe.com/fixture",
          livemode: false,
        });
      await expect(createCheckout(user, "standard")).rejects.toThrow("timeout");
      await createCheckout(user, "standard");
      const calls = mock.stripe.checkout.sessions.create.mock.calls;
      expect(calls[0]).toEqual(calls[1]);
    });
    it("live events are rejected before writes", async () => {
      const e = event();
      e.livemode = true;
      await expect(processEvent(e)).rejects.toThrow("Live");
      expect((await db().query("select * from billing.events")).rowCount).toBe(
        0,
      );
    });
    it("expire job is idempotent", async () => {
      await processEvent(event());
      await db().query(
        "update billing.credit_grants set period_end=period_start+1",
      );
      await withUserLock(uid, (c) =>
        transaction(c, () => expireGrants(c, uid)),
      );
      await withUserLock(uid, (c) =>
        transaction(c, () => expireGrants(c, uid)),
      );
      expect(
        (
          await db().query(
            "select * from billing.credit_movements where kind='expire'",
          )
        ).rowCount,
      ).toBe(1);
    });
    it("a paid subscription with stale synchronization blocks new generation", async () => {
      await processEvent(event());
      await db().query(
        "update billing.subscriptions set synced_at=now()-interval '16 minutes'",
      );
      await expect(reserve()).rejects.toThrow("payment_required");
    });
    it("successful portal uses mapped Customer and audited configuration only", async () => {
      mock.stripe.billingPortal.sessions.create.mockResolvedValue({
        url: "https://billing.stripe.com/fixture",
      });
      expect(await createPortal(user)).toBe(
        "https://billing.stripe.com/fixture",
      );
      expect(mock.stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: "cus_fixture",
        configuration: "bpc_fixture",
        return_url: "http://localhost:3000",
      });
    });
    it("resubscription after completed cancellation closes old attempt and creates a new one", async () => {
      subs = [];
      await db().query(
        "insert into billing.checkout_attempts(user_id,plan,expires_at,price_id,app_origin,session_id) values($1,'standard',1,'price_fixture_standard','http://localhost:3000','cs_old')",
        [uid],
      );
      mock.stripe.checkout.sessions.retrieve.mockResolvedValue({
        status: "complete",
        subscription: "sub_old",
      });
      mock.stripe.subscriptions.retrieve.mockResolvedValue({
        status: "canceled",
      });
      mock.stripe.checkout.sessions.create.mockResolvedValue({
        id: "cs_new",
        url: "https://checkout.stripe.com/new",
        livemode: false,
      });
      expect(await createCheckout(user, "standard")).toBe(
        "https://checkout.stripe.com/new",
      );
    });
    it("unknown Stripe customer is retryable and does not guess a user by email", async () => {
      await db().query("truncate billing.customers cascade");
      await expect(processEvent(event())).rejects.toThrow("mapping missing");
      expect(
        (await db().query("select * from billing.customers")).rowCount,
      ).toBe(0);
    });
    it("idempotent reservation and settlement cannot spend or refund twice", async () => {
      await processEvent(event());
      const job = await reserve(100);
      await reserve(100, job);
      await db().query("select billing.settle_reservation($1,$2,false)", [
        uid,
        job,
      ]);
      await db().query("select billing.settle_reservation($1,$2,false)", [
        uid,
        job,
      ]);
      expect((await credits())[0].remaining).toBe(1000);
    });
  },
);
