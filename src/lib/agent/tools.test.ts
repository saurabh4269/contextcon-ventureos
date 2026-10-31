import { describe, expect, it } from "vitest";
import { createCrustdataClient, MemoryResponseCache, type CrustdataClient } from "@/lib/crustdata";
import { fixtureClient } from "@/test/crustdata";
import type { LedgerCall, ToolDef } from "./contract";
import { CORE_TOOLS, creditsSpent, estimateCredits, prune, runTool, toolRegistry, type ToolContext } from "./tools";
import { checkCell, resolvePath } from "./cite";

type Sent = { method: string; path: string; body: Record<string, unknown> };
type Reply = { status: number; body: unknown; headers?: Record<string, string> };

/** Mock fetch: answers each request with the next reply (last one repeats) and records what was sent. */
function mockFetch(replies: Reply | Reply[], sent: Sent[] = []): typeof fetch {
  const queue = Array.isArray(replies) ? [...replies] : [replies];
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    sent.push({ method: (init?.method ?? "GET").toUpperCase(), path: new URL(url).pathname, body: init?.body ? JSON.parse(String(init.body)) : {} });
    const r = queue.length > 1 ? queue.shift()! : queue[0]!;
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json", "x-credits-used": "0.3", ...(r.headers ?? {}) } });
  }) as typeof fetch;
}

const clientFor = (replies: Reply | Reply[], sent?: Sent[], cache?: MemoryResponseCache) =>
  createCrustdataClient({ apiKey: "test-key-not-real", fetchImpl: mockFetch(replies, sent), ...(cache ? { cache } : {}) });

const tool = (name: string) => CORE_TOOLS.find((t) => t.spec.name === name)!;
/** Executors may throw synchronously on invalid input; normalise to a rejected promise. */
const exec = async (name: string, input: Record<string, unknown>, client: CrustdataClient) => tool(name).execute(input, client);
const ctxFor = (client: CrustdataClient, creditCap = 100): ToolContext => ({ client, ledger: [], raw: new Map(), creditCap });
const okSearch = { status: 200, body: { companies: [{ crustdata_company_id: 1, basic_info: { name: "Acme" } }, { crustdata_company_id: 2 }], next_cursor: null, total_count: 42 } };
const FILTERS = { field: "basic_info.year_founded", type: "=>", value: 2023 };

describe("CORE_TOOLS / toolRegistry", () => {
  it("exposes the four core tools in order", () => {
    expect(CORE_TOOLS.map((t) => t.spec.name)).toEqual(["search_companies", "search_people", "enrich_companies", "enrich_person"]);
  });

  it("registry appends extras but never lets them override a core tool", () => {
    const clash: ToolDef = { spec: { ...tool("search_companies").spec, description: "fake" }, estimateCredits: () => 0, execute: async () => { throw new Error("nope"); } };
    const extra: ToolDef = { spec: { name: "extra_tool", description: "x", input_schema: { type: "object", properties: {} } }, estimateCredits: () => 0, execute: async () => { throw new Error("nope"); } };
    const reg = toolRegistry([clash, extra]);
    expect([...reg.keys()]).toEqual(["search_companies", "search_people", "enrich_companies", "enrich_person", "extra_tool"]);
    expect(reg.get("search_companies")!.spec.description).not.toBe("fake");
    expect(toolRegistry().size).toBeGreaterThanOrEqual(4);
  });
});

describe("search_companies", () => {
  it("builds the body with default fields and default limit", async () => {
    const sent: Sent[] = [];
    const x = await tool("search_companies").execute({ filters: FILTERS }, clientFor(okSearch, sent));
    expect(x.path).toBe("/company/search");
    expect(x.method).toBe("POST");
    expect(x.body).toEqual({ filters: FILTERS, fields: ["crustdata_company_id", "basic_info", "headcount", "locations", "taxonomy"], limit: 10 });
    expect(sent[0]).toMatchObject({ method: "POST", path: "/company/search", body: x.body });
    expect(x.meta.creditsUsed).toBe("0.3");
    expect(x.meta.cached).toBe(false);
  });

  it("maps search_query to hybrid search, keeps sorts/cursor/fields", async () => {
    const x = await tool("search_companies").execute(
      { search_query: "  B2B SaaS  ", fields: ["basic_info"], sorts: [{ field: "headcount.total", order: "desc" }], cursor: "abc", limit: 5 },
      clientFor(okSearch),
    );
    expect(x.body).toEqual({ search: { query: "B2B SaaS", mode: "hybrid" }, fields: ["basic_info"], sorts: [{ field: "headcount.total", order: "desc" }], limit: 5, cursor: "abc" });
  });

  it.each([[0, 1], [-3, 1], [51, 50], [999, 50], [7.9, 7], ["12", 12], ["abc", 10]])("clamps limit %s to %s", async (limit, expected) => {
    const x = await tool("search_companies").execute({ filters: FILTERS, limit }, clientFor(okSearch));
    expect(x.body.limit).toBe(expected);
  });

  it("throws without filters or a non-blank search_query", async () => {
    const sent: Sent[] = [];
    await expect(exec("search_companies", { limit: 5 }, clientFor(okSearch, sent))).rejects.toThrow(/filters or a search_query/);
    await expect(exec("search_companies", { search_query: "   ", limit: 5 }, clientFor(okSearch, sent))).rejects.toThrow(/filters or a search_query/);
    expect(sent).toHaveLength(0);
  });
});

