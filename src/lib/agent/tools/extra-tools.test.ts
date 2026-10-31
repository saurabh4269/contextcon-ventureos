// Extra agent tools against mocked Crustdata HTTP (real client + HTTP handling, injected fetch) and the checked-in
// captures in docs/crustdata/fixtures: request bodies, projections that keep citation paths valid, messy/empty/missing
// data, and 4xx/5xx/429/timeout/transport failures surfaced through runTool.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCrustdataClient } from "@/lib/crustdata";
import { fixtureClient, loadFixture } from "@/test/crustdata";
import { resolvePath } from "../cite";
import { runTool, toolRegistry, type ToolContext } from "../tools";
import { EXTRA_TOOLS, companySignals, findFounders, identifyCompany, searchJobs, webSearch } from "./index";
import { toUnixSeconds } from "./web-search";

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> } | (() => Promise<Response>);
type Sent = { path: string; body: Record<string, unknown> };

/** Client whose fetch answers with `replies` in order (last one repeats) and records every request. */
function mockClient(replies: Reply[], sent: Sent[] = []) {
  let i = 0;
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ path: String(url).replace(/^https:\/\/api\.crustdata\.com/, ""), body: init?.body ? JSON.parse(String(init.body)) : {} });
    const r = replies[Math.min(i++, replies.length - 1)]!;
    if (typeof r === "function") return r();
    return new Response(r.body === undefined ? "" : JSON.stringify(r.body), { status: r.status ?? 200, headers: { "content-type": "application/json", "x-credits-used": "1", ...(r.headers ?? {}) } });
  }) as typeof fetch;
  return createCrustdataClient({ apiKey: "test-key-not-real", fetchImpl });
}

const ctx = (client: ToolContext["client"], creditCap = 50): ToolContext => ({ client, ledger: [], raw: new Map(), creditCap });
const registry = toolRegistry();

afterEach(() => vi.useRealTimers());

