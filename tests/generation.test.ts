import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Provider and storage are simulated; PostgreSQL, reservations and settlement are real.
const kie = vi.hoisted(() => ({ createTask: vi.fn(), getTask: vi.fn() }));
const media = vi.hoisted(() => ({ importResult: vi.fn() }));
vi.mock("../src/lib/kie", async (orig) => ({
  ...(await orig<typeof import("../src/lib/kie")>()),
  createTask: kie.createTask,
  getTask: kie.getTask,
}));
vi.mock("../src/lib/media-store", async (orig) => ({
  ...(await orig<typeof import("../src/lib/media-store")>()),
  importResult: media.importResult,
}));
import { db } from "../src/lib/db";
import { createJob } from "../src/lib/platform";
import { KieError } from "../src/lib/kie";
import {
  submitJob,
  refreshJob,
  advanceUserJobs,
  onProviderCallback,
} from "../src/lib/generation";

const uid = "44444444-4444-4444-8444-444444444444";
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;

suite("Kie generation lifecycle with real PostgreSQL", () => {
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
    for (const f of [
      "202611160001_billing.sql",
      "202611160002_platform.sql",
      "202611170001_kie_generation.sql",
      "202611170002_calendar_rewrite.sql",
    ])
      await db().query(await readFile("supabase/migrations/" + f, "utf8"));
  });
  beforeEach(async () => {
    vi.resetAllMocks();
    process.env.KIE_API_KEY = "kie_fixture";
    delete process.env.GENERATION_PROVIDER;
    await db().query("truncate platform.jobs,platform.profiles,platform.audit");
    await db().query("truncate billing.customers cascade");
    await db().query(
      "insert into auth.users values($1) on conflict do nothing",
      [uid],
    );
    await db().query(
      "insert into billing.customers(user_id,customer_id) values($1,'cus_gen_fixture')",
      [uid],
    );
    const start = Math.floor(Date.now() / 1000) - 100;
    const end = start + 2592000;
    await db().query(
      "insert into billing.subscriptions(id,user_id,status,price_id,plan,period_start,period_end,cancel_at_period_end) values('sub_gen',$1,'active','price_fixture_standard','standard',$2,$3,false)",
      [uid, start, end],
    );
    await db().query(
      "insert into billing.invoices(id,user_id,subscription_id,status,amount_paid,currency) values('in_gen',$1,'sub_gen','paid',2300,'eur')",
      [uid],
    );
    await db().query(
      "insert into billing.credit_grants(invoice_id,user_id,subscription_id,plan,period_start,period_end,credits,remaining) values('in_gen',$1,'sub_gen','standard',$2,$3,1000,1000)",
      [uid, start, end],
    );
  });
  afterAll(() => db().end());

  const remaining = async () =>
    (await db().query("select remaining from billing.credit_grants")).rows[0]
      .remaining;
  const job = async (id: string) =>
    (await db().query("select * from platform.jobs where id=$1", [id])).rows[0];
  const launch = async () => {
    const id = randomUUID();
    await createJob(uid, {
      id,
      model: "seedance-2-fast-16x9",
      prompt: "Un phare sous l'orage",
    });
    return id;
  };

  it("reserves the server cost and sends the fixed configuration once", async () => {
    kie.createTask.mockResolvedValue("task_1");
    const id = await launch();
    expect(await remaining()).toBe(925);
    await Promise.all([submitJob(id), submitJob(id)]);
    expect(kie.createTask).toHaveBeenCalledTimes(1);
    expect(kie.createTask.mock.calls[0][0]).toBe("bytedance/seedance-2-fast");
    expect(kie.createTask.mock.calls[0][1]).toMatchObject({
      prompt: "Un phare sous l'orage",
      resolution: "720p",
      aspect_ratio: "16:9",
      duration: 5,
    });
    expect(await job(id)).toMatchObject({
      status: "running",
      provider_task_id: "task_1",
      provider_state: "waiting",
    });
  });

  it("success imports the file, consumes credits once", async () => {
    kie.createTask.mockResolvedValue("task_2");
    kie.getTask.mockResolvedValue({
      state: "success",
      resultUrls: ["https://cdn.example.com/v.mp4"],
      failCode: null,
      creditsConsumed: 124,
    });
    media.importResult.mockResolvedValue({
      key: `${uid}/x.mp4`,
      contentType: "video/mp4",
      size: 1234,
    });
    const id = await launch();
    await submitJob(id);
    await Promise.all([
      refreshJob(id, true),
      refreshJob(id, true),
      onProviderCallback("task_2"),
    ]);
    expect(media.importResult).toHaveBeenCalledTimes(1);
    expect(await job(id)).toMatchObject({
      status: "succeeded",
      object_key: `${uid}/x.mp4`,
      content_type: "video/mp4",
    });
    expect(Number((await job(id)).provider_credits)).toBe(124);
    expect(await remaining()).toBe(925);
    expect(
      (await db().query("select state from billing.reservations")).rows[0]
        .state,
    ).toBe("consumed");
  });

  it("provider failure releases credits exactly once", async () => {
    kie.createTask.mockResolvedValue("task_3");
    kie.getTask.mockResolvedValue({
      state: "fail",
      resultUrls: [],
      failCode: "500",
      creditsConsumed: 0,
    });
    const id = await launch();
    await submitJob(id);
    await refreshJob(id, true);
    await refreshJob(id, true);
    expect(await job(id)).toMatchObject({
      status: "failed",
      error_code: "kie_500",
    });
    expect(await remaining()).toBe(1000);
  });

  it("definite refusal at submit fails and refunds", async () => {
    kie.createTask.mockRejectedValue(new KieError("402", false));
    const id = await launch();
    await submitJob(id);
    expect(await job(id)).toMatchObject({
      status: "failed",
      error_code: "submit_402",
    });
    expect(await remaining()).toBe(1000);
  });

  it("submit timeout becomes uncertain, keeps credits and is never resubmitted", async () => {
    kie.createTask.mockRejectedValue(new KieError("network", true));
    const id = await launch();
    await submitJob(id);
    await submitJob(id);
    await advanceUserJobs(uid);
    expect(kie.createTask).toHaveBeenCalledTimes(1);
    expect(await job(id)).toMatchObject({ status: "uncertain" });
    expect(await remaining()).toBe(925);
  });

  it("import failure keeps the reservation and retries later", async () => {
    kie.createTask.mockResolvedValue("task_4");
    kie.getTask.mockResolvedValue({
      state: "success",
      resultUrls: ["https://cdn.example.com/v.mp4"],
      failCode: null,
      creditsConsumed: 124,
    });
    media.importResult
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue({ key: "k", contentType: "video/mp4", size: 1 });
    const id = await launch();
    await submitJob(id);
    await refreshJob(id, true);
    expect(await job(id)).toMatchObject({
      status: "running",
      provider_state: "import_retry",
    });
    await refreshJob(id, true);
    expect(await job(id)).toMatchObject({ status: "succeeded" });
  });

  it("still-generating tasks stay running and polling is throttled", async () => {
    kie.createTask.mockResolvedValue("task_5");
    kie.getTask.mockResolvedValue({
      state: "generating",
      resultUrls: [],
      failCode: null,
      creditsConsumed: null,
    });
    const id = await launch();
    await submitJob(id);
    await refreshJob(id, true);
    await refreshJob(id);
    expect(kie.getTask).toHaveBeenCalledTimes(1);
    expect(await job(id)).toMatchObject({
      status: "running",
      provider_state: "generating",
    });
  });

  it("concurrency limit and provider switch are enforced server-side", async () => {
    kie.createTask.mockResolvedValue("task_6");
    await launch();
    await expect(launch()).rejects.toThrow("déjà en cours");
    process.env.GENERATION_PROVIDER = "disabled";
    await db().query(
      "truncate platform.jobs; update billing.reservations set state='released'",
    );
    await expect(launch()).rejects.toThrow("non activée");
  });

  it("only the owner can schedule a finished video", async () => {
    kie.createTask.mockResolvedValue("task_7");
    kie.getTask.mockResolvedValue({
      state: "success",
      resultUrls: ["https://cdn.example.com/v.mp4"],
      failCode: null,
      creditsConsumed: 124,
    });
    media.importResult.mockResolvedValue({
      key: "k",
      contentType: "video/mp4",
      size: 1,
    });
    const id = await launch();
    await submitJob(id);
    await refreshJob(id, true);
    const { PATCH } = await import("../src/app/api/platform/jobs/[id]/route");
    const auth = await import("../src/lib/auth");
    const spy = vi.spyOn(auth, "requireUser");
    vi.spyOn(auth, "requireOrigin").mockImplementation(() => {});
    const call = (body: object) =>
      PATCH(
        new Request("http://localhost/x", {
          method: "PATCH",
          body: JSON.stringify(body),
        }),
        {
          params: Promise.resolve({ id }),
        },
      );
    spy.mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
    } as never);
    expect(
      (
        await call({
          scheduledAt: "2026-12-01T18:00:00+01:00",
          channel: "tiktok",
        })
      ).status,
    ).toBe(404);
    spy.mockResolvedValue({ id: uid } as never);
    expect(
      (
        await call({
          scheduledAt: "2026-12-01T18:00:00+01:00",
          channel: "tiktok",
          note: "Lancement",
        })
      ).status,
    ).toBe(200);
    expect(await job(id)).toMatchObject({
      schedule_channel: "tiktok",
      schedule_note: "Lancement",
    });
    expect((await call({ scheduledAt: null })).status).toBe(200);
    expect(await job(id)).toMatchObject({
      scheduled_at: null,
      schedule_channel: null,
    });
    expect((await call({ scheduledAt: "pas une date" })).status).toBe(400);
  });

  it("callback for an unknown task does nothing", async () => {
    await onProviderCallback("task_unknown");
    expect(kie.getTask).not.toHaveBeenCalled();
  });
});
