import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST } from "./route";

const KEYS = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "CRUSTDATA_API_KEY"] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/live/screen", { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }));

const lines = async (res: Response) => (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l));

describe("POST /api/live/screen", () => {
  it("returns 503 with a single model_unavailable line when no model key is set", async () => {
    const res = await post({ query: "Indian AI startups founded 2023 or later" });
    expect(res.status).toBe(503);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const events = await lines(res);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "model_unavailable", message: expect.stringContaining("OPENAI_API_KEY") });
  });

  it.each([[{ query: "" }], [{ query: "   " }], [{}], [{ query: 42 }], ["not json"], [{ query: "x".repeat(2001) }]])("returns 400 for invalid body %#", async (body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    const events = await lines(res);
    expect(events).toEqual([{ type: "error", message: expect.stringContaining("non-empty string") }]);
  });

  it("returns 503 with a single error line when a model is configured but Crustdata is not (no network)", async () => {
    process.env.OPENAI_API_KEY = "sk-test-not-real";
    const res = await post({ query: "fintech in Germany" });
    expect(res.status).toBe(503);
    const events = await lines(res);
    expect(events).toEqual([{ type: "error", message: expect.stringContaining("CRUSTDATA_API_KEY") }]);
  });
});
