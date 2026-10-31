// Route-handler hardening (no network): status codes, JSON error envelopes, no-store, and streams that survive a client leaving.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const json = (u: string, init?: RequestInit) => new Request(`http://localhost${u}`, init);
const post = (u: string, body: unknown) => json(u, { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/memory/store");
  vi.doUnmock("@/lib/exceptions/store");
  vi.doUnmock("@/lib/workflow/store");
});

describe("live failure helpers", () => {
  it("400 and 502/503 bodies are never cached", async () => {
    const { badRequest, failureResponse } = await import("@/lib/live/server");
    for (const res of [badRequest("nope"), failureResponse({ status: "error", message: "x" }), failureResponse({ status: "not_connected", message: "x" })]) {
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });
});

describe("/api/exceptions", () => {
  it("rejects an unknown status filter with 400 instead of silently listing everything", async () => {
    const route = await import("@/app/api/exceptions/route");
    const res = await route.GET(json("/api/exceptions?status=bogus"));
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await res.json()).status).toBe("error");
  });

  it("POST /:id with an unexpected store failure is a JSON 500, not a bare 500", async () => {
    vi.doMock("@/lib/exceptions/store", async (orig) => ({
      ...(await orig<typeof import("@/lib/exceptions/store")>()),
      loadExceptionStore: async () => ({ resolveException: () => { throw new Error("disk on fire"); } }),
    }));
    const route = await import("@/app/api/exceptions/[id]/route");
    const res = await route.POST(post("/api/exceptions/x", { action: "approve" }), { params: Promise.resolve({ id: "x" }) });
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toMatch(/json/);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(JSON.stringify(body)).not.toContain("disk on fire");
  });
});

describe("/api/sourcing/run input", () => {
  it("POST and GET reject an empty or oversized q with a 400 JSON body (no stream is started)", async () => {
    const route = await import("@/app/api/sourcing/run/route");
    for (const res of [await route.GET(json("/api/sourcing/run")), await route.GET(json("/api/sourcing/run?q=%20")), await route.POST(post("/api/sourcing/run", { q: "" })), await route.POST(post("/api/sourcing/run", { q: "a".repeat(2001) })), await route.POST(post("/api/sourcing/run", "{nope"))]) {
      expect(res.status).toBe(400);
      expect(res.headers.get("content-type")).toMatch(/json/);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });
});

describe("/api/workflow/:id action validation", () => {
  it("catches wrong field types before they surface as an upstream 502", async () => {
    const { invalidAction } = await import("@/lib/workflow/actions");
    expect(invalidAction({ action: "approve", step: "memo" })).toMatch(/step/);
    expect(invalidAction({ action: "approve", step: "dataroom" })).toBeNull();
    expect(invalidAction({ action: "transcript", text: 5 })).toMatch(/text/);
    expect(invalidAction({ action: "transcript", text: "hi", name: 3 })).toMatch(/name/);
    expect(invalidAction({ action: "decide", verdict: "pass", note: {} })).toMatch(/note/);
    expect(invalidAction({ action: "resume" })).toBeNull();
  });

  it("a non-object or action-less body is a 400 (after the 404 check)", async () => {
    vi.doMock("@/lib/workflow/store", () => ({ workflowStore: { get: async (id: string) => (id === "d1" ? { id: "d1", steps: [] } : null), info: () => ({}) } }));
    const route = await import("@/app/api/workflow/[id]/route");
    const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
    expect((await route.POST(post("/api/workflow/zz", { action: "resume" }), ctx("zz"))).status).toBe(404);
    for (const body of [[1], { step: "dataroom" }, { action: 7 }, { action: "approve", step: "x" }]) {
      const res = await route.POST(post("/api/workflow/d1", body), ctx("d1"));
      expect(res.status).toBe(400);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });
});

describe("/api/portfolio", () => {
  it("an unreadable store is a 502 error, not an empty portfolio", async () => {
    vi.doMock("@/lib/workflow/store", () => ({ workflowStore: { list: async () => { throw new Error("db down"); } } }));
    const route = await import("@/app/api/portfolio/route");
    const res = await route.GET();
    expect(res.status).toBe(502);
    expect((await res.json()).status).toBe("error");
  });
});

describe("/api/memory/stream", () => {
  it("a store read that finishes after the client left does not throw or keep polling", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    vi.doMock("@/lib/memory/store", () => ({
      memoryStore: () => ({ status: "ok", storage: {}, store: { list: async () => { calls++; if (calls === 2) await gate; return []; } } }),
    }));
    const route = await import("@/app/api/memory/stream/route");
    vi.useFakeTimers();
    try {
      const ac = new AbortController();
      const res = await route.GET(new Request("http://localhost/api/memory/stream", { signal: ac.signal }));
      expect(res.headers.get("cache-control")).toBe("no-store");
      const reader = res.body!.getReader();
      expect((await reader.read()).done).toBe(false); // keep-alive from the first poll
      await vi.advanceTimersByTimeAsync(2100); // second poll starts and blocks on the gate
      await reader.cancel(); // client leaves mid-read
      release();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(calls).toBe(2); // no further polling after cancel
    } finally {
      vi.useRealTimers();
    }
  });
});
