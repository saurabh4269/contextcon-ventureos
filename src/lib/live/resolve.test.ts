import { afterEach, describe, expect, it, vi } from "vitest";
import { createCrustdataClient } from "@/lib/crustdata";
import { failureFrom } from "./failure";
import { normalizeDomainInput } from "./normalize";
import { parseCompanyRef, resolveCompany } from "./resolve";

vi.mock("server-only", () => ({}));

// Hand-written /company/identify payloads (shape of api 2025-11-01: top-level array, one row per identifier).
const company = (id: number, name: string, domain: string, confidence = 1) => ({ confidence_score: confidence, company_data: { crustdata_company_id: id, basic_info: { name, primary_domain: domain, crustdata_company_id: id } } });
const BY_DOMAIN: Record<string, unknown[]> = {
  "razorpay.com": [company(101, "Razorpay", "razorpay.com")],
};
const BY_NAME: Record<string, unknown[]> = {
  strpe: [company(201, "Stripe", "stripe.com", 0.7), company(202, "Strype", "strype.io", 0.6)],
  razorpay: [company(101, "Razorpay", "razorpay.com"), company(102, "Razorpay Capital", "capital.razorpay.com", 0.8)],
  mercury: [company(301, "Mercury", "mercury.com"), company(302, "Mercury", "mercury.co.uk", 0.9), company(303, "Mercury Systems", "mrcy.com", 0.8)],
  "株式会社メルカリ": [company(401, "株式会社メルカリ", "mercari.com")],
};

type Seen = { path: string; body: Record<string, unknown> };
const json = (data: unknown, status = 200, credits = "0") => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "x-credits-used": credits } });

/** Fake Crustdata transport: identify from the fixtures above; job search / web search with one canned row each. */
function fakeFetch(opts: { status?: number } = {}) {
  const seen: Seen[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    seen.push({ path, body });
    if (opts.status) return json({ error: { type: "internal", message: "boom" } }, opts.status);
    if (path.endsWith("/job/search")) return json({ job_listings: [{ job_details: { title: "Engineer", category: "Engineering" } }], total_count: 1 }, 200, "0.03");
    if (path.endsWith("/web/search/live")) return json({ query: body.query, results: [{ title: "Razorpay raises", url: "https://example.com" }, { title: "Unrelated" }] }, 200, "1");
    if (!path.endsWith("/company/identify")) return json({ error: "unexpected path" }, 404);
    const domains = (body.domains as string[] | undefined) ?? [];
    const names = (body.names as string[] | undefined) ?? [];
    return json([
      ...domains.map((d) => ({ matched_on: d, match_type: "domain", matches: BY_DOMAIN[d] ?? [] })),
      ...names.map((n) => ({ matched_on: n, match_type: "name", matches: BY_NAME[n.toLowerCase()] ?? [] })),
    ]);
  }) as typeof fetch;
  return { fetchImpl, seen };
}

function fakeCrustdata(opts: { status?: number } = {}) {
  const { fetchImpl, seen } = fakeFetch(opts);
  return { client: createCrustdataClient({ apiKey: "test-key", fetchImpl }), seen };
}

const parse = (params: Record<string, string>) => parseCompanyRef(new URLSearchParams(params));

