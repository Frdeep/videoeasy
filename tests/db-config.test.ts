import { describe, expect, it } from "vitest";
import { poolConfig, safeErrorCode, SUPABASE_ROOT_CA } from "@/lib/db-config";

describe("poolConfig", () => {
  it("verifies Supabase pooler TLS with the Supabase root CA and drops sslmode", () => {
    const c = poolConfig(
      "postgresql://postgres.ref:p%40ss@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require",
    );
    expect(c.ssl).toEqual({ ca: SUPABASE_ROOT_CA, rejectUnauthorized: true });
    expect(c.connectionString).not.toContain("sslmode");
    expect(c.connectionString).toContain(
      "p%40ss@aws-1-eu-west-1.pooler.supabase.com:5432/postgres",
    );
  });
  it("applies to the direct Supabase host too", () => {
    expect(
      poolConfig("postgresql://postgres:x@db.ref.supabase.co:5432/postgres")
        .ssl,
    ).toBeTruthy();
  });
  it("leaves local and CI databases untouched", () => {
    const url = "postgresql://postgres:postgres@localhost:5432/test";
    expect(poolConfig(url)).toEqual({ connectionString: url });
  });
  it("embeds a PEM certificate", () => {
    expect(SUPABASE_ROOT_CA).toMatch(
      /^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----$/,
    );
  });
});

describe("safeErrorCode", () => {
  it("keeps only code-shaped values", () => {
    expect(safeErrorCode({ code: "28P01", message: "secret" })).toBe("28P01");
    expect(safeErrorCode({ code: "SELF_SIGNED_CERT_IN_CHAIN" })).toBe(
      "SELF_SIGNED_CERT_IN_CHAIN",
    );
    expect(safeErrorCode({ code: "postgres://user:pw@h" })).toBe("UNKNOWN");
    expect(safeErrorCode(new Error("x"))).toBe("UNKNOWN");
    expect(safeErrorCode(null)).toBe("UNKNOWN");
  });
});
