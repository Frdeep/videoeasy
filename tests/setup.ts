import { vi } from "vitest";
vi.mock("server-only", () => ({}));
process.env.APP_URL = "http://localhost:3000";
process.env.STRIPE_PRICE_STANDARD = "price_fixture_standard";
process.env.STRIPE_PRICE_METAL = "price_fixture_metal";
process.env.STRIPE_PRICE_GOLD = "price_fixture_gold";
process.env.STRIPE_PORTAL_CONFIGURATION_ID = "bpc_fixture";
if (process.env.TEST_DATABASE_URL)
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
