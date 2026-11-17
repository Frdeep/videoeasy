import "server-only";
import { env } from "./config";

// Kie.ai Market API (docs.kie.ai, read 17/11/2026):
// - POST /api/v1/jobs/createTask {model, input, callBackUrl} -> {code:200, data:{taskId}}
// - GET  /api/v1/jobs/recordInfo?taskId= -> {code:200, data:{state, resultJson, failCode, failMsg, creditsConsumed}}
// Errors are reported with HTTP 200 and a non-200 `code` in the body.
// No idempotency key is documented: a submit timeout is an UNCERTAIN state.
const BASE = "https://api.kie.ai/api/v1";

export class KieError extends Error {
  constructor(
    public code: string,
    /** true when the request may have been accepted by Kie (timeout, 5xx, network). */
    public uncertain: boolean,
  ) {
    super(`kie_${code}`);
  }
}

async function call(path: string, init: RequestInit, timeoutMs: number) {
  let response: Response;
  try {
    response = await fetch(BASE + path, {
      ...init,
      headers: {
        Authorization: `Bearer ${env("KIE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch {
    throw new KieError("network", true);
  }
  if (response.status >= 500)
    throw new KieError(`http_${response.status}`, true);
  let body: { code?: number; msg?: string; data?: unknown };
  try {
    body = await response.json();
  } catch {
    throw new KieError(`http_${response.status}`, response.status >= 500);
  }
  if (body.code !== 200)
    throw new KieError(
      String(body.code ?? response.status),
      (body.code ?? 0) >= 500,
    );
  return body.data;
}

export async function createTask(
  model: string,
  input: Record<string, unknown>,
  callBackUrl: string,
) {
  const data = (await call(
    "/jobs/createTask",
    { method: "POST", body: JSON.stringify({ model, input, callBackUrl }) },
    20000,
  )) as { taskId?: unknown } | null;
  if (typeof data?.taskId !== "string" || !data.taskId)
    throw new KieError("no_task_id", true);
  return data.taskId;
}

export type KieTask = {
  state: "waiting" | "queuing" | "generating" | "success" | "fail";
  resultUrls: string[];
  failCode: string | null;
  creditsConsumed: number | null;
};

export function parseTask(data: unknown): KieTask {
  const d = (data ?? {}) as Record<string, unknown>;
  const state = d.state;
  if (
    state !== "waiting" &&
    state !== "queuing" &&
    state !== "generating" &&
    state !== "success" &&
    state !== "fail"
  )
    throw new KieError("bad_state", false);
  let resultUrls: string[] = [];
  if (state === "success") {
    let result: unknown = d.resultJson;
    if (typeof result === "string" && result) {
      try {
        result = JSON.parse(result);
      } catch {
        result = null;
      }
    }
    const urls = (result as { resultUrls?: unknown } | null)?.resultUrls;
    if (Array.isArray(urls))
      resultUrls = urls.filter((u): u is string => typeof u === "string");
  }
  const credits = Number(d.creditsConsumed);
  return {
    state,
    resultUrls,
    failCode: typeof d.failCode === "string" && d.failCode ? d.failCode : null,
    creditsConsumed: Number.isFinite(credits) ? credits : null,
  };
}

export async function getTask(taskId: string) {
  return parseTask(
    await call(
      `/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      { method: "GET" },
      15000,
    ),
  );
}

export async function getCredits() {
  return Number(await call("/chat/credit", { method: "GET" }, 10000));
}
