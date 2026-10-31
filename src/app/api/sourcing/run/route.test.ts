import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const runAgent = vi.fn();
vi.mock("@/lib/sourcing/run", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sourcing/run")>();
  return { ...actual, runAgent: (...args: unknown[]) => runAgent(...args) };
});
vi.mock("@/lib/live/server", () => ({
  liveCrustdataClient: () => ({}),
  NotConnectedError: class NotConnectedError extends Error {},
}));
vi.mock("@/lib/memory/store", () => ({
  recordMemory: vi.fn(async () => ({ status: "ok" as const, id: "mem_test" })),
}));

import type { RunSummary } from "@/lib/sourcing/run";
import { POST } from "./route";

const summary = (): RunSummary => ({
  runId: "run_route_test",
  request: "seed climate tech in germny",
  sentence: "1 company.",
  requested: 10,
  returned: 1,
  dropped: 0,
  relaxed: [],
  rankingReason: "ranked by growth",
  credits: 12,
  liveCalls: 3,
  cachedCalls: 0,
  failedCalls: 0,
  startedAt: "2026-10-31T08:00:00Z",
  finishedAt: "2026-10-31T08:00:05Z",
  ms: 5000,
  rowOrder: [1],
});

beforeEach(() => {
  process.env.EXCEPTIONS_FILE = "/tmp/dealdesk-exceptions-route-test.json";
  runAgent.mockReset();
  runAgent.mockImplementation(async (_q, opts) => {
    const s = summary();
    opts.emit({ type: "done", summary: s });
    return s;
  });
});
afterEach(() => {
  delete process.env.EXCEPTIONS_FILE;
});

const lines = async (res: Response) => (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l));

describe("POST /api/sourcing/run", () => {
  it("returns 400 when q is missing or not a string", async () => {
    const res = await POST(new Request("http://localhost/api/sourcing/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ message: expect.stringContaining("q (string)") });
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await POST(new Request("http://localhost/api/sourcing/run", { method: "POST", headers: { "content-type": "application/json" }, body: "not-json" }));
    expect(res.status).toBe(400);
  });

  it("after a finished run, streams review routing and memory steps (workflow orchestration)", async () => {
    const res = await POST(new Request("http://localhost/api/sourcing/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: "seed climate tech in germny" }) }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const events = await lines(res);
    expect(events.some((e) => e.type === "done")).toBe(true);
    const review = events.filter((e) => e.type === "step" && e.step?.id === "review");
    expect(review.length).toBe(1);
    expect(review[0]).toMatchObject({ type: "step", step: { id: "review", status: "done", endpoint: expect.stringMatching(/^\/review\?run=/) } });
    const memory = events.filter((e) => e.type === "step" && e.step?.id === "memory");
    expect(memory[0]).toMatchObject({ type: "step", step: { id: "memory", status: "done", detail: "recorded as agent.run" } });
  });
});
