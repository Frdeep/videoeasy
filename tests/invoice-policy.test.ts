import { afterEach, describe, it, expect } from "vitest";
import { invoice } from "./fixtures";
import { allocation } from "../src/lib/invoice-policy";
const resolve = (id: string) =>
  id === "price_fixture_standard" ? ("standard" as const) : undefined;
describe("monthly allocation eligibility", () => {
  it("allocates only a paid monthly invoice", () => {
    const i = invoice();
    expect(allocation(i, i.lines.data, resolve)?.credits).toBe(1000);
  });
  it.each(["subscription_update", "manual", "subscription_threshold"])(
    "rejects %s billing reasons",
    (reason) => {
      const i = invoice();
      i.billing_reason = reason as typeof i.billing_reason;
      expect(allocation(i, i.lines.data, resolve)).toBeUndefined();
    },
  );
  it.each(["open", "uncollectible", "void", "draft"])(
    "rejects invoice status %s",
    (status) => {
      const i = invoice();
      i.status = status as typeof i.status;
      expect(allocation(i, i.lines.data, resolve)).toBeUndefined();
    },
  );
  it("rejects prorations, unknown prices, live invoices, zero payments, extra lines and tampered amounts", () => {
    for (const mutate of [
      (i: ReturnType<typeof invoice>) => {
        i.lines.data[0].parent!.subscription_item_details!.proration = true;
      },
      (i: ReturnType<typeof invoice>) => {
        i.lines.data[0].pricing!.price_details!.price = "price_unknown";
      },
      (i: ReturnType<typeof invoice>) => {
        i.livemode = true;
      },
      (i: ReturnType<typeof invoice>) => {
        i.amount_paid = 0;
      },
      (i: ReturnType<typeof invoice>) => {
        i.lines.data.push(i.lines.data[0]);
      },
      (i: ReturnType<typeof invoice>) => {
        i.lines.data[0].amount = 1;
      },
      (i: ReturnType<typeof invoice>) => {
        i.lines.data[0].quantity = 100;
      },
    ]) {
      const i = invoice();
      mutate(i);
      expect(allocation(i, i.lines.data, resolve)).toBeUndefined();
    }
  });
});
describe("allocation follows STRIPE_MODE", () => {
  afterEach(() => {
    delete process.env.STRIPE_MODE;
  });
  it("live mode allocates a live invoice and rejects a test invoice", () => {
    process.env.STRIPE_MODE = "live";
    const live = invoice();
    live.livemode = true;
    expect(allocation(live, live.lines.data, resolve)?.credits).toBe(1000);
    const test = invoice();
    expect(allocation(test, test.lines.data, resolve)).toBeUndefined();
  });
  it("explicit test mode keeps rejecting live invoices", () => {
    process.env.STRIPE_MODE = "test";
    const live = invoice();
    live.livemode = true;
    expect(allocation(live, live.lines.data, resolve)).toBeUndefined();
  });
  it("an invalid STRIPE_MODE fails closed", () => {
    process.env.STRIPE_MODE = "production";
    const i = invoice();
    expect(() => allocation(i, i.lines.data, resolve)).toThrow("STRIPE_MODE");
  });
});