describe("parseCompanyRef (messy input)", () => {
  it.each(["RAZORPAY.COM ", "https://www.razorpay.com/about", "razorpay.com.", "razor​pay.com​", "﻿http://Razorpay.com/?ref=x", "razorpay.com/"])("%j → razorpay.com", (raw) => {
    expect(parse({ company: raw })).toEqual({ ok: true, ref: { kind: "domain", domain: "razorpay.com", raw: expect.any(String) } });
    expect(parse({ domain: raw })).toMatchObject({ ok: true, ref: { domain: "razorpay.com" } });
  });

  it.each([
    ["strpe..com", "strpe.com"],
    ["stripe,com", "stripe.com"],
    ["stripe .com", "stripe.com"],
    ["stripe.com..", "stripe.com"],
  ])("rejects the broken domain %j with a suggestion (never auto-corrected)", (raw, suggestion) => {
    const r = parse({ company: raw });
    expect(r).toMatchObject({ ok: false, suggestion });
    if (!r.ok) expect(r.message).toContain(suggestion);
  });

  it("rejects emoji/punctuation-only, empty and over-long input", () => {
    expect(parse({ company: "🚀🔥" })).toMatchObject({ ok: false });
    expect(parse({ company: "...,,," })).toMatchObject({ ok: false });
    expect(parse({ company: " ​ " })).toMatchObject({ ok: false });
    expect(parse({})).toMatchObject({ ok: false });
    const long = parse({ company: "a".repeat(201) });
    expect(long).toMatchObject({ ok: false });
    if (!long.ok) expect(long.message).toMatch(/too long.*200/);
    expect(parse({ company: "a".repeat(200) })).toMatchObject({ ok: true, ref: { kind: "name" } });
  });

  it("treats non-domain strings, including non-English names, as names", () => {
    expect(parse({ company: "रेज़रपे" })).toEqual({ ok: true, ref: { kind: "name", name: "रेज़रपे" } });
    expect(parse({ company: "  株式会社メルカリ " })).toEqual({ ok: true, ref: { kind: "name", name: "株式会社メルカリ" } });
    expect(parse({ company: "Stripe, Inc." })).toEqual({ ok: true, ref: { kind: "name", name: "Stripe, Inc." } });
    // an explicit domain= that is not a domain is a 400, not a name lookup
    expect(parse({ domain: "Stripe" })).toMatchObject({ ok: false });
  });

  it("converts internationalised domains to punycode", () => {
    expect(parse({ company: "https://www.Bücher.de/kontakt" })).toMatchObject({ ok: true, ref: { kind: "domain", domain: "xn--bcher-kva.de" } });
    expect(normalizeDomainInput("bücher.de")).toBe("xn--bcher-kva.de");
    expect(normalizeDomainInput("ｓｔｒｉｐｅ．ｃｏｍ")).toBe("stripe.com");
    expect(normalizeDomainInput("株式会社メルカリ")).toBeUndefined();
  });

  it("keeps companyId behaviour unchanged (and it wins over domain/company)", () => {
    expect(parse({ companyId: "1083252", domain: "e2b.dev" })).toEqual({ ok: true, ref: { kind: "id", id: 1083252 } });
    expect(parse({ companyId: "abc" })).toEqual({ ok: false, message: "companyId must be a positive integer (crustdata_company_id)" });
    expect(parse({ companyId: "0" })).toMatchObject({ ok: false });
  });
});

