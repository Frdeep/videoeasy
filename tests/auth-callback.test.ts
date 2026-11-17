import { beforeEach, describe, it, expect, vi } from "vitest";
import { callbackOutcome } from "../src/lib/auth-callback";
const mock = vi.hoisted(() => ({ exchange: vi.fn(), getUser: vi.fn() }));
vi.mock("../src/lib/auth", async () => {
  const { HttpError } = await import("../src/lib/http");
  return {
    supabase: async () => ({
      auth: { exchangeCodeForSession: mock.exchange, getUser: mock.getUser },
    }),
    requireOrigin: (r: Request) => {
      if (r.headers.get("origin") !== "http://localhost:3000")
        throw new HttpError(403, "Origin");
    },
  };
});
import { POST } from "../src/app/auth/exchange/route";
beforeEach(() => vi.clearAllMocks());
function req(body: object, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/auth/exchange", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
describe("provider callback processing", () => {
  it("recognizes expiry errors in fragments and query strings", () => {
    expect(
      callbackOutcome("", "#error=access_denied&error_code=otp_expired"),
    ).toEqual({ error: "expired" });
    expect(callbackOutcome("?error_code=otp_expired", "")).toEqual({
      error: "expired",
    });
  });
  it("does not claim success for missing PKCE codes or implicit token fragments", () => {
    expect(callbackOutcome("", "")).toEqual({ error: "session" });
    expect(
      callbackOutcome("", "#access_token=fixture&refresh_token=fixture"),
    ).toEqual({ error: "session" });
  });
  it("uses errors before any code and ignores redirect targets", () => {
    expect(
      callbackOutcome("?code=fixture&next=https://attacker.invalid", ""),
    ).toEqual({ code: "fixture" });
    expect(callbackOutcome("?code=fixture", "#error_code=bad_code")).toEqual({
      error: "callback",
    });
  });
  it("requires an actual session plus a verified user", async () => {
    mock.exchange.mockResolvedValue({
      data: { session: { access_token: "fixture" } },
      error: null,
    });
    mock.getUser.mockResolvedValue({
      data: { user: { id: "fixture" } },
      error: null,
    });
    const r = await POST(req({ code: "valid-fixture" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(r.headers.get("Cache-Control")).toContain("no-store");
  });
  it("does not accept a successful response without a session", async () => {
    mock.exchange.mockResolvedValue({ data: { session: null }, error: null });
    expect((await POST(req({ code: "fixture" }))).status).toBe(400);
    expect(mock.getUser).not.toHaveBeenCalled();
  });
  it("rejects a session whose user cannot be verified", async () => {
    mock.exchange.mockResolvedValue({ data: { session: {} }, error: null });
    mock.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid" },
    });
    expect((await POST(req({ code: "fixture" }))).status).toBe(401);
  });
  it("does not exchange a code on cross origin requests", async () => {
    expect(
      (await POST(req({ code: "fixture" }, "https://attacker.invalid"))).status,
    ).toBe(403);
    expect(mock.exchange).not.toHaveBeenCalled();
  });
  it("rejects extra properties and invalid JSON", async () => {
    expect(
      (await POST(req({ code: "fixture", next: "https://attacker.invalid" })))
        .status,
    ).toBe(400);
    expect(mock.exchange).not.toHaveBeenCalled();
  });
});
