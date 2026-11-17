import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { parseTask } from "../src/lib/kie";
import { assertSafeUrl, sniff } from "../src/lib/media-store";

describe("Kie task parsing", () => {
  it("reads result URLs from the resultJson string", () => {
    const t = parseTask({
      state: "success",
      resultJson: '{"resultUrls":["https://tempfile.example.com/v.mp4"]}',
      creditsConsumed: 124,
    });
    expect(t).toMatchObject({
      state: "success",
      resultUrls: ["https://tempfile.example.com/v.mp4"],
      creditsConsumed: 124,
    });
  });
  it("keeps failure codes and ignores results on failure", () => {
    expect(
      parseTask({ state: "fail", failCode: "500", resultJson: "" }),
    ).toMatchObject({ state: "fail", failCode: "500", resultUrls: [] });
  });
  it("rejects unknown states", () => {
    expect(() => parseTask({ state: "done" })).toThrow();
    expect(() => parseTask(null)).toThrow();
  });
  it("tolerates malformed resultJson", () => {
    expect(
      parseTask({ state: "success", resultJson: "{oops" }).resultUrls,
    ).toEqual([]);
  });
});

describe("result URL safety (SSRF)", () => {
  it("accepts public https hosts", () => {
    expect(
      assertSafeUrl("https://tempfile.aiquickdraw.com/a/b.mp4").hostname,
    ).toBe("tempfile.aiquickdraw.com");
  });
  it.each([
    "http://cdn.example.com/x.mp4",
    "https://127.0.0.1/x.mp4",
    "https://169.254.169.254/latest",
    "https://[::1]/x",
    "https://localhost/x",
    "https://user:pw@cdn.example.com/x",
    "https://cdn.example.com:8443/x",
    "https://metadata.internal/x",
    "file:///etc/passwd",
    "not a url",
  ])("rejects %s", (u) => {
    expect(() => assertSafeUrl(u)).toThrow();
  });
});

describe("file signature sniffing", () => {
  const bytes = (...parts: (string | number[])[]) =>
    new Uint8Array(
      parts.flatMap((p) =>
        typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p,
      ),
    );
  it("detects mp4 and quicktime", () => {
    expect(sniff(bytes([0, 0, 0, 24], "ftypisom", [0, 0]))).toBe("video/mp4");
    expect(sniff(bytes([0, 0, 0, 20], "ftypqt  "))).toBe("video/quicktime");
  });
  it("detects images", () => {
    expect(sniff(bytes([0x89], "PNG", [13, 10, 26, 10]))).toBe("image/png");
    expect(sniff(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  });
  it("refuses html disguised as video", () => {
    expect(sniff(bytes("<!doctype html><html>"))).toBeNull();
  });
});