describe("resolveCompany", () => {
  it("id → ok without any call", async () => {
    const { client, seen } = fakeCrustdata();
    expect(await resolveCompany(client, { kind: "id", id: 7 })).toEqual({ status: "ok", companyId: 7, via: "id" });
    expect(seen).toHaveLength(0);
  });

  it("domain match → ok with companyId and an identify LiveCall", async () => {
    const { client, seen } = fakeCrustdata();
    const r = await resolveCompany(client, { kind: "domain", domain: "razorpay.com", raw: "RAZORPAY.COM" });
    expect(r).toMatchObject({ status: "ok", companyId: 101, name: "Razorpay", domain: "razorpay.com", via: "domain" });
    expect(r.status === "ok" && r.identify).toMatchObject({ id: "identify", path: "/company/identify", body: { domains: ["razorpay.com"] }, status: "ok", creditsUsed: "0", data: { id: 101 } });
    expect(seen).toHaveLength(1);
  });

  it("unknown domain → no_match with did-you-mean suggestions from the first label (never auto-picked)", async () => {
    const { client, seen } = fakeCrustdata();
    const r = await resolveCompany(client, { kind: "domain", domain: "strpe.com", raw: "strpe.com" });
    expect(r.status).toBe("no_match");
    if (r.status !== "no_match") return;
    expect(r.suggestions.map((s) => s.companyId)).toEqual([201, 202]);
    expect(r.suggestions[0]).toEqual({ companyId: 201, name: "Stripe", domain: "stripe.com", confidence: 0.7 });
    expect(r.message).toMatch(/strpe\.com.*Did you mean Stripe \(stripe\.com\)/);
    expect(r.calls.identify.status).toBe("no_match");
    expect(r.calls.suggest).toMatchObject({ status: "ok", body: { names: ["strpe"], exact_match: false } });
    expect(seen.map((s) => s.body)).toEqual([{ domains: ["strpe.com"] }, { names: ["strpe"], exact_match: false }]);
  });

  it("unknown domain with no name candidates → no_match without suggestions", async () => {
    const { client } = fakeCrustdata();
    const r = await resolveCompany(client, { kind: "domain", domain: "zz9-no-such-startup.com", raw: "zz9-no-such-startup.com" });
    expect(r).toMatchObject({ status: "no_match", suggestions: [], calls: { suggest: { status: "no_match" } } });
    if (r.status === "no_match") expect(r.message).not.toMatch(/Did you mean/);
  });

  it("name with exactly one exact (normalised) match → ok", async () => {
    const { client } = fakeCrustdata();
    expect(await resolveCompany(client, { kind: "name", name: "RAZORPAY" })).toMatchObject({ status: "ok", companyId: 101, via: "name" });
    expect(await resolveCompany(client, { kind: "name", name: "株式会社メルカリ" })).toMatchObject({ status: "ok", companyId: 401, domain: "mercari.com" });
  });

  it("name with several exact candidates → ambiguous, never auto-picked", async () => {
    const { client } = fakeCrustdata();
    const r = await resolveCompany(client, { kind: "name", name: "Mercury" });
    expect(r.status).toBe("ambiguous");
    if (r.status !== "ambiguous") return;
    expect(r.suggestions.map((s) => s.companyId)).toEqual([301, 302]);
    expect(r).not.toHaveProperty("companyId");
  });

  it("name with only fuzzy candidates → no_match with suggestions; unknown name → no_match", async () => {
    const { client } = fakeCrustdata();
    expect(await resolveCompany(client, { kind: "name", name: "strpe" })).toMatchObject({ status: "no_match", suggestions: [{ companyId: 201 }, { companyId: 202 }] });
    expect(await resolveCompany(client, { kind: "name", name: "Nobody Corp" })).toMatchObject({ status: "no_match", suggestions: [] });
  });

  it("a Crustdata 500 on identify throws (it is never reported as no_match)", async () => {
    const { client } = fakeCrustdata({ status: 500 });
    let caught: unknown;
    try {
      await resolveCompany(client, { kind: "domain", domain: "razorpay.com", raw: "razorpay.com" });
    } catch (e) {
      caught = e;
    }
    expect(failureFrom(caught)).toMatchObject({ status: "error", upstreamStatus: 500 });
    await expect(resolveCompany(client, { kind: "name", name: "Razorpay" })).rejects.toThrow();
  });
});

