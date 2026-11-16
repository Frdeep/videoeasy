import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = vi.hoisted(() => ({ getUser: vi.fn(), getSession: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: mock }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: vi.fn() }),
}));
import { requireUser, requireOrigin } from "../src/lib/auth";
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture_publishable";
  vi.clearAllMocks();
});
describe("Supabase authentication verification", () => {
  it("verifies the user on Supabase rather than trusting an unverified local session", async () => {
    mock.getUser.mockResolvedValue({
      data: { user: { id: "verified-fixture" } },
      error: null,
    });
    expect((await requireUser()).id).toBe("verified-fixture");
    expect(mock.getUser).toHaveBeenCalledOnce();
    expect(mock.getSession).not.toHaveBeenCalled();
  });
  it("rejects invalid or expired Supabase credentials", async () => {
    mock.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "fixture" },
    });
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
  it("checks origin against fixed server URL", () => {
    expect(() =>
      requireOrigin(
        new Request("http://localhost:3000", {
          headers: { origin: "https://attacker.invalid" },
        }),
      ),
    ).toThrow();
    expect(() =>
      requireOrigin(
        new Request("http://localhost:3000", {
          headers: { origin: "http://localhost:3000" },
        }),
      ),
    ).not.toThrow();
  });
});
