import { beforeEach, describe, it, expect, vi } from "vitest";
import Stripe from "stripe";
const mock = vi.hoisted(() => ({ processEvent: vi.fn() }));
vi.mock("../src/lib/sync", () => mock);
import { POST } from "../src/app/api/stripe/webhook/route";
const secret = "whsec_fixture_only_not_a_real_secret";
const sdk = new Stripe("sk_test_fixture_only");
beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture_only";
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  vi.clearAllMocks();
});
function req(payload: string, body = payload) {
  return new Request("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    headers: {
      "stripe-signature": sdk.webhooks.generateTestHeaderString({
        payload,
        secret,
      }),
    },
    body,
  });
}
describe("raw webhook body verification with real Stripe signature SDK", () => {
  it("accepts correctly signed raw payload", async () => {
    const body = JSON.stringify({
      id: "evt_fixture",
      type: "invoice.paid",
      livemode: false,
    });
    expect((await POST(req(body))).status).toBe(200);
    expect(mock.processEvent).toHaveBeenCalledOnce();
  });
  it("rejects a body modified after signing", async () => {
    const body = JSON.stringify({ id: "evt_fixture", livemode: false });
    expect((await POST(req(body, body + " "))).status).toBe(400);
    expect(mock.processEvent).not.toHaveBeenCalled();
  });
  it("rejects missing signature", async () => {
    expect(
      (
        await POST(
          new Request("http://localhost:3000", { method: "POST", body: "{}" }),
        )
      ).status,
    ).toBe(400);
  });
  it("rejects a signed live-mode event", async () => {
    expect(
      (await POST(req(JSON.stringify({ id: "evt_fixture", livemode: true }))))
        .status,
    ).toBe(400);
    expect(mock.processEvent).not.toHaveBeenCalled();
  });
  it("returns retryable 503 on processing failure", async () => {
    mock.processEvent.mockRejectedValueOnce(
      new Error("fixture network failure"),
    );
    expect(
      (await POST(req(JSON.stringify({ id: "evt_fixture", livemode: false }))))
        .status,
    ).toBe(503);
  });
});
