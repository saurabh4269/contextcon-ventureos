// Sourcing agent: parser (no network) and runner through an injected fetch (synthetic Crustdata-shaped responses, no
// credits). Covers relaxation with disclosure, verification drops, 403 field denial, partial failure, not-connected.
import { describe, expect, it } from "vitest";
import { createCrustdataClient } from "@/lib/crustdata";
import { parseRequest, toSearchBody } from "./parse";
import { growthFromSeries, runAgent, type AgentEvent } from "./run";
import { toCsv, toMarkdown } from "./export";

const NOW = new Date("2026-10-31T08:00:00Z");
const DECK = "Find ten Indian B2B software companies founded since 2023 whose team grew by half in the last six months, and tell me who founded each and what they did before";

describe("parseRequest", () => {
  it("reads the deck request into filters, each with the phrase it came from", () => {
    const r = parseRequest(DECK, NOW);
    expect(r.kind).toBe("search");
    if (r.kind !== "search") return;
    const p = r.plan;
    expect(p.count).toBe(10);
    expect(p.countries.map((c) => c.code)).toEqual(["IND"]);
    expect(p.foundedMin).toBe(2023);
    expect(p.growth).toEqual({ minPct: 50, window: "6m" });
    expect(p.wantFounders && p.wantBackground).toBe(true);
    for (const i of p.interpretation.filter((x) => x.kind === "filter")) expect(i.phrase).not.toBe("");
    const body = toSearchBody(p, [], 20) as { filters: { conditions: { field: string; type: string; value: unknown }[] } };
    expect(body.filters.conditions).toEqual(expect.arrayContaining([
      { field: "locations.country", type: "=", value: "IND" },
      { field: "basic_info.year_founded", type: "=>", value: 2023 },
      { field: "headcount.growth_percent.6m", type: "=>", value: 50 },
    ]));
  });

  it("corrects typos visibly and reads 'after 2022' / 'doubled'", () => {
    const r = parseRequest("10 indain b2b saas cos foundd after 2022 headcount doubled", NOW);
    if (r.kind !== "search") throw new Error(r.kind);
    expect(r.plan.foundedMin).toBe(2023);
    expect(r.plan.growth?.minPct).toBe(100);
    expect(r.plan.interpretation.some((i) => i.kind === "correction" && i.phrase === "indain")).toBe(true);
    expect(r.plan.interpretation.some((i) => i.kind === "assumption")).toBe(true);
  });

  it("reads city and stage", () => {
    const r = parseRequest("fintech startups bangalore seed stage", NOW);
    if (r.kind !== "search") throw new Error(r.kind);
    expect(r.plan.cities.length).toBeGreaterThan(0);
    expect(r.plan.stages).toEqual(["seed"]);
    expect(r.plan.keywords).toContain("fintech");
  });

  it("refuses gibberish with a helpful example", () => {
    const r = parseRequest("asdf", NOW);
    expect(r.kind).toBe("refuse");
    if (r.kind === "refuse") expect(r.message).toMatch(/Try/);
  });
});

describe("growthFromSeries", () => {
  it("recomputes from the unsorted monthly series against the point ~6 months back", () => {
    const g = growthFromSeries([{ date: "2026-09-15", employee_count: 30 }, { date: "2026-03-14", employee_count: 20 }, { date: "2026-06-15", employee_count: 25 }], "6m");
    expect(g?.pct).toBe(50);
    expect(g?.then?.date).toBe("2026-03-14");
  });
  it("gives no % without a point near the window", () => {
    expect(growthFromSeries([{ date: "2026-09-15", employee_count: 30 }], "6m")?.pct).toBeUndefined();
  });
  it("never labels a 5-month span as 6-month growth", () => {
    // the series skips March: April (5 months back) is within 45 days of the target but is not 6 months back
    const g = growthFromSeries([{ date: "2026-09-01", employee_count: 30 }, { date: "2026-04-01", employee_count: 20 }, { date: "2026-08-01", employee_count: 29 }], "6m");
    expect(g?.pct).toBeUndefined();
    expect(g?.then).toBeUndefined();
    expect(growthFromSeries([{ date: "2026-09-30", employee_count: 30 }, { date: "2026-03-01", employee_count: 20 }], "6m")?.then?.date).toBe("2026-03-01");
  });
});

/* ───────────── runner through an injected fetch ───────────── */

type Co = { id: number; name: string; domain: string; founded: number; then: number; now: number };
const COS: Co[] = [
  { id: 101, name: "Alpha Labs", domain: "alpha.example", founded: 2024, then: 10, now: 30 },
  { id: 102, name: "Beta Cloud", domain: "beta.example", founded: 2023, then: 20, now: 22 }, // +10%: fails verification
  { id: 103, name: "Gamma AI", domain: "gamma.example", founded: 2025, then: 8, now: 20 },
];
const enrichOf = (c: Co) => ({
  crustdata_company_id: c.id,
  basic_info: { name: c.name, primary_domain: c.domain, year_founded: c.founded },
  headcount: { total: c.now, timeseries: [{ date: "2026-09-15", employee_count: c.now }, { date: "2026-03-15", employee_count: c.then }] },
  locations: { country: "IND", headquarters: "Bengaluru, Karnataka, India" },
  funding: { total_investment_usd: 0, last_round_type: "seed" },
});
const json = (body: unknown, status = 200, credits = "1") => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "x-credits-used": credits } });