describe("search_people", () => {
  it("requires filters", async () => {
    await expect(exec("search_people", { limit: 5 }, clientFor(okSearch))).rejects.toThrow(/needs filters/);
  });

  it("builds the body with default fields and clamped limit", async () => {
    const x = await tool("search_people").execute({ filters: FILTERS, limit: 80 }, clientFor({ status: 200, body: { profiles: [], total_count: 0 } }));
    expect(x.path).toBe("/person/search");
    expect(x.body).toEqual({ filters: FILTERS, fields: ["basic_profile", "experience", "social_handles"], limit: 50 });
  });
});

describe("enrich_companies", () => {
  it("prefers ids over domains and caps at 5", async () => {
    const sent: Sent[] = [];
    const x = await tool("enrich_companies").execute({ crustdata_company_ids: [1, 2, "3", 4, 5, 6, 7], domains: ["a.com"] }, clientFor({ status: 200, body: [] }, sent));
    expect(x.path).toBe("/company/enrich");
    expect(x.body).toEqual({ crustdata_company_ids: [1, 2, 3, 4, 5] });
    expect(sent[0]!.body.crustdata_company_ids).toEqual([1, 2, 3, 4, 5]);
  });

  it("falls back to domains (capped at 5), drops non-integer ids", async () => {
    const x = await tool("enrich_companies").execute({ crustdata_company_ids: ["x", 1.5], domains: ["a.com", "", "b.com", "c.com", "d.com", "e.com", "f.com"] }, clientFor({ status: 200, body: [] }));
    expect(x.body).toEqual({ domains: ["a.com", "b.com", "c.com", "d.com", "e.com"] });
  });

  it("throws with neither ids nor domains", async () => {
    await expect(exec("enrich_companies", {}, clientFor({ status: 200, body: [] }))).rejects.toThrow(/needs crustdata_company_ids or domains/);
  });
});

describe("enrich_person", () => {
  it("keeps only LinkedIn URLs (max 5)", async () => {
    const urls = ["https://example.com/u", "https://www.linkedin.com/in/a", "https://LinkedIn.com/in/b", "linkedin", ...["c", "d", "e", "f"].map((s) => `https://linkedin.com/in/${s}`)];
    const x = await tool("enrich_person").execute({ linkedin_urls: urls }, clientFor({ status: 200, body: [] }));
    expect(x.path).toBe("/person/enrich");
    expect(x.body.professional_network_profile_urls).toEqual(["https://www.linkedin.com/in/a", "https://LinkedIn.com/in/b", "https://linkedin.com/in/c", "https://linkedin.com/in/d", "https://linkedin.com/in/e"]);
    expect(x.body.fields).toEqual(["basic_profile", "experience", "education", "social_handles"]);
  });

  it("throws when no LinkedIn URL remains", async () => {
    await expect(exec("enrich_person", { linkedin_urls: ["https://x.com/a"] }, clientFor({ status: 200, body: [] }))).rejects.toThrow(/LinkedIn/);
  });

  it("works against the fixture client", async () => {
    const x = await tool("enrich_person").execute({ linkedin_urls: ["https://www.linkedin.com/in/someone"] }, fixtureClient());
    expect(x.meta.creditsUsed).toBe("1");
    expect(x.data).toBeTruthy();
  });
});

