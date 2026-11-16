import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import {
  createJob,
  workOne,
  jobInput,
  isAdmin,
  requireAdmin,
  adjustCredits,
} from "../src/lib/platform";
const uid = "33333333-3333-4333-8333-333333333333";
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite("Platform jobs with real PostgreSQL and no provider requests", () => {
  beforeAll(async () => {
    if (
      !["localhost", "127.0.0.1"].includes(
        new URL(process.env.TEST_DATABASE_URL!).hostname,
      )
    )
      throw Error("Disposable local database required");
    await db().query(
      `do $$ begin create role anon; exception when duplicate_object then null; end $$;do $$ begin create role authenticated; exception when duplicate_object then null; end $$;create schema if not exists auth;create table if not exists auth.users(id uuid primary key);drop schema if exists platform cascade;drop schema if exists billing cascade;`,
    );
    for (const file of [
      "202611160001_billing.sql",
      "202611160002_platform.sql",
    ])
      await db().query(await readFile("supabase/migrations/" + file, "utf8"));
  });
  beforeEach(async () => {
    process.env.APP_ENV = "test";
    process.env.GENERATION_PROVIDER = "mock";
    delete process.env.ADMIN_USER_IDS;
    await db().query("truncate platform.jobs,platform.profiles,platform.audit");
    await db().query("truncate billing.customers cascade");
    await db().query(
      "insert into auth.users values($1) on conflict do nothing",
      [uid],
    );
    await db().query(
      "insert into billing.customers(user_id,customer_id) values($1,'cus_platform_fixture')",
      [uid],
    );
    const start = Math.floor(Date.now() / 1000) - 100;
    const end = start + 2592000;
    await db().query(
      "insert into billing.subscriptions(id,user_id,status,price_id,plan,period_start,period_end,cancel_at_period_end) values('sub_platform',$1,'active','price_fixture_standard','standard',$2,$3,false)",
      [uid, start, end],
    );
    await db().query(
      "insert into billing.invoices(id,user_id,subscription_id,status,amount_paid,currency) values('in_platform',$1,'sub_platform','paid',2300,'eur')",
      [uid],
    );
    await db().query(
      "insert into billing.credit_grants(invoice_id,user_id,subscription_id,plan,period_start,period_end,credits,remaining) values('in_platform',$1,'sub_platform','standard',$2,$3,1000,1000)",
      [uid, start, end],
    );
    await db().query(
      "update platform.models set enabled=true,credits=10 where id='mock-image'",
    );
  });
  afterAll(() => db().end());
  const input = () => ({
    id: randomUUID(),
    model: "mock-image",
    prompt: "Paysage de test",
  });
  it("concurrent retries reserve exactly once", async () => {
    const job = input();
    await Promise.all([createJob(uid, job), createJob(uid, job)]);
    expect(
      (await db().query("select remaining from billing.credit_grants")).rows[0]
        .remaining,
    ).toBe(990);
    expect((await db().query("select * from platform.jobs")).rowCount).toBe(1);
  });
  it("active subscription is required", async () => {
    await db().query("update billing.subscriptions set status='past_due'");
    await expect(createJob(uid, input())).rejects.toThrow(
      "Formule incompatible",
    );
    expect((await db().query("select * from platform.jobs")).rowCount).toBe(0);
  });
  it("suspended account and disabled model are rejected", async () => {
    await db().query(
      "insert into platform.profiles(user_id,suspended) values($1,true)",
      [uid],
    );
    await expect(createJob(uid, input())).rejects.toThrow("suspendu");
    await db().query("delete from platform.profiles");
    await db().query("update platform.models set enabled=false");
    await expect(createJob(uid, input())).rejects.toThrow("indisponible");
  });
  it("mock worker cannot run outside test environment", async () => {
    process.env.APP_ENV = "production";
    await expect(workOne()).rejects.toThrow("disabled");
    await expect(createJob(uid, input())).rejects.toThrow("non activée");
  });
  it("worker consumes one reservation and cannot repeat settlement", async () => {
    await createJob(uid, input());
    expect(await workOne()).toBe(true);
    expect(await workOne()).toBe(false);
    expect(
      (await db().query("select state from billing.reservations")).rows[0]
        .state,
    ).toBe("consumed");
    expect(
      (await db().query("select mock_result,status from platform.jobs"))
        .rows[0],
    ).toMatchObject({ mock_result: true, status: "succeeded" });
  });
  it("a simulated uncharged failure refunds exactly once", async () => {
    await createJob(uid, {
      ...input(),
      prompt: "[test-failure] incident simulé",
    });
    await workOne();
    await workOne();
    expect(
      (await db().query("select remaining from billing.credit_grants")).rows[0]
        .remaining,
    ).toBe(1000);
  });
  it("same request id with different prompt is rejected", async () => {
    const job = input();
    await createJob(uid, job);
    await expect(
      createJob(uid, { ...job, prompt: "different" }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("client cannot set cost or provider", () => {
    expect(
      jobInput.safeParse({ ...input(), credits: 0, provider: "kie" }).success,
    ).toBe(false);
  });
  it("administration fails closed and uses server configuration", () => {
    expect(isAdmin(uid)).toBe(false);
    expect(() => requireAdmin(uid)).toThrow();
    process.env.ADMIN_USER_IDS = uid;
    expect(isAdmin(uid)).toBe(true);
  });
  it("browser role cannot mutate or read private platform tables", async () => {
    const c = await db().connect();
    try {
      await c.query("set role authenticated");
      await expect(c.query("select * from platform.jobs")).rejects.toThrow(
        "permission denied",
      );
      await expect(
        c.query("update platform.models set credits=1"),
      ).rejects.toThrow("permission denied");
    } finally {
      await c.query("reset role");
      c.release();
    }
  });
  it("admin adjustments are idempotent, audited and cannot overdraw", async () => {
    process.env.ADMIN_USER_IDS = uid;
    const request = randomUUID();
    await Promise.all([
      adjustCredits(uid, uid, request, 50, "Correction test"),
      adjustCredits(uid, uid, request, 50, "Correction test"),
    ]);
    expect(
      (await db().query("select remaining from billing.credit_grants")).rows[0]
        .remaining,
    ).toBe(1050);
    expect(
      (await db().query("select * from platform.audit where action='credits'"))
        .rowCount,
    ).toBe(1);
    await expect(
      adjustCredits(uid, uid, randomUUID(), -2000, "Retrait test"),
    ).rejects.toMatchObject({ status: 409 });
  });
});
