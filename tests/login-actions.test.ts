import { beforeEach, describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOtp: vi.fn(),
  user: vi.fn(),
}));
vi.mock("../src/lib/auth", () => ({
  supabase: async () => ({ auth: mock }),
  requireUser: mock.user,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error("REDIRECT " + url);
  },
}));
import { authenticate } from "../src/app/login/actions";
import { requirePageUser } from "../src/lib/page-user";
import { HttpError } from "../src/lib/http";
function form(mode = "signup", password = "fixture-password-123") {
  const f = new FormData();
  f.set("mode", mode);
  f.set("email", "fixture@example.invalid");
  f.set("password", password);
  return f;
}
beforeEach(() => vi.clearAllMocks());
describe("auth outcome feedback", () => {
  it("redirects signup awaiting confirmation to the dedicated instructions", async () => {
    mock.signUp.mockResolvedValue({ data: { session: null }, error: null });
    await expect(authenticate(form())).rejects.toThrow(
      "REDIRECT /login?sent=confirmation",
    );
  });
  it("explains the unconfirmed-email login failure", async () => {
    mock.signInWithPassword.mockResolvedValue({
      data: null,
      error: { code: "email_not_confirmed" },
    });
    await expect(authenticate(form("password"))).rejects.toThrow(
      "error=confirmation",
    );
  });
  it("explains the send cooldown without exposing the raw provider message", async () => {
    mock.signUp.mockResolvedValue({
      data: null,
      error: {
        code: "over_email_send_rate_limit",
        message: "private fixture details",
      },
    });
    await expect(authenticate(form())).rejects.toThrow("error=wait");
  });
  it("redirects an authenticated login to the account", async () => {
    mock.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "fixture" } },
      error: null,
    });
    await expect(authenticate(form("password"))).rejects.toThrow(
      "REDIRECT /account",
    );
  });
  it("rejects a short signup password before calling Supabase", async () => {
    await expect(authenticate(form("signup", "short"))).rejects.toThrow(
      "error=invalid",
    );
    expect(mock.signUp).not.toHaveBeenCalled();
  });
  it("accepts existing shorter login passwords", async () => {
    mock.signInWithPassword.mockResolvedValue({
      data: { session: {} },
      error: null,
    });
    await expect(
      authenticate(form("password", "old-password")),
    ).rejects.toThrow("REDIRECT /account");
  });
  it("returns controlled feedback when provider connection fails", async () => {
    mock.signUp.mockRejectedValue(new Error("private connection failure"));
    await expect(authenticate(form())).rejects.toThrow("error=invalid");
  });
  it("unauthenticated page redirects rather than throwing a rendering 401", async () => {
    mock.user.mockRejectedValue(new HttpError(401, "Login"));
    await expect(requirePageUser()).rejects.toThrow("REDIRECT /login");
  });
  it("page does not mask a genuine server error", async () => {
    mock.user.mockRejectedValue(new Error("server failure"));
    await expect(requirePageUser()).rejects.toThrow("server failure");
  });
});