describe("estimateCredits / creditsSpent", () => {
  it("estimates per tool", () => {
    expect(estimateCredits("search_companies", { limit: 10, fields: ["basic_info"] })).toBe(0.3);
    expect(estimateCredits("search_companies", { limit: 10, fields: ["headcount", "taxonomy"] })).toBe(3.3);
    // default fields (basic_info, headcount, locations, taxonomy) ≈ 0.53/row, live-calibrated
    expect(estimateCredits("search_companies", {})).toBe(5.3);
    expect(estimateCredits("search_people", { limit: 10, filters: { field: "experience.x" }, fields: ["experience"] })).toBe(2.3);
    expect(estimateCredits("enrich_companies", { crustdata_company_ids: [1, 2], domains: ["a.com"] })).toBe(6);
    expect(estimateCredits("enrich_person", { linkedin_urls: ["a", "b"] })).toBe(2);
    expect(estimateCredits("nope", {})).toBe(0);
  });

  it("sums only ok calls, falling back to the estimate when creditsUsed is null", () => {
    const base = { tool: "t", method: "POST", path: "", body: {}, retrievedAt: null, cached: false, ms: 0 } as const;
    const ledger: LedgerCall[] = [
      { ...base, ref: "c1", status: "ok", creditsUsed: 0.3, creditsEstimated: 1 },
      { ...base, ref: "c2", status: "ok", creditsUsed: null, creditsEstimated: 0.45 },
      { ...base, ref: "c3", status: "error", creditsUsed: null, creditsEstimated: 5 },
      { ...base, ref: "c4", status: "refused", creditsUsed: null, creditsEstimated: 50 },
    ];
    expect(creditsSpent(ledger)).toBe(0.75);
    expect(creditsSpent([])).toBe(0);
  });
});