// Route handlers end to end over the same fake transport (global fetch stubbed; no network).
describe("/api/live routes accept a domain or name", () => {
  // server.ts caches the client (and cache.ts the response cache) on globalThis: reset both around each test
  const g = globalThis as unknown as { __dealdeskCrustdata?: unknown; __dealdeskResponseCache?: unknown };
  const prev = { key: process.env.CRUSTDATA_API_KEY, cacheDir: process.env.DEALDESK_CACHE_DIR };
  const restore = (name: "CRUSTDATA_API_KEY" | "DEALDESK_CACHE_DIR", v: string | undefined) => (v === undefined ? delete process.env[name] : (process.env[name] = v));
  afterEach(() => {
    vi.unstubAllGlobals();
    restore("CRUSTDATA_API_KEY", prev.key);
    restore("DEALDESK_CACHE_DIR", prev.cacheDir);
    delete g.__dealdeskCrustdata;
    delete g.__dealdeskResponseCache;
  });

  function stub() {
    const { fetchImpl, seen } = fakeFetch();
    vi.stubGlobal("fetch", fetchImpl);
    process.env.CRUSTDATA_API_KEY = "test-key";
    delete process.env.DEALDESK_CACHE_DIR; // in-memory response cache only
    delete g.__dealdeskCrustdata;
    delete g.__dealdeskResponseCache;
    return seen;
  }
  const get = async (route: { GET: (r: Request) => Promise<Response> }, qs: string) => {
    const res = await route.GET(new Request(`http://localhost/api/live/x?${qs}`));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  it("jobs: companyId unchanged; domain resolves and adds `resolved`; unknown domain → 200 no_match", async () => {
    const seen = stub();
    const jobs = await import("@/app/api/live/jobs/route");
    const byId = await get(jobs, "companyId=999");
    expect(byId.status).toBe(200);
    expect(byId.body).toMatchObject({ id: "jobs", status: "ok", data: { total: 1 } });
    expect(byId.body).not.toHaveProperty("resolved");
    const byDomain = await get(jobs, `company=${encodeURIComponent("https://www.RAZORPAY.com/about")}`);
    expect(byDomain.body).toMatchObject({ id: "jobs", status: "ok", resolved: { companyId: 101, name: "Razorpay", via: "domain", identify: { status: "ok" } } });
    expect(seen.filter((s) => s.path.endsWith("/job/search"))).toHaveLength(2);
    const unknown = await get(jobs, "domain=strpe.com");
    expect(unknown).toMatchObject({ status: 200, body: { status: "no_match", input: "strpe.com", suggestions: [{ companyId: 201 }, { companyId: 202 }] } });
    expect(seen.filter((s) => s.path.endsWith("/job/search"))).toHaveLength(2); // nothing billed for an unresolved company
  });

  it("400 carries the suggestion for a broken domain", async () => {
    stub();
    const people = await import("@/app/api/live/people/route");
    expect(await get(people, "domain=strpe..com")).toMatchObject({ status: 400, body: { status: "error", suggestion: "strpe.com" } });
    expect(await get(people, "companyId=abc")).toEqual({ status: 400, body: { status: "error", message: "companyId must be a positive integer (crustdata_company_id)" } });
  });

  it("comps: companyId without q keeps the 400, now pointing at domain=", async () => {
    stub();
    const comps = await import("@/app/api/live/comps/route");
    const r = await get(comps, "companyId=101");
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/q \(what the company does\) is required, or pass domain=/);
    expect(await get(comps, "domain=strpe.com")).toMatchObject({ status: 200, body: { status: "no_match" } });
  });

  it("news: q unchanged; a name is searched directly; a domain is resolved to its name", async () => {
    const seen = stub();
    const news = await import("@/app/api/live/news/route");
    expect((await get(news, "q=Razorpay&mention=Razorpay")).body).toMatchObject({ id: "news", status: "ok" });
    expect(seen.at(-1)?.body).toMatchObject({ query: "Razorpay" });
    await get(news, `company=${encodeURIComponent("रेज़रपे")}`);
    expect(seen.at(-1)?.body).toMatchObject({ query: '"रेज़रपे"' });
    expect(seen.some((s) => s.path.endsWith("/company/identify"))).toBe(false);
    const byDomain = await get(news, "domain=razorpay.com");
    expect(seen.at(-1)?.body).toMatchObject({ query: '"Razorpay"' });
    expect(byDomain.body).toMatchObject({ status: "ok", data: { results: [{ title: "Razorpay raises" }] }, resolved: { companyId: 101 } });
    expect((await get(news, "")).status).toBe(400);
  });
});
