import { afterEach, describe, it, expect } from "vitest";
import {
  assertMode,
  keyMatchesMode,
  matchesMode,
  stripeMode,
} from "../src/lib/stripe-mode";
import { stripe } from "../src/lib/stripe";
afterEach(() => {
  delete process.env.STRIPE_MODE;
  delete process.env.STRIPE_SECRET_KEY;
});
describe("explicit Stripe mode", () => {
  it("defaults to test when unset, preserving historical behaviour", () => {
    expect(stripeMode()).toBe("test");
    expect(matchesMode(false)).toBe(true);
    expect(matchesMode(true)).toBe(false);
  });
  it("live must be written explicitly and only accepts live objects", () => {
    process.env.STRIPE_MODE = "live";
    expect(matchesMode(true)).toBe(true);
    expect(matchesMode(false)).toBe(false);
    expect(matchesMode(undefined)).toBe(false);
    expect(() => assertMode(false, "invoice")).toThrow("mode mismatch");
  });
  it.each(["LIVE", "prod", "production", " live"])(
    "rejects ambiguous value %j",
    (value) => {
      process.env.STRIPE_MODE = value;
      expect(() => stripeMode()).toThrow("STRIPE_MODE");
    },
  );
  it("key prefixes must match the mode", () => {
    expect(keyMatchesMode("sk_test_x")).toBe(true);
    expect(keyMatchesMode("rk_test_x")).toBe(true);
    expect(keyMatchesMode("sk_live_x")).toBe(false);
    process.env.STRIPE_MODE = "live";
    expect(keyMatchesMode("sk_live_x")).toBe(true);
    expect(keyMatchesMode("rk_live_x")).toBe(true);
    expect(keyMatchesMode("sk_test_x")).toBe(false);
    expect(keyMatchesMode("pk_live_x")).toBe(false);
  });
  it("the SDK factory refuses a key from the other mode", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_fixture_only";
    expect(() => stripe()).toThrow("STRIPE_MODE=test");
    process.env.STRIPE_MODE = "live";
    expect(() => stripe()).not.toThrow();
    process.env.STRIPE_SECRET_KEY = "sk_test_fixture_only";
    expect(() => stripe()).toThrow("STRIPE_MODE=live");
  });
});
