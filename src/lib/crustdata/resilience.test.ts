// Fault injection for the Crustdata transport: every upstream failure mode degrades to a typed, honest error (or the
// last good cached response, labelled) — never a crash, never invented data, never "no match" for an error.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CircuitBreaker, CircuitOpenError } from "@/lib/resilience/breaker";
import { cacheKey, FileResponseCache, MemoryResponseCache } from "./cache";
import { createCrustdataClient } from "./client";
import {
  backoffDelayMs,
  crustdataFetch,
  CrustdataApiError,
  CrustdataMalformedResponseError,
  CrustdataTransportError,
  isReplayableRequest,
  RateLimiter,
} from "./http";
import { outageReason } from "./stale";

type Step = { status: number; body?: string; headers?: Record<string, string> } | "hang" | "network";

/** fetch that plays `steps` in order (the last step repeats) and counts calls. */
function scripted(steps: Step[]) {
  const calls: { url: string; method: string; body?: string }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body as string | undefined });
    const step = steps[Math.min(calls.length - 1, steps.length - 1)]!;
    if (step === "network") throw new TypeError("fetch failed");
    if (step === "hang") {
      return new Promise<Response>((_, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    }
    return new Response(step.body ?? null, { status: step.status, headers: step.headers });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const ok = (data: unknown, credits = "0") => ({ status: 200, body: JSON.stringify(data), headers: { "X-Credits-Used": credits } });
const err = (status: number, message = "boom") => ({ status, body: JSON.stringify({ error: { type: "internal_error", message } }) });
const IDENTIFY_E2B = [{ matched_on: "e2b.dev", match_type: "domain", matches: [{ confidence_score: 1, company_data: { crustdata_company_id: 42, basic_info: { name: "E2B" } } }] }];

const noSleep = async () => {};
function fetchOnce(f: typeof fetch, opts: Parameters<typeof crustdataFetch>[4] = {}, path = "/company/identify", method = "POST") {
  return crustdataFetch<unknown>("test-key", path, { method, body: JSON.stringify({ domains: ["e2b.dev"] }) }, new RateLimiter(), {
    fetchImpl: f,
    sleep: noSleep,
    ...opts,
  });
}

describe("crustdataFetch fault injection", () => {
  it("retries a 503 and returns the eventual answer", async () => {
    const { f, calls } = scripted([err(503), err(503), ok(IDENTIFY_E2B)]);
    const r = await fetchOnce(f);
    expect(r.data).toEqual(IDENTIFY_E2B);
    expect(calls).toHaveLength(3);
  });

  it.each([500, 502, 503, 504])("retries %i at most twice, then throws CrustdataApiError with that status", async (status) => {
    const { f, calls } = scripted([err(status)]);
    const e = await fetchOnce(f).catch((x) => x);
    expect(e).toBeInstanceOf(CrustdataApiError);
    expect(e.status).toBe(status);
    expect(calls).toHaveLength(3);
  });

  it.each([400, 401, 403, 404, 422])("does not retry %i (an answer, not an outage)", async (status) => {
    const { f, calls } = scripted([err(status, "nope")]);
    const e = await fetchOnce(f).catch((x) => x);
    expect(e).toBeInstanceOf(CrustdataApiError);
    expect(e.status).toBe(status);
    expect(e.message).toContain("nope");
    expect(calls).toHaveLength(1);
  });

  it("honours Retry-After on 429 and gives up (with retryAfterSeconds) when the wait does not fit", async () => {
    const { f, calls } = scripted([{ status: 429, body: "{}", headers: { "Retry-After": "1" } }, ok(IDENTIFY_E2B)]);
    expect((await fetchOnce(f)).data).toEqual(IDENTIFY_E2B);
    expect(calls).toHaveLength(2);

    const slow = scripted([{ status: 429, body: "{}", headers: { "Retry-After": "120" } }]);
    const e = await fetchOnce(slow.f).catch((x) => x);
    expect(e).toBeInstanceOf(CrustdataApiError);
    expect(e.status).toBe(429);
    expect(e.retryAfterSeconds).toBe(120);
    expect(slow.calls).toHaveLength(1);
  });

  it("times out a hung read, retries it, then throws a timeout transport error", async () => {
    const { f, calls } = scripted(["hang"]);
    const e = await fetchOnce(f, { timeoutMs: 20 }).catch((x) => x);
    expect(e).toBeInstanceOf(CrustdataTransportError);
    expect(e.kind).toBe("timeout");
    expect(e.message).toMatch(/timed out after 20 ms/);
    expect(calls).toHaveLength(3);
  });

  it("recovers from a timeout followed by an answer", async () => {
    const { f, calls } = scripted(["hang", ok(IDENTIFY_E2B)]);
    expect((await fetchOnce(f, { timeoutMs: 20 })).data).toEqual(IDENTIFY_E2B);
    expect(calls).toHaveLength(2);
  });

  it("never replays a write that may have reached Crustdata (watch create: timeout or 503)", async () => {
    const hung = scripted(["hang"]);
    await expect(fetchOnce(hung.f, { timeoutMs: 20 }, "/watch/company")).rejects.toBeInstanceOf(CrustdataTransportError);
    expect(hung.calls).toHaveLength(1);
    const down = scripted([err(503)]);
    await expect(fetchOnce(down.f, {}, "/watch/company")).rejects.toBeInstanceOf(CrustdataApiError);
    expect(down.calls).toHaveLength(1);
  });

  it("reconnects a write once when the connection failed before any response", async () => {
    const { f, calls } = scripted(["network"]);
    const e = await fetchOnce(f, {}, "/watch/company").catch((x) => x);
    expect(e).toBeInstanceOf(CrustdataTransportError);
    expect(e.kind).toBe("network");
    expect(calls).toHaveLength(2);
  });

  it("treats a malformed 200 as an error (retried), never as data or as no-match", async () => {
    const { f, calls } = scripted([{ status: 200, body: "<html>Bad gateway</html>" }]);
    const e = await fetchOnce(f).catch((x) => x);
    expect(e).toBeInstanceOf(CrustdataMalformedResponseError);
    expect(e.message).toContain("not valid JSON");
    expect(e.message).toContain("<html>Bad gateway");
    expect(calls).toHaveLength(3);
    const truncated = scripted([{ status: 200, body: '[{"matches": [' }, ok(IDENTIFY_E2B)]);
    expect((await fetchOnce(truncated.f)).data).toEqual(IDENTIFY_E2B);
  });

  it("rejects an empty 200 body on a read, accepts an empty 204 on DELETE", async () => {
    await expect(fetchOnce(scripted([{ status: 200, body: "" }]).f)).rejects.toThrow(/empty body/);
    const del = await fetchOnce(scripted([{ status: 204 }]).f, {}, "/watch/company/7", "DELETE");
    expect(del.data).toBeNull();
  });

  it("stops retrying when the total deadline is spent", async () => {
    const { f, calls } = scripted(["hang"]);
    const t0 = Date.now();
    await expect(fetchOnce(f, { timeoutMs: 1_000, deadlineMs: 60 })).rejects.toBeInstanceOf(CrustdataTransportError);
    expect(Date.now() - t0).toBeLessThan(900);
    expect(calls).toHaveLength(1);
  });

  it("opens the circuit after repeated outages and then fails fast without calling Crustdata", async () => {
    const breaker = new CircuitBreaker(2, 60_000);
    const { f, calls } = scripted([err(503)]);
    await expect(fetchOnce(f, { breaker, transientRetries: 0 })).rejects.toBeInstanceOf(CrustdataApiError);
    await expect(fetchOnce(f, { breaker, transientRetries: 0 })).rejects.toBeInstanceOf(CrustdataApiError);
    const n = calls.length;
    const e = await fetchOnce(f, { breaker }).catch((x) => x);
    expect(e).toBeInstanceOf(CircuitOpenError);
    expect(calls).toHaveLength(n);
    // other routes are unaffected
    await expect(fetchOnce(scripted([ok({ profiles: [] })]).f, { breaker }, "/person/search")).resolves.toBeTruthy();
  });

  it("half-opens after the cooldown and closes on success", async () => {
    let now = 0;
    const breaker = new CircuitBreaker(1, 1_000, () => now);
    await expect(fetchOnce(scripted([err(502)]).f, { breaker, transientRetries: 0 })).rejects.toBeInstanceOf(CrustdataApiError);
    await expect(fetchOnce(scripted([ok(IDENTIFY_E2B)]).f, { breaker })).rejects.toBeInstanceOf(CircuitOpenError);
    now = 2_000;
    await expect(fetchOnce(scripted([ok(IDENTIFY_E2B)]).f, { breaker })).resolves.toBeTruthy();
    expect(breaker.status("Crustdata /company/identify")).toBe("closed");
  });

  it("4xx answers do not trip the breaker", async () => {
    const breaker = new CircuitBreaker(1, 60_000);
    await expect(fetchOnce(scripted([err(404)]).f, { breaker })).rejects.toBeInstanceOf(CrustdataApiError);
    await expect(fetchOnce(scripted([ok(IDENTIFY_E2B)]).f, { breaker })).resolves.toBeTruthy();
  });

  it("classifies replayable endpoints and bounds the backoff", () => {
    expect(isReplayableRequest("POST", "/company/identify")).toBe(true);
    expect(isReplayableRequest("POST", "/web/search/live")).toBe(true);
    expect(isReplayableRequest("GET", "/watch/company/7/runs")).toBe(true);
    expect(isReplayableRequest("POST", "/watch/company")).toBe(false);
    expect(isReplayableRequest("DELETE", "/watch/company/7")).toBe(false);
    for (let i = 1; i < 10; i++) expect(backoffDelayMs(i, 400, 4_000, () => 0.999)).toBeLessThan(4_000);
    expect(backoffDelayMs(1, 400, 4_000, () => 0)).toBe(0);
  });
});

describe("stale-cache fallback (CrustdataClient)", () => {
  const body = { domains: ["e2b.dev"] };
  const seed = (cache: MemoryResponseCache, storedAt: number) =>
    cache.set(cacheKey("POST", "/company/identify", body), { data: IDENTIFY_E2B, creditsUsed: "0", requestId: "r1", latencyMs: 120, storedAt });

  it("serves the last good response, labelled with its IST fetch time, when Crustdata is down", async () => {
    const cache = new MemoryResponseCache(0); // TTL 0: every entry is expired, so only the stale path can serve it
    const storedAt = Date.parse("2026-10-31T07:30:00Z");
    await seed(cache, storedAt);
    const { f, calls } = scripted([err(503)]);
    const client = createCrustdataClient({ apiKey: "test-key", fetchImpl: f, cache, sleep: noSleep });
    const r = await client.identifyCompany(body);
    expect(calls.length).toBeGreaterThan(0); // tried live first
    expect(r.data).toEqual(IDENTIFY_E2B);
    expect(r.meta).toMatchObject({ cached: true, stale: true, retrievedAt: "2026-10-31T07:30:00.000Z" });
    expect(r.meta.staleNote).toBe("Crustdata unavailable (HTTP 503); showing the response cached at 31 Oct 2026, 13:00 IST");
  });

  it.each([
    ["network", "connection failed"],
    [{ status: 200, body: "not json" }, "malformed response"],
  ] as const)("falls back on %o", async (step, reason) => {
    const cache = new MemoryResponseCache(0);
    await seed(cache, Date.now() - 60_000);
    const client = createCrustdataClient({ apiKey: "test-key", fetchImpl: scripted([step as Step]).f, cache, sleep: noSleep });
    const r = await client.identifyCompany(body);
    expect(r.meta.stale).toBe(true);
    expect(r.meta.staleNote).toContain(reason);
  });

  it("does not hide answers: 401/400 propagate even with a cached copy", async () => {
    for (const status of [400, 401, 403]) {
      const cache = new MemoryResponseCache(0);
      await seed(cache, Date.now() - 1_000);
      const client = createCrustdataClient({ apiKey: "test-key", fetchImpl: scripted([err(status)]).f, cache, sleep: noSleep });
      await expect(client.identifyCompany(body)).rejects.toMatchObject({ status });
    }
  });

  it("throws the upstream error when there is nothing cached", async () => {
    const client = createCrustdataClient({ apiKey: "test-key", fetchImpl: scripted([err(503)]).f, cache: new MemoryResponseCache(60_000), sleep: noSleep });
    await expect(client.identifyCompany(body)).rejects.toMatchObject({ status: 503 });
  });

  it("serves the stale copy instantly while the circuit is open", async () => {
    const cache = new MemoryResponseCache(0);
    await seed(cache, Date.now() - 1_000);
    const { f, calls } = scripted([err(503)]);
    const client = createCrustdataClient({ apiKey: "test-key", fetchImpl: f, cache, sleep: noSleep, breaker: new CircuitBreaker(1, 60_000) });
    await client.identifyCompany(body);
    const n = calls.length;
    const r = await client.identifyCompany(body);
    expect(calls).toHaveLength(n);
    expect(r.meta.staleNote).toContain("circuit open");
  });

  it("never serves entries past the stale window", async () => {
    const cache = new MemoryResponseCache(0, 1_000);
    await seed(cache, Date.now() - 5_000);
    const client = createCrustdataClient({ apiKey: "test-key", fetchImpl: scripted([err(503)]).f, cache, sleep: noSleep });
    await expect(client.identifyCompany(body)).rejects.toMatchObject({ status: 503 });
  });

  it("a corrupt file-cache entry is a miss, not a crash", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dd-cache-"));
    try {
      const cache = new FileResponseCache(dir, 60_000);
      const key = cacheKey("POST", "/company/identify", body);
      fs.writeFileSync(path.join(dir, `${key}.json`), '{"data": [trunc');
      expect(await cache.get(key)).toBeUndefined();
      expect(await cache.getStale(key)).toBeUndefined();
      const client = createCrustdataClient({ apiKey: "test-key", fetchImpl: scripted([ok(IDENTIFY_E2B)]).f, cache, sleep: noSleep });
      expect((await client.identifyCompany(body)).meta.cached).toBe(false);
      expect((await cache.get(key))?.data).toEqual(IDENTIFY_E2B);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("outageReason only names outages", () => {
    expect(outageReason(new CrustdataApiError(503, {}))).toBe("HTTP 503");
    expect(outageReason(new CrustdataApiError(429, {}, 5))).toBe("rate limited");
    expect(outageReason(new CrustdataApiError(404, {}))).toBeNull();
    expect(outageReason(new Error("bug"))).toBeNull();
  });
});

describe("request-scoped deadline", () => {
  it("bounds every call made inside withDeadline, then serves stale or fails honestly", async () => {
    const { withDeadline, remainingMs } = await import("@/lib/resilience/deadline");
    expect(remainingMs()).toBeUndefined();
    const { f, calls } = scripted(["hang"]);
    const client = createCrustdataClient({ apiKey: "test-key", fetchImpl: f, sleep: noSleep });
    const t0 = Date.now();
    const e = await withDeadline(60, () => client.identifyCompany({ domains: ["e2b.dev"] })).catch((x) => x);
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(e).toBeInstanceOf(CrustdataTransportError);
    expect(calls).toHaveLength(1); // no retry fits in the remaining budget

    const cache = new MemoryResponseCache(0);
    await cache.set(cacheKey("POST", "/company/identify", { domains: ["e2b.dev"] }), { data: IDENTIFY_E2B, creditsUsed: "0", requestId: null, latencyMs: 1, storedAt: Date.now() - 1_000 });
    const cachedClient = createCrustdataClient({ apiKey: "test-key", fetchImpl: scripted(["hang"]).f, cache, sleep: noSleep });
    const r = await withDeadline(60, () => cachedClient.identifyCompany({ domains: ["e2b.dev"] }));
    expect(r.meta.staleNote).toMatch(/timed out.*cached at .* IST$/);
  });

  it("nested deadlines only shrink", async () => {
    const { withDeadline, remainingMs } = await import("@/lib/resilience/deadline");
    await withDeadline(100, () => withDeadline(10_000, async () => expect(remainingMs()!).toBeLessThanOrEqual(100)));
  });
});

describe("breaker trial slot", () => {
  it("is released when the deadline runs out before the trial reaches Crustdata", async () => {
    let now = 0;
    const breaker = new CircuitBreaker(1, 1_000, () => now);
    await expect(fetchOnce(scripted([err(503)]).f, { breaker, transientRetries: 0 })).rejects.toBeInstanceOf(CrustdataApiError);
    now = 5_000; // cooldown over: the next caller is the half-open trial
    await expect(fetchOnce(scripted([ok(IDENTIFY_E2B)]).f, { breaker, deadlineMs: 0 })).rejects.toBeInstanceOf(CrustdataTransportError);
    await expect(fetchOnce(scripted([ok(IDENTIFY_E2B)]).f, { breaker })).resolves.toBeTruthy();
  });
});
