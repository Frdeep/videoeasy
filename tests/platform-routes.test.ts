import { beforeEach, describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  user: vi.fn(),
  query: vi.fn(),
  url: vi.fn(),
}));
vi.mock("../src/lib/auth", () => ({ requireUser: mock.user }));
vi.mock("../src/lib/db", () => ({ db: () => ({ query: mock.query }) }));
vi.mock("../src/lib/media-store", () => ({
  signedUrl: mock.url,
  fileResponse: async (r: Request, key: string, name: string) => {
    const q = new URL(r.url).searchParams;
    if (q.get("format") === "url") return Response.json({ url: await mock.url(key, false), name });
    return Response.redirect(await mock.url(key, q.get("view") !== "1"), 303);
  },
}));
import { GET } from "../src/app/api/platform/jobs/[id]/download/route";
const id = "44444444-4444-4444-8444-444444444444";
beforeEach(() => {
  vi.clearAllMocks();
  mock.user.mockResolvedValue({ id: "owner-fixture" });
});
describe("private downloads", () => {
  it("does not sign a file belonging to another account", async () => {
    mock.query.mockResolvedValue({ rows: [] });
    expect(
      (
        await GET(new Request("http://localhost"), {
          params: Promise.resolve({ id }),
        })
      ).status,
    ).toBe(404);
    expect(mock.query.mock.calls[0][1]).toEqual([id, "owner-fixture"]);
    expect(mock.url).not.toHaveBeenCalled();
  });
  it("rejects malformed ids before querying", async () => {
    expect(
      (
        await GET(new Request("http://localhost"), {
          params: Promise.resolve({ id: "../../other" }),
        })
      ).status,
    ).toBe(400);
    expect(mock.query).not.toHaveBeenCalled();
  });
  it("returns an explicitly labeled synthetic test file", async () => {
    mock.query.mockResolvedValue({ rows: [{ mock_result: true }] });
    const r = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id }),
    });
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("TEST TECHNIQUE SIMULÉ");
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(mock.url).not.toHaveBeenCalled();
  });
  it("uses only the database object key after ownership lookup", async () => {
    mock.query.mockResolvedValue({
      rows: [{ mock_result: false, object_key: "private-owner-key" }],
    });
    mock.url.mockResolvedValue("https://private.example.invalid/signed");
    expect(
      (
        await GET(new Request("http://localhost"), {
          params: Promise.resolve({ id }),
        })
      ).status,
    ).toBe(303);
    expect(mock.url).toHaveBeenCalledWith("private-owner-key", true);
  });
});
