// Route handlers end to end over a stubbed global fetch (no network): typo'd domains get "did you mean", outages
// map to honest retryable 502s, and the outage drill serves the last good response labelled "cached at … IST".
import { afterEach, describe, expect, it, vi } from "vitest";
import { SIMULATE_OUTAGE_ENV } from "@/lib/resilience/simulate";

vi.mock("server-only", () => ({}));

const company = (id: number, name: string, domain: string, confidence = 1) => ({ confidence_score: confidence, company_data: { crustdata_company_id: id, basic_info: { name, primary_domain: domain, crustdata_company_id: id } } });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "x-credits-used": "0" } });

function fakeCrustdata(opts: { down?: boolean } = {}) {
  const seen: string[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    const body = JSON.parse(String(init?.body ?? "{}")) as { domains?: string[]; names?: string[]; crustdata_company_ids?: number[] };
    seen.push(path);
    if (opts.down) return json({ error: { type: "internal_error", message: "upstream down" } }, 503);
    if (path === "/company/identify") {
      if (body.domains?.[0] === "razorpay.com") return json([{ matched_on: "razorpay.com", match_type: "domain", matches: [company(101, "Razorpay", "razorpay.com")] }]);
      if (body.names?.[0] === "strpe") return json([{ matched_on: "strpe", match_type: "name", matches: [company(201, "Stripe", "stripe.com", 0.7)] }]);
      return json([{ matched_on: body.domains?.[0] ?? body.names?.[0], match_type: "domain", matches: [] }]);
    }
    if (path === "/company/enrich") return json([{ matched_on: "101", match_type: "crustdata_company_id", matches: [{ confidence_score: 1, company_data: { crustdata_company_id: 101, basic_info: { name: "Razorpay", primary_domain: "razorpay.com" }, funding: { total_investment_usd: 741_500_000 } } }] }]);
    return json({ error: "not stubbed" }, 501);
  }) as unknown as typeof fetch;
  return { f, seen };
}

describe("/api/live/company robustness", () => {
  const g = globalThis as unknown as { __dealdeskCrustdata?: unknown; __dealdeskResponseCache?: unknown };
  const saved = { ...process.env };
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of ["CRUSTDATA_API_KEY", "DEALDESK_CACHE_DIR", "DEALDESK_CACHE_TTL_SECONDS", SIMULATE_OUTAGE_ENV]) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    delete g.__dealdeskCrustdata;
    delete g.__dealdeskResponseCache;
  });
  function setup(opts: { down?: boolean; ttlSeconds?: string } = {}) {
    const fake = fakeCrustdata(opts);
    vi.stubGlobal("fetch", fake.f);
    process.env.CRUSTDATA_API_KEY = "test-key";
    delete process.env.DEALDESK_CACHE_DIR;
    if (opts.ttlSeconds) process.env.DEALDESK_CACHE_TTL_SECONDS = opts.ttlSeconds;
    delete g.__dealdeskCrustdata;
    delete g.__dealdeskResponseCache;
    return fake;
  }
  const get = async (qs: string) => {
    const route = await import("@/app/api/live/company/route");
    const res = await route.GET(new Request(`http://localhost/api/live/company?${qs}`));
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };

  it("a typo'd domain is a no_match with did-you-mean suggestions, never auto-picked", async () => {
    setup();
    const r = await get("domain=strpe.com");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "no_match", domain: "strpe.com", suggestions: [{ companyId: 201, name: "Stripe", domain: "stripe.com" }] });
    expect(r.body.message).toBe("No company found for the domain strpe.com. Did you mean Stripe (stripe.com)?");
    expect(r.body).not.toHaveProperty("company");
  });

  it("messy input resolves; garbage is a 400 that says what to send", async () => {
    setup();
    expect((await get(`domain=${encodeURIComponent(" HTTPS://WWW.RAZORPAY.COM/about ")}`)).body).toMatchObject({ status: "ok", company: { id: 101 } });
    for (const bad of ["🚀🚀", "", "x".repeat(300)]) expect((await get(`domain=${encodeURIComponent(bad)}`)).status).toBe(400);
  });

  it("Crustdata 503 (after retries) → 502 with an honest, retryable failure body", async () => {
    const { seen } = setup({ down: true });
    const r = await get("domain=razorpay.com");
    expect(r.status).toBe(502);
    expect(r.body).toMatchObject({ status: "error", upstreamStatus: 503, retryable: true });
    expect(r.body.message).toMatch(/upstream down.*retried before giving up/);
    expect(seen.filter((p) => p === "/company/identify")).toHaveLength(3);
  }, 10_000);

  it("outage drill: serves the last good response labelled cached at IST; uncached companies fail honestly", async () => {
    const { seen } = setup({ ttlSeconds: "0" }); // TTL 0 so the drill has to use the stale path
    const live = await get("domain=razorpay.com");
    expect(live.body).toMatchObject({ status: "ok", company: { id: 101, funding: { totalUsd: 741_500_000 } } });
    const before = seen.length;
    process.env[SIMULATE_OUTAGE_ENV] = "1";
    const drilled = await get("domain=razorpay.com");
    expect(seen.length).toBe(before); // the drill never reaches the network
    expect(drilled.status).toBe(200);
    expect(drilled.body).toMatchObject({ status: "ok", company: live.body.company, identify: { stale: true }, enrich: { stale: true, cached: true } });
    expect(drilled.body.enrich.note).toMatch(/^Crustdata unavailable \((HTTP 503|repeated failures, circuit open)\); showing the response cached at .* IST$/);
    const uncached = await get("domain=strpe.com");
    expect(uncached.status).toBe(502);
    expect(uncached.body.message).toMatch(/Simulated Crustdata outage|unavailable after repeated failures/);
  }, 15_000);
});