describe("registry", () => {
  it("exports every extra tool with a unique name that does not shadow a core tool", () => {
    const names = EXTRA_TOOLS.map((t) => t.spec.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(registry.get(n)).toBe(EXTRA_TOOLS.find((t) => t.spec.name === n));
    expect(names).toEqual(expect.arrayContaining(["identify_company", "company_signals", "find_founders", "search_jobs", "web_search"]));
  });
});

describe("identify_company", () => {
  it("sends exactly one identifier kind, normalising domains (ids win over domains)", async () => {
    const sent: Sent[] = [];
    const c = mockClient([{ body: [] }], sent);
    await identifyCompany.execute({ domains: ["https://www.E2B.dev/about"], exact_match: true }, c);
    await identifyCompany.execute({ domains: ["e2b.dev"], crustdata_company_ids: [1083252, "x"] }, c);
    await identifyCompany.execute({ names: ["  ", "E2B", 3], linkedin_urls: ["https://example.com/not-linkedin"] }, c);
    expect(sent.map((s) => s.body)).toEqual([{ domains: ["e2b.dev"], exact_match: true }, { crustdata_company_ids: [1083252] }, { names: ["E2B", "3"] }]);
    expect(identifyCompany.estimateCredits({ names: ["a"] })).toBe(0);
  });

  it("rejects an empty request before calling Crustdata", async () => {
    const sent: Sent[] = [];
    await expect(identifyCompany.execute({ names: [""] }, mockClient([{ body: [] }], sent))).rejects.toThrow(/needs names/);
    expect(sent).toHaveLength(0);
  });

  it("returns the capture unchanged, so company_data paths cite", async () => {
    const r = await runTool(ctx(fixtureClient()), registry, "identify_company", { domains: ["e2b.dev"] });
    expect(r.isError).toBeUndefined();
    const raw = loadFixture<unknown>("company-identify-e2b.json");
    expect(resolvePath(raw, "[0].matches[0].company_data.crustdata_company_id")).toBe(1083252);
  });

  it("surfaces 404 for an unknown domain as a tool error with the upstream status", async () => {
    const c = ctx(fixtureClient());
    const r = await runTool(c, registry, "identify_company", { domains: ["zz9-unknown-domain.io"] });
    expect(r.isError).toBe(true);
    expect(c.ledger[0]).toMatchObject({ status: "error", upstreamStatus: 404 });
  });
});

describe("company_signals", () => {
  it("projects the requested sections from the real enrich capture without changing any cited value", async () => {
    const c = ctx(fixtureClient());
    const r = await runTool(c, registry, "company_signals", { domains: ["e2b.dev"], sections: ["headcount", "funding", "people", "web_traffic", "bogus"] });
    expect(r.isError).toBeUndefined();
    const projected = c.raw.get("c1");
    const original = loadFixture<unknown>("company-enrich-e2b.json");
    for (const p of [
      "[0].matches[0].company_data.headcount.total",
      "[0].matches[0].company_data.headcount.growth_percent.six_months",
      "[0].matches[0].company_data.headcount.by_role_growth_6m_pct.Engineering",
      "[0].matches[0].company_data.funding.total_investment_usd",
      "[0].matches[0].company_data.funding.investors[0]",
      "[0].matches[0].company_data.people.founders[0].basic_profile.name",
      '[0].matches[0].company_data.web_traffic.domain_traffic["e2b.dev"].monthly_visitors',
    ]) {
      expect(resolvePath(projected, p), p).toEqual(resolvePath(original, p));
      expect(resolvePath(projected, p), p).not.toBeUndefined();
    }
    // Heavy arrays and unrequested sections are dropped.
    expect(resolvePath(projected, "[0].matches[0].company_data.headcount.timeseries")).toBeUndefined();
    expect(resolvePath(projected, '[0].matches[0].company_data.web_traffic.domain_traffic["e2b.dev"].monthly_visitors_timeseries')).toBeUndefined();
    expect(resolvePath(projected, "[0].matches[0].company_data.followers")).toBeUndefined();
    expect(c.ledger[0]).toMatchObject({ tool: "company_signals", path: "/company/enrich", status: "ok", creditsUsed: 2 });
    expect(r.content.length).toBeLessThan(JSON.stringify(original).length / 3);
  });

  it("defaults to headcount + funding, caps at 5 companies and estimates 2 credits each", async () => {
    const sent: Sent[] = [];
    const ids = [1, 2, 3, 4, 5, 6, 7];
    await companySignals.execute({ crustdata_company_ids: ids }, mockClient([{ body: [] }], sent));
    expect(sent[0]!.body.crustdata_company_ids).toEqual([1, 2, 3, 4, 5]);
    expect(companySignals.estimateCredits({ crustdata_company_ids: ids })).toBe(10);
    expect(companySignals.estimateCredits({ domains: ["a.com"] })).toBe(2);
    await expect(companySignals.execute({}, mockClient([{ body: [] }]))).rejects.toThrow(/needs/);
  });

  it("passes through no-match entries and messy company records (missing sections, nulls)", async () => {
    const messy = [
      { matched_on: "nomatch.io", match_type: "domain", matches: [] },
      { matched_on: "thin.io", match_type: "domain", matches: [{ confidence_score: 0.4, company_data: { crustdata_company_id: 9, basic_info: null, headcount: { total: null, growth_percent: { six_months: null } }, funding: null } }] },
      "unexpected",
    ];
    const x = await companySignals.execute({ domains: ["nomatch.io", "thin.io"], sections: ["headcount", "funding", "news"] }, mockClient([{ body: messy }]));
    expect(resolvePath(x.data, "[0].matches")).toEqual([]);
    expect(resolvePath(x.data, "[1].matches[0].company_data.headcount.growth_percent.six_months")).toBeNull();
    expect(resolvePath(x.data, "[1].matches[0].company_data.funding")).toBeNull();
    expect(resolvePath(x.data, "[1].matches[0].company_data.news")).toBeUndefined();
    expect(resolvePath(x.data, "[2]")).toBe("unexpected");
  });
});

describe("find_founders", () => {
  it("builds one person search over several companies with experience + education returned", async () => {
    const sent: Sent[] = [];
    await findFounders.execute({ crustdata_company_ids: [11, 22, "bad", 33] }, mockClient([{ body: { profiles: [], total_count: 0 } }], sent));
    expect(sent[0]!.body).toEqual({
      filters: { op: "and", conditions: [{ field: "experience.employment_details.current.company_id", type: "in", value: [11, 22, 33] }, { field: "experience.employment_details.current.title", type: "(.)", value: "Founder" }] },
      fields: ["basic_profile", "experience", "education", "social_handles"],
      limit: 9,
    });
    expect(findFounders.estimateCredits({ crustdata_company_ids: [11, 22, 33] })).toBeCloseTo(9 * 0.23);
    await expect(findFounders.execute({ crustdata_company_ids: [] }, mockClient([{ body: {} }]))).rejects.toThrow(/identify_company/);
  });

  it("uses = for one company and a custom title, and records rows/total_count (empty result is not an error)", async () => {
    const sent: Sent[] = [];
    const c = ctx(mockClient([{ body: { profiles: [], next_cursor: null, total_count: 0 } }], sent));
    const r = await runTool(c, registry, "find_founders", { crustdata_company_ids: [5], title_keyword: "CTO", limit: 2 });
    expect(r.isError).toBeUndefined();
    expect((sent[0]!.body.filters as { conditions: unknown[] }).conditions).toEqual([
      { field: "experience.employment_details.current.company_id", type: "=", value: 5 },
      { field: "experience.employment_details.current.title", type: "(.)", value: "CTO" },
    ]);
    expect(c.ledger[0]).toMatchObject({ rows: 0, totalCount: 0, status: "ok" });
  });
});

describe("search_jobs", () => {
  it("adds default fields/sort, clamps limit, keeps only valid aggregations", async () => {
    const sent: Sent[] = [];
    const filters = { field: "company.basic_info.company_id", type: "in", value: [1, 2] };
    await searchJobs.execute({ filters, limit: 500, aggregations: [{ type: "group_by", field: "job_details.category", size: 999 }, { type: "sum" }, { type: "count" }] }, mockClient([{ body: { job_listings: [] } }], sent));
    expect(sent[0]!.body).toMatchObject({ filters, limit: 50, sorts: [{ field: "metadata.date_added", order: "desc" }], aggregations: [{ type: "group_by", field: "job_details.category", agg: "count", size: 50 }, { type: "count" }] });
    expect(sent[0]!.body.fields).toContain("job_details.title");
    expect(searchJobs.estimateCredits({ limit: 0 })).toBe(0);
    expect(searchJobs.estimateCredits({ limit: 20 })).toBe(0.6);
  });

  it("refuses missing filters and limit 0 without aggregations", async () => {
    await expect(searchJobs.execute({ limit: 5 }, mockClient([{ body: {} }]))).rejects.toThrow(/filters/);
    await expect(searchJobs.execute({ filters: { field: "x", type: "=", value: 1 }, limit: 0 }, mockClient([{ body: {} }]))).rejects.toThrow(/aggregations/);
  });

  it("reads the real job capture; job_listings paths cite", async () => {
    const c = ctx(fixtureClient());
    const r = await runTool(c, registry, "search_jobs", { filters: { field: "company.basic_info.company_id", type: "=", value: 1083252 }, limit: 5 });
    expect(r.isError).toBeUndefined();
    expect(c.ledger[0]!.rows).toBeGreaterThan(0);
    expect(typeof resolvePath(c.raw.get("c1"), "job_listings[0].job_details.title")).toBe("string");
  });

  it("maps a 400 (bad field) to an actionable tool error", async () => {
    const c = ctx(mockClient([{ status: 400, body: { error: { type: "invalid_request", message: "Unknown field job.title" } } }]));
    const r = await runTool(c, registry, "search_jobs", { filters: { field: "job.title", type: "=", value: "x" }, limit: 1 });
    expect(r).toMatchObject({ isError: true });
    expect(r.content).toMatch(/HTTP 400.*Unknown field job\.title.*fix the field name/);
  });
});

describe("web_search", () => {
  it("converts dates to unix seconds, filters sources, uppercases country, maps to location", async () => {
    const sent: Sent[] = [];
    await webSearch.execute({ query: "  Indian B2B SaaS seed round ", sources: ["news", "tiktok"], site: "inc42.com", country: "in", start_date: "2026-05-01", end_date: "2026-10-31" }, mockClient([{ body: { success: true, results: [] } }], sent));
    expect(sent[0]!.body).toEqual({ query: "Indian B2B SaaS seed round", sources: ["news"], site: "inc42.com", location: "IN", start_date: 1777593600, end_date: 1793404800 });
    expect(toUnixSeconds("garbage")).toBeUndefined();
    expect(toUnixSeconds(1793404800000)).toBe(1793404800);
  });

  it("rejects empty queries and inverted date ranges", async () => {
    await expect(webSearch.execute({ query: " " }, mockClient([{ body: {} }]))).rejects.toThrow(/query/);
    await expect(webSearch.execute({ query: "x", start_date: "2026-10-01", end_date: "2026-01-01" }, mockClient([{ body: {} }]))).rejects.toThrow(/before/);
  });

  it("reads the real web capture", async () => {
    const c = ctx(fixtureClient());
    const r = await runTool(c, registry, "web_search", { query: "E2B Series A" });
    expect(r.isError).toBeUndefined();
    expect(typeof resolvePath(c.raw.get("c1"), "results[0].url")).toBe("string");
    expect(c.ledger[0]).toMatchObject({ creditsUsed: 1, path: "/web/search/live" });
  });
});

describe("failures through runTool", () => {
  it("429 that cannot be waited out comes back as a rate-limit error, not a throw", async () => {
    const c = ctx(mockClient([{ status: 429, body: { error: { type: "rate_limit_error", message: "slow down" } }, headers: { "retry-after": "120" } }]));
    const r = await runTool(c, registry, "search_jobs", { filters: { field: "x", type: "=", value: 1 }, limit: 1 });
    expect(r.isError).toBe(true);
    expect(r.content).toMatch(/HTTP 429.*rate limited/);
    expect(c.ledger[0]).toMatchObject({ status: "error", upstreamStatus: 429 });
  });

  it("429 then 200 is retried transparently", async () => {
    const sent: Sent[] = [];
    const c = ctx(mockClient([{ status: 429, body: {}, headers: { "retry-after": "0" } }, { body: [] }], sent));
    const r = await runTool(c, registry, "identify_company", { names: ["E2B"] });
    expect(r.isError).toBeUndefined();
    expect(sent).toHaveLength(2);
  });

  it("5xx is an error with upstream status", async () => {
    const c = ctx(mockClient([{ status: 503, body: { error: { type: "internal_error", message: "upstream down" } } }]));
    const r = await runTool(c, registry, "company_signals", { domains: ["e2b.dev"] });
    expect(r.isError).toBe(true);
    expect(c.ledger[0]).toMatchObject({ status: "error", upstreamStatus: 503 });
  });

  it("non-JSON 200 body is an error, not a crash", async () => {
    const c = ctx(mockClient([async () => new Response("<html>gateway</html>", { status: 200 })]));
    const r = await runTool(c, registry, "web_search", { query: "x" });
    expect(r.isError).toBe(true);
  });

  it("a POST that times out is not replayed and reports the timeout", async () => {
    vi.useFakeTimers();
    const sent: Sent[] = [];
    const client = createCrustdataClient({
      apiKey: "test-key-not-real",
      fetchImpl: ((url: RequestInfo | URL, init?: RequestInit) => {
        sent.push({ path: String(url), body: {} });
        return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
      }) as typeof fetch,
    });
    const c = ctx(client);
    const p = runTool(c, registry, "web_search", { query: "slow" });
    await vi.advanceTimersByTimeAsync(25_000);
    const r = await p;
    expect(r.isError).toBe(true);
    expect(r.content).toMatch(/timed out/);
    expect(sent).toHaveLength(1);
  });

  it("refuses a call over the credit cap without calling Crustdata", async () => {
    const sent: Sent[] = [];
    const c = ctx(mockClient([{ body: [] }], sent), 3);
    const r = await runTool(c, registry, "company_signals", { crustdata_company_ids: [1, 2] });
    expect(r.isError).toBe(true);
    expect(c.ledger[0]!.status).toBe("refused");
    expect(sent).toHaveLength(0);
  });
});