function fakeFetch(opts: { searchResults?: (n: number) => Co[]; denyEnrichGroup?: boolean; personFails?: number } = {}) {
  const log: { path: string; body: Record<string, unknown> }[] = [];
  let searches = 0;
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname.replace(/^\/v\d+/, "");
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    log.push({ path, body });
    if (path.endsWith("/company/search")) {
      const hits = (opts.searchResults ?? (() => COS))(searches++);
      return json({ companies: hits.map((c) => ({ crustdata_company_id: c.id, basic_info: { name: c.name, primary_domain: c.domain } })), next_cursor: null, total_count: hits.length }, 200, "2");
    }
    if (path.endsWith("/company/enrich")) {
      const fields = body.fields as string[];
      if (opts.denyEnrichGroup && fields.includes("funding")) return json({ error: { type: "permission_error", message: "field group funding is not enabled for this plan" } }, 403);
      const ids = body.crustdata_company_ids as number[];
      return json(ids.map((id) => ({ matched_on: String(id), matches: [{ company_data: enrichOf(COS.find((c) => c.id === id)!) }] })), 200, String(2 * ids.length));
    }
    if (path.endsWith("/person/search")) {
      const s = JSON.stringify(body);
      if (opts.personFails && s.includes(String(opts.personFails))) return json({ error: { type: "server_error", message: "boom" } }, 500);
      return json({ profiles: [{ crustdata_person_id: 9, basic_profile: { name: "Asha Rao", current_title: "Co-Founder" }, social_handles: { professional_network_identifier: { profile_url: "https://www.linkedin.com/in/asha-example" } }, experience: { employment_details: { current: [{ name: "Alpha Labs", title: "Co-Founder" }], past: [{ name: "Flipkart", title: "Engineer" }] } } }] }, 200, "0.5");
    }
    return json({ error: "unexpected" }, 501);
  }) as typeof fetch;
  return { f, log };
}

async function run(q: string, fetchImpl: typeof fetch | null) {
  const events: AgentEvent[] = [];
  const client = fetchImpl ? createCrustdataClient({ apiKey: "test", fetchImpl }) : null;
  const summary = await runAgent(q, { client, emit: (e) => events.push(e), now: () => NOW, runId: "run_test" });
  return { events, summary };
}

describe("runAgent", () => {
  it("searches, verifies (drops what fails), finds founders, ranks and cites every value", async () => {
    const { f } = fakeFetch();
    const { events, summary } = await run("3 Indian software companies founded since 2023 whose team grew by half in six months, with founders", f);
    expect(summary).not.toBeNull();
    const dropped = events.filter((e) => e.type === "dropped");
    expect(dropped.map((d) => d.type === "dropped" && d.item.name)).toEqual(["Beta Cloud"]);
    expect(summary!.returned).toBe(2);
    expect(summary!.sentence).toMatch(/nothing padded/);
    expect(summary!.credits).toBeGreaterThan(0);
    const rows = new Map<number, Extract<AgentEvent, { type: "row" }>["row"]>();
    for (const e of events) if (e.type === "row") rows.set(e.row.id, e.row);
    const alpha = rows.get(101)!;
    expect(alpha.rank).toBe(1); // most people added
    expect(alpha.growth.status === "ok" && alpha.growth.value).toBe(200);
    expect(alpha.growth.status === "ok" && alpha.growth.citations[0]!.endpoint).toBe("POST /company/enrich");
    expect(alpha.funding.status === "ok" && alpha.funding.value.total).toBeNull(); // 0 is "not reported", not $0
    expect(alpha.founders.status === "ok" && alpha.founders.value[0]!.prior[0]!.company).toBe("Flipkart");
    const md = toMarkdown([...rows.values()], summary, "q");
    expect(md).toMatch(/\[\^1\]: Crustdata · POST \/company\/enrich/);
    expect(toCsv([...rows.values()]).split("\n")[0]).toContain("growth_source");
  });

  it("relaxes one constraint at a time with disclosure when too few match, and never pads", async () => {
    const { f, log } = fakeFetch({ searchResults: (n) => (n === 0 ? [] : [COS[0]!]) });
    const { events, summary } = await run(DECK, f);
    const searches = log.filter((l) => l.path.endsWith("/company/search"));
    expect(searches.length).toBeGreaterThan(1);
    expect(summary!.relaxed.length).toBeGreaterThan(0);
    expect(summary!.returned).toBe(1);
    expect(events.some((e) => e.type === "step" && e.step.id.startsWith("relax-"))).toBe(true);
  });

  it("retries enrich without a denied field group (403) and notes it", async () => {
    const { f, log } = fakeFetch({ denyEnrichGroup: true });
    const { events } = await run("3 Indian software companies founded since 2023", f);
    const enriches = log.filter((l) => l.path.endsWith("/company/enrich"));
    expect((enriches.at(-1)!.body.fields as string[]).includes("funding")).toBe(false);
    const verify = events.filter((e) => e.type === "step" && e.step.id === "verify").at(-1);
    expect(verify?.type === "step" && verify.step.detail).toMatch(/denied \(403\)/);
  });

  it("keeps the other rows when one founder search fails", async () => {
    const { f } = fakeFetch({ personFails: 103 });
    const { events, summary } = await run("3 Indian software companies founded since 2023", f);
    expect(summary!.returned).toBe(3);
    const gamma = events.filter((e) => e.type === "row" && e.row.id === 103).at(-1);
    expect(gamma?.type === "row" && gamma.row.founders.status).toBe("unavailable");
    expect(gamma?.type === "row" && gamma.row.errors.join(" ")).toMatch(/founder search failed/);
  });

  it("says not connected without a client, and refuses gibberish", async () => {
    const a = await run(DECK, null);
    expect(a.events.at(-1)).toMatchObject({ type: "error", kind: "not_connected" });
    const b = await run("asdf", null);
    expect(b.events.at(-1)).toMatchObject({ type: "refuse" });
  });
});
