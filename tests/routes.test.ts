import { beforeEach, describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  user: vi.fn(),
  checkout: vi.fn(),
  portal: vi.fn(),
}));
vi.mock("../src/lib/auth", async () => {
  const { HttpError } = await import("../src/lib/http");
  return {
    requireUser: mock.user,
    requireOrigin: (r: Request) => {
      if (r.headers.get("origin") !== "http://localhost:3000")
        throw new HttpError(403, "Origin");
    },
  };
});
vi.mock("../src/lib/billing", () => ({
  createCheckout: mock.checkout,
  createPortal: mock.portal,
}));
import { POST as checkout } from "../src/app/api/billing/checkout/route";
import { POST as portal } from "../src/app/api/billing/portal/route";
import { HttpError } from "../src/lib/http";
function request(body: object, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.user.mockResolvedValue({ id: "fixture-user" });
  mock.checkout.mockResolvedValue("https://checkout.stripe.com/fixture");
});
describe("authenticated billing boundaries", () => {
  it("accepts a plan only and passes authenticated user to server", async () => {
    expect((await checkout(request({ plan: "standard" }))).status).toBe(200);
    expect(mock.checkout).toHaveBeenCalledWith(
      { id: "fixture-user" },
      "standard",
    );
  });
  it.each([
    { plan: "standard", price: "price_attacker" },
    { plan: "standard", credits: 100000 },
    { plan: "standard", customer: "cus_other" },
    { plan: "__proto__" },
  ])("rejects browser controlled billing values %j", async (body) => {
    expect((await checkout(request(body))).status).toBe(400);
    expect(mock.checkout).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated Checkout and Portal", async () => {
    mock.user.mockRejectedValue(new HttpError(401, "Login"));
    expect((await checkout(request({ plan: "standard" }))).status).toBe(401);
    expect((await portal(request({}))).status).toBe(401);
    expect(mock.checkout).not.toHaveBeenCalled();
    expect(mock.portal).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests", async () => {
    expect(
      (
        await checkout(
          request({ plan: "standard" }, "https://attacker.invalid"),
        )
      ).status,
    ).toBe(403);
    expect(mock.checkout).not.toHaveBeenCalled();
  });
  it("rejects a client supplied Customer in Portal", async () => {
    expect((await portal(request({ customer: "cus_other" }))).status).toBe(400);
    expect(mock.portal).not.toHaveBeenCalled();
  });
});