describe("runTool", () => {
  const reg = toolRegistry([]);

  it("returns an error for an unknown tool without touching the ledger", async () => {
    const ctx = ctxFor(clientFor(okSearch));
    const r = await runTool(ctx, reg, "drop_tables", {});
    expect(r.isError).toBe(true);
    expect(r.ref).toBeUndefined();
    expect(r.content).toMatch(/Unknown tool drop_tables.*search_companies/);
    expect(ctx.ledger).toHaveLength(0);
  });

  it("refuses calls that would exceed the credit cap", async () => {
    const sent: Sent[] = [];
    const ctx = ctxFor(clientFor(okSearch, sent), 1);
    const r = await runTool(ctx, reg, "enrich_companies", { crustdata_company_ids: [1] });
    expect(r).toMatchObject({ ref: "c1", isError: true });
    expect(r.content).toMatch(/Refused.*2 credits.*1-credit cap/);
    expect(ctx.ledger[0]).toMatchObject({ ref: "c1", status: "refused", creditsEstimated: 2, creditsUsed: null, error: "credit cap" });
    expect(sent).toHaveLength(0);
  });

  it("records a successful call in the ledger and keeps the raw response", async () => {
    const ctx = ctxFor(clientFor(okSearch));
    const r = await runTool(ctx, reg, "search_companies", { filters: FILTERS, limit: 2, fields: ["basic_info"] });
    expect(r.isError).toBeUndefined();
    expect(r.ref).toBe("c1");
    const parsed = JSON.parse(r.content);
    expect(parsed).toMatchObject({ ref: "c1", endpoint: "POST /company/search" });
    expect(parsed.response.companies).toHaveLength(2);
    expect(parsed.response.next_cursor).toBeUndefined(); // null pruned
    const call = ctx.ledger[0]!;
    expect(call).toMatchObject({ ref: "c1", tool: "search_companies", method: "POST", path: "/company/search", status: "ok", creditsUsed: 0.3, creditsEstimated: 0.06, cached: false, rows: 2, totalCount: 42 });
    expect(call.body).toMatchObject({ filters: FILTERS, limit: 2 });
    expect(typeof call.retrievedAt).toBe("string");
    expect(ctx.raw.get("c1")).toEqual(okSearch.body);
    expect(creditsSpent(ctx.ledger)).toBe(0.3);

    const r2 = await runTool(ctx, reg, "search_companies", { filters: FILTERS, limit: 3 });
    expect(r2.ref).toBe("c2");
  });

  it("counts profiles for people search and leaves rows unset for objects", async () => {
    const ctx = ctxFor(clientFor([{ status: 200, body: { profiles: [{}, {}, {}], total_count: null } }, { status: 200, body: { foo: 1 } }]));
    await runTool(ctx, reg, "search_people", { filters: FILTERS, limit: 3 });
    expect(ctx.ledger[0]).toMatchObject({ rows: 3, totalCount: null });
    await runTool(ctx, reg, "enrich_companies", { domains: ["a.com"] });
    expect(ctx.ledger[1]!.rows).toBeUndefined();
  });

  it("turns validation throws into tool errors", async () => {
    const ctx = ctxFor(clientFor(okSearch));
    const r = await runTool(ctx, reg, "search_people", { limit: 3 });
    expect(r).toMatchObject({ ref: "c1", isError: true });
    expect(r.content).toBe("search_people failed: search_people needs filters.");
    expect(ctx.ledger[0]).toMatchObject({ status: "error", error: "search_people needs filters." });
    expect(ctx.ledger[0]!.upstreamStatus).toBeUndefined();
  });

  it("maps HTTP 400 to an error with upstreamStatus and a fix hint", async () => {
    const ctx = ctxFor(clientFor({ status: 400, body: { error: { type: "invalid_request", message: "Unknown field foo" } } }));
    const r = await runTool(ctx, reg, "search_companies", { filters: FILTERS, limit: 5 });
    expect(r.isError).toBe(true);
    expect(r.content).toMatch(/search_companies failed with HTTP 400: Crustdata 400: Unknown field foo \(request rejected/);
    expect(ctx.ledger[0]).toMatchObject({ status: "error", upstreamStatus: 400, creditsUsed: null });
    expect(ctx.raw.size).toBe(0);
    expect(creditsSpent(ctx.ledger)).toBe(0);
  });

  it("maps HTTP 500 to an error with upstreamStatus and no hint", async () => {
    const ctx = ctxFor(clientFor({ status: 500, body: { error: "boom" } }));
    const r = await runTool(ctx, reg, "search_companies", { filters: FILTERS, limit: 5 });
    expect(r.isError).toBe(true);
    expect(r.content).toBe("search_companies failed with HTTP 500: Crustdata 500: boom");
    expect(ctx.ledger[0]).toMatchObject({ status: "error", upstreamStatus: 500 });
  });

  it("retries a 429 (Retry-After: 0) and then succeeds", async () => {
    const sent: Sent[] = [];
    const ctx = ctxFor(clientFor([{ status: 429, body: { error: "slow down" }, headers: { "retry-after": "0" } }, okSearch], sent));
    const r = await runTool(ctx, reg, "search_companies", { filters: FILTERS, limit: 2 });
    expect(r.isError).toBeUndefined();
    expect(sent).toHaveLength(2);
    expect(ctx.ledger[0]).toMatchObject({ status: "ok", rows: 2 });
  });

  it("reports 429 after retries are exhausted with a rate-limit hint", async () => {
    const sent: Sent[] = [];
    const ctx = ctxFor(clientFor({ status: 429, body: { error: "slow down" }, headers: { "retry-after": "0" } }, sent));
    const r = await runTool(ctx, reg, "search_companies", { filters: FILTERS, limit: 2 });
    expect(r.isError).toBe(true);
    expect(r.content).toMatch(/HTTP 429.*rate limited after retries/);
    expect(ctx.ledger[0]).toMatchObject({ status: "error", upstreamStatus: 429 });
    expect(sent).toHaveLength(4); // 1 + 3 retries
  });

  it("records cache hits with creditsUsed 0", async () => {
    const sent: Sent[] = [];
    const ctx = ctxFor(clientFor(okSearch, sent, new MemoryResponseCache(60_000)));
    const input = { filters: FILTERS, limit: 2 };
    await runTool(ctx, reg, "search_companies", input);
    await runTool(ctx, reg, "search_companies", input);
    expect(sent).toHaveLength(1);
    expect(ctx.ledger.map((c) => [c.ref, c.cached, c.creditsUsed])).toEqual([["c1", false, 0.3], ["c2", true, 0]]);
    expect(ctx.raw.get("c2")).toEqual(okSearch.body);
    expect(creditsSpent(ctx.ledger)).toBe(0.3);
  });

  it("sets creditsUsed null when the header is missing or not numeric", async () => {
    const ctx = ctxFor(clientFor({ status: 200, body: okSearch.body, headers: { "x-credits-used": "n/a" } }));
    await runTool(ctx, reg, "search_companies", { filters: FILTERS, limit: 2 });
    expect(ctx.ledger[0]!.creditsUsed).toBeNull();
  });
});

describe("prune", () => {
  it("caps nested arrays and strings, preserving indices; never cuts top-level result lists", () => {
    const twenty = Array.from({ length: 20 }, (_, i) => i);
    const out = prune({ list: twenty, s: "x".repeat(300), rows: [{ past: twenty }] }) as { list: number[]; s: string; rows: { past: number[] }[] };
    expect(out.list).toEqual(twenty);
    expect(out.rows[0]!.past).toEqual(twenty.slice(0, 12));
    expect(out.s).toBe(`${"x".repeat(280)}…`);
    expect(prune("abcdef", 3)).toBe("abc…");
    expect(prune([[1, 2, 3]], 280, 2)).toEqual([[1, 2, 3]]);
    expect(prune({ a: [{ b: [1, 2, 3] }] }, 280, 2)).toEqual({ a: [{ b: [1, 2] }] });
  });

  it("drops null values, empty arrays and noisy keys; keeps falsy scalars", () => {
    expect(prune({ a: null, b: [], c: 0, d: false, e: "", skills: ["x"], summary: "long", logo_permalink: "u", nested: { x: null, y: 1 } })).toEqual({ c: 0, d: false, e: "", nested: { y: 1 } });
  });

  it("truncates very deep objects", () => {
    let deep: Record<string, unknown> = { leaf: 1 };
    for (let i = 0; i < 12; i++) deep = { n: deep };
    expect(JSON.stringify(prune(deep))).toContain('"…"');
  });
});

describe("cite.resolvePath", () => {
  const data = { companies: [{ basic_info: { name: "Acme" }, headcount: { growth_percent: { "6m": 12.5 } }, "weird.key": "w" }], total_count: 3 };

  it("resolves dotted paths with indices, leading $. and quoted keys", () => {
    expect(resolvePath(data, "companies[0].basic_info.name")).toBe("Acme");
    expect(resolvePath(data, "$.companies[0].headcount.growth_percent.6m")).toBe(12.5);
    expect(resolvePath(data, '$companies[0]["weird.key"]')).toBe("w");
    expect(resolvePath(data, "companies.0.basic_info.name")).toBe("Acme");
    expect(resolvePath(data, "  total_count ")).toBe(3);
    expect(resolvePath([10, 20], "[1]")).toBe(20);
  });

  it("returns undefined on misses", () => {
    expect(resolvePath(data, "companies[5].basic_info")).toBeUndefined();
    expect(resolvePath(data, "companies.name")).toBeUndefined();
    expect(resolvePath(data, "total_count.x")).toBeUndefined();
    expect(resolvePath(null, "a")).toBeUndefined();
  });
});

describe("cite.checkCell", () => {
  const data = { companies: [{ name: "Acme Robotics", hc: 1234, growth: 12.5, tags: ["AI", "Robotics"], empty: [], blank: "", nil: null, b2b: true }] };
  const p = (k: string) => `companies[0].${k}`;

  it("verifies numbers within tolerance, including formatted strings", () => {
    expect(checkCell(1234, data, p("hc"))).toEqual({ status: "verified", value: 1234, source: 1234 });
    expect(checkCell("1,240", data, p("hc")).status).toBe("verified"); // within 1%
    expect(checkCell("12.5%", data, p("growth")).status).toBe("verified");
    expect(checkCell(12.55, data, p("growth")).status).toBe("verified"); // within 0.051 absolute
  });

  it("corrects mismatched numbers and strings with the Crustdata value", () => {
    expect(checkCell(2000, data, p("hc"))).toEqual({ status: "corrected", value: 1234, source: 1234, claimed: 2000 });
    expect(checkCell("lots", data, p("hc")).status).toBe("corrected");
    expect(checkCell("Globex", data, p("name"))).toMatchObject({ status: "corrected", value: "Acme Robotics", claimed: "Globex" });
    expect(checkCell(null, data, p("name"))).toMatchObject({ status: "corrected", value: "Acme Robotics" });
  });

  it("verifies strings case-insensitively and by containment; booleans and arrays", () => {
    expect(checkCell("acme  robotics", data, p("name")).status).toBe("verified");
    expect(checkCell("Acme", data, p("name")).status).toBe("verified");
    expect(checkCell("true", data, p("b2b")).status).toBe("verified");
    expect(checkCell("robotics", data, p("tags")).status).toBe("verified");
    expect(checkCell("Fintech", data, p("tags"))).toMatchObject({ status: "corrected", value: '["AI","Robotics"]' });
  });

  it("is unavailable without a path, on a missing path, or on empty values", () => {
    expect(checkCell(1, data, undefined)).toMatchObject({ status: "unavailable", value: null, reason: expect.stringMatching(/No citation path/) });
    expect(checkCell(1, data, p("nope"))).toMatchObject({ status: "unavailable", reason: expect.stringMatching(/does not exist/) });
    for (const k of ["empty", "blank", "nil"]) expect(checkCell("x", data, p(k))).toMatchObject({ status: "unavailable", reason: expect.stringMatching(/returned no value/) });
  });
});
