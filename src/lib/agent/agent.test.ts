import { describe, expect, it } from "vitest";
import { createCrustdataClient, CRUSTDATA_BASE_URL } from "@/lib/crustdata";
import { DEFAULT_CREDIT_CAP, runScreenAgent } from "./agent";
import type { ScreenEvent } from "./contract";
import { estimateCredits } from "./tools";
import { ModelApiError, type AgentMessage, type ModelClient, type ModelTurn, type ToolCall } from "./model";

// ── Crustdata mock (recorded response shapes, docs/crustdata/openapi/company.yaml + person search) ───────────────

const COMPANIES = {
  companies: [
    { crustdata_company_id: 101, basic_info: { name: "Acme AI", year_founded: 2023, primary_domain: "acme.ai" }, headcount: { total: 40, growth_percent: { "6m": 55, "12m": 120 } }, locations: { country: "IND" }, funding: null },
    { crustdata_company_id: 102, basic_info: { name: "Beta Labs", year_founded: 2024, primary_domain: "betalabs.io" }, headcount: { total: 25, growth_percent: { "6m": 80, "12m": 150 } }, locations: { country: "IND" }, funding: null },
  ],
  next_cursor: null,
  total_count: 2,
};
const EMPTY = { companies: [], next_cursor: null, total_count: 0 };
const PEOPLE = {
  profiles: [
    {
      crustdata_person_id: 9001,
      basic_profile: { name: "Asha Rao", current_title: "Co-Founder & CEO" },
      experience: { employment_details: { current: [{ name: "Acme AI", title: "Co-Founder & CEO", company_id: 101 }], past: [{ name: "Google", title: "Senior Software Engineer" }] } },
    },
    {
      crustdata_person_id: 9002,
      basic_profile: { name: "Vikram Shah", current_title: "Founder" },
      experience: { employment_details: { current: [{ name: "Beta Labs", title: "Founder", company_id: 102 }], past: [{ name: "Flipkart", title: "Product Manager" }] } },
    },
  ],
  total_count: 2,
};

type Reply = { status?: number; body: unknown; credits?: string; headers?: Record<string, string> };
type Logged = { method: string; path: string; body: Record<string, unknown>; headers: Record<string, string> };

/** Mock Crustdata transport: per "METHOD /path" a queue of replies (the last one repeats). Records requests. */
function crustFetch(routes: Record<string, Reply | Reply[]>) {
  const log: Logged[] = [];
  const queues = new Map(Object.entries(routes).map(([k, v]) => [k, Array.isArray(v) ? [...v] : [v]]));
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const path = url.startsWith(CRUSTDATA_BASE_URL) ? url.slice(CRUSTDATA_BASE_URL.length) : url;
    const method = (init?.method ?? "GET").toUpperCase();
    log.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : {}, headers: { ...(init?.headers as Record<string, string>) } });
    const q = queues.get(`${method} ${path}`);
    const r = q && (q.length > 1 ? q.shift()! : q[0]);
    if (!r) return new Response(JSON.stringify({ error: `no mock for ${method} ${path}` }), { status: 501 });
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { "content-type": "application/json", ...(r.credits != null ? { "x-credits-used": r.credits } : {}), ...r.headers } });
  }) as typeof fetch;
  return { client: createCrustdataClient({ apiKey: "test-key-not-real", fetchImpl: f }), log };
}

// ── Scripted model ───────────────────────────────────────────────────────────────────────────────────────────────

type Step = ModelTurn | Error | ((messages: AgentMessage[]) => ModelTurn);

/** A ModelClient that answers from a script and records (a copy of) every conversation it was sent. */
function scriptedModel(script: Step[]) {
  const seen: AgentMessage[][] = [];
  const systems: string[] = [];
  const toolNames: string[][] = [];
  const model: ModelClient & { seen: typeof seen; systems: typeof systems; toolNames: typeof toolNames } = {
    provider: "openai",
    model: "scripted-test-model",
    seen,
    systems,
    toolNames,
    async complete({ system, messages, tools }) {
      seen.push(structuredClone(messages));
      systems.push(system);
      toolNames.push(tools.map((t) => t.name));
      const next = script.shift();
      if (!next) throw new Error("scripted model: script exhausted");
      if (next instanceof Error) throw next;
      return typeof next === "function" ? next(messages) : next;
    },
  };
  return model;
}

let ids = 0;
const call = (name: string, input: Record<string, unknown>): ToolCall => ({ id: `call_${++ids}`, name, input });
const turn = (text: string, ...toolCalls: ToolCall[]): ModelTurn => ({ text, toolCalls, stop: toolCalls.length ? "tool_use" : "end" });

/** Tool results the model received on its latest turn. */
const lastToolResults = (m: { seen: AgentMessage[][] }, turnIndex: number) => {
  const msgs = m.seen[turnIndex]!;
  const tool = [...msgs].reverse().find((x) => x.role === "tool");
  if (!tool || tool.role !== "tool") throw new Error("no tool message");
  return tool.results;
};

const NOW = () => new Date("2026-10-31T12:00:00Z");
const QUERY = "Indian AI startups founded 2023 or later whose headcount grew 50% in 6 months, with founders' prior roles";

const SEARCH_INPUT = {
  filters: { op: "and", conditions: [{ field: "locations.country", type: "=", value: "IND" }, { field: "basic_info.year_founded", type: "=>", value: 2023 }, { field: "headcount.growth_percent.6m", type: "=>", value: 50 }] },
  fields: ["crustdata_company_id", "basic_info", "headcount", "locations"],
  limit: 10,
};
const PEOPLE_INPUT = {
  filters: { op: "and", conditions: [{ field: "experience.employment_details.current.company_id", type: "in", value: [101, 102] }, { field: "experience.employment_details.current.title", type: "(.)", value: "Founder" }] },
  fields: ["basic_profile", "experience"],
  limit: 4,
};
const cited = (value: unknown, ref: string, path: string) => ({ value, ref, path });

describe("runScreenAgent — multi-step plan", () => {
  it("searches companies, then people, submits; verifies every cell and emits events in order", async () => {
    const { client, log } = crustFetch({ "POST /company/search": { body: COMPANIES, credits: "0.46" }, "POST /person/search": { body: PEOPLE, credits: "0.92" } });
    const model = scriptedModel([
      turn("Plan: filter IND, founded =>2023, 6m growth =>50, then fetch founders.", call("search_companies", SEARCH_INPUT)),
      turn("2 companies match; fetching founders.", call("search_people", PEOPLE_INPUT)),
      turn(
        "Ranking by 6m growth.",
        call("submit_answer", {
          summary: "Two Indian startups match; ranked by 6-month headcount growth.",
          requested: 2,
          columns: [{ key: "founded", label: "Founded" }, { key: "growth_6m", label: "6m growth" }, { key: "country", label: "Country" }],
          filters: [
            { requirement: "Based in India", applied: "server", field: "locations.country", detail: "= IND" },
            { requirement: "Founded 2023 or later", applied: "server", field: "basic_info.year_founded", detail: "=> 2023" },
            { requirement: "AI company", applied: "client", detail: "checked names/industry" },
          ],
          rows: [
            {
              name: cited("Beta Labs", "c1", "companies[1].basic_info.name"),
              why: "Fastest 6m growth",
              cells: [
                { key: "founded", ...cited(2024, "c1", "companies[1].basic_info.year_founded") },
                { key: "growth_6m", ...cited("80%", "c1", "companies[1].headcount.growth_percent.6m") },
                { key: "country", ...cited("IND", "c1", "companies[1].locations.country") },
              ],
              people: [
                {
                  name: cited("Vikram Shah", "c2", "profiles[1].basic_profile.name"),
                  title: cited("Founder", "c2", "profiles[1].basic_profile.current_title"),
                  prior: [{ company: cited("Flipkart", "c2", "profiles[1].experience.employment_details.past[0].name"), title: cited("Product Manager", "c2", "profiles[1].experience.employment_details.past[0].title") }],
                },
              ],
            },
            {
              name: cited("Acme AI", "c1", "companies[0].basic_info.name"),
              cells: [
                { key: "founded", ...cited(2023, "c1", "companies[0].basic_info.year_founded") },
                { key: "growth_6m", ...cited(55, "c1", "$.companies[0].headcount.growth_percent.6m") },
                { key: "country", ...cited("IND", "c1", "companies[0].locations.country") },
              ],
              people: [
                {
                  name: cited("Asha Rao", "c2", "profiles[0].basic_profile.name"),
                  title: cited("Co-Founder & CEO", "c2", "profiles[0].basic_profile.current_title"),
                  prior: [{ company: cited("Google", "c2", "profiles[0].experience.employment_details.past[0].name"), title: cited("Senior Software Engineer", "c2", "profiles[0].experience.employment_details.past[0].title"), period: "2018-2022" }],
                },
              ],
            },
          ],
          caveats: ["AI focus checked from names only"],
        }),
      ),
    ]);
    const events: ScreenEvent[] = [];
    const result = await runScreenAgent({ query: QUERY, model, client, emit: (e) => events.push(e), now: NOW });

    expect(result.status).toBe("ok");
    expect(result.steps).toBe(3);
    expect(result.query).toBe(QUERY);
    expect(result.model).toEqual({ provider: "openai", model: "scripted-test-model" });
    expect(result.requested).toBe(2);
    expect(result.columns.map((c) => c.key)).toEqual(["founded", "growth_6m", "country"]);
    expect(result.rows.map((r) => [r.rank, r.name.value])).toEqual([[1, "Beta Labs"], [2, "Acme AI"]]);
    expect(result.rows[0]!.why).toBe("Fastest 6m growth");

    // every cell verified, with a citation naming the call, endpoint and path
    const beta = result.rows[0]!;
    expect(beta.cells.every((c) => c.status === "verified")).toBe(true);
    expect(beta.cells[1]).toMatchObject({ key: "growth_6m", label: "6m growth", value: "80%", status: "verified", citation: { ref: "c1", method: "POST", endpoint: "/company/search", path: "companies[1].headcount.growth_percent.6m" } });
    expect(beta.cells[1]!.citation!.retrievedAt).toEqual(expect.any(String));
    expect(beta.name.citation).toMatchObject({ ref: "c1", endpoint: "/company/search" });

    // founders and their prior roles verified against the person search
    const vikram = beta.people[0]!;
    expect(vikram.name).toMatchObject({ value: "Vikram Shah", status: "verified", citation: { ref: "c2", endpoint: "/person/search" } });
    expect(vikram.prior[0]!.company).toMatchObject({ value: "Flipkart", status: "verified", citation: { ref: "c2", method: "POST", endpoint: "/person/search", path: "profiles[1].experience.employment_details.past[0].name" } });
    expect(vikram.prior[0]!.title).toMatchObject({ value: "Product Manager", status: "verified" });
    expect(result.rows[1]!.people[0]!.prior[0]).toMatchObject({ company: { value: "Google", status: "verified" }, title: { value: "Senior Software Engineer", status: "verified" }, period: "2018-2022" });
    expect(result.citationStats).toEqual({ verified: 16, corrected: 0, unavailable: 0 });
    expect(result.filters).toEqual([
      { requirement: "Based in India", applied: "server", field: "locations.country", detail: "= IND" },
      { requirement: "Founded 2023 or later", applied: "server", field: "basic_info.year_founded", detail: "=> 2023" },
      { requirement: "AI company", applied: "client", detail: "checked names/industry" },
    ]);
    expect(result.caveats).toEqual(["AI focus checked from names only"]);

    // ledger + credits from X-Credits-Used
    expect(result.calls.map((c) => [c.ref, c.tool, c.path, c.status, c.creditsUsed, c.rows, c.totalCount])).toEqual([
      ["c1", "search_companies", "/company/search", "ok", 0.46, 2, 2],
      ["c2", "search_people", "/person/search", "ok", 0.92, 2, 2],
    ]);
    expect(result.credits).toEqual({ used: 1.38, cap: DEFAULT_CREDIT_CAP });
    expect(log.map((l) => `${l.method} ${l.path}`)).toEqual(["POST /company/search", "POST /person/search"]);
    expect(log[0]!.body).toMatchObject({ filters: SEARCH_INPUT.filters, limit: 10, fields: SEARCH_INPUT.fields });
    expect(log[0]!.headers.authorization).toBe("Bearer test-key-not-real");

    // events in order
    expect(events.map((e) => e.type)).toEqual(["start", "thinking", "plan", "tool_call", "tool_result", "thinking", "plan", "tool_call", "tool_result", "thinking", "plan", "verify", "final"]);
    expect(events[0]).toMatchObject({ type: "start", query: QUERY, at: "2026-10-31T12:00:00.000Z" });
    expect(events[3]).toMatchObject({ type: "tool_call", step: 1, ref: "c1", tool: "search_companies", endpoint: "POST /company/search", estCredits: estimateCredits("search_companies", SEARCH_INPUT) });
    expect(events[4]).toMatchObject({ type: "tool_result", step: 1, ref: "c1", status: "ok", rows: 2, totalCount: 2, creditsUsed: 0.46 });
    expect(events[7]).toMatchObject({ type: "tool_call", step: 2, ref: "c2", endpoint: "POST /person/search" });
    expect(events[11]).toMatchObject({ type: "verify", stats: { verified: 16, corrected: 0, unavailable: 0 } });
    expect(events[12]).toEqual({ type: "final", result });

    // what the model saw: system prompt, tool list incl. submit_answer, tool result JSON with ref + pruned response
    expect(model.systems[0]).toContain("Today is 2026-10-31");
    expect(model.toolNames[0]).toEqual(expect.arrayContaining(["search_companies", "search_people", "enrich_companies", "enrich_person", "submit_answer"]));
    const r1 = JSON.parse(lastToolResults(model, 1)[0]!.content);
    expect(r1).toMatchObject({ ref: "c1", endpoint: "POST /company/search", response: { total_count: 2 } });
    expect(r1.response.companies[1].headcount.growth_percent["6m"]).toBe(80);
    expect(r1.response.companies[0]).not.toHaveProperty("funding"); // nulls pruned for the model
  });
});

describe("runScreenAgent — relax and re-query", () => {
  it("re-queries with a relaxed filter after an empty result and reports the relaxation", async () => {
    const strict = { ...SEARCH_INPUT, filters: { field: "headcount.growth_percent.6m", type: "=>", value: 100 } };
    const relaxed = { ...SEARCH_INPUT, filters: { field: "headcount.growth_percent.6m", type: "=>", value: 50 } };
    const { client, log } = crustFetch({ "POST /company/search": [{ body: EMPTY, credits: "0" }, { body: COMPANIES, credits: "0.46" }] });
    const model = scriptedModel([
      turn("Search with 100% growth.", call("search_companies", strict)),
      turn("No matches at 100%; relaxing growth to 50%.", call("search_companies", relaxed)),
      turn(
        "",
        call("submit_answer", {
          summary: "Relaxed growth from 100% to 50%; two matches.",
          columns: [{ key: "growth_6m", label: "6m growth" }],
          filters: [{ requirement: "Headcount doubled in 6 months", applied: "server", field: "headcount.growth_percent.6m", detail: "=> 50", relaxed: "Lowered from => 100 to => 50: no companies matched at 100%" }],
          rows: [{ name: cited("Beta Labs", "c2", "companies[1].basic_info.name"), cells: [{ key: "growth_6m", ...cited(80, "c2", "companies[1].headcount.growth_percent.6m") }], people: [] }],
        }),
      ),
    ]);
    const result = await runScreenAgent({ query: "startups that doubled headcount", model, client, now: NOW });

    expect(result.status).toBe("ok");
    expect(result.calls).toHaveLength(2);
    expect(result.calls.map((c) => [c.tool, c.status, c.rows, c.totalCount])).toEqual([["search_companies", "ok", 0, 0], ["search_companies", "ok", 2, 2]]);
    expect(log.filter((l) => l.path === "/company/search").map((l) => (l.body.filters as { value: number }).value)).toEqual([100, 50]);
    expect(result.filters[0]).toMatchObject({ applied: "server", relaxed: expect.stringContaining("Lowered from => 100 to => 50") });
    expect(result.rows[0]!.cells[0]).toMatchObject({ value: 80, status: "verified", citation: { ref: "c2" } });
    // the empty result was passed back to the model
    expect(JSON.parse(lastToolResults(model, 1)[0]!.content)).toMatchObject({ ref: "c1", response: { total_count: 0 } });
  });
});

describe("runScreenAgent — citation verification", () => {
  it("corrects wrong numbers and drops uncited, dangling or null values", async () => {
    const { client } = crustFetch({ "POST /company/search": { body: COMPANIES, credits: "0.46" } });
    const model = scriptedModel([
      turn("search", call("search_companies", SEARCH_INPUT)),
      turn(
        "submit",
        call("submit_answer", {
          summary: "One match.",
          columns: [
            { key: "growth_6m", label: "6m growth" },
            { key: "headcount", label: "Headcount" },
            { key: "founded", label: "Founded" },
            { key: "domain", label: "Domain" },
            { key: "funding", label: "Funding" },
            { key: "hq", label: "HQ" },
            { key: "missing_col", label: "Not provided" },
          ],
          filters: [{ requirement: "weird", applied: "bogus", detail: "x" }],
          rows: [
            {
              name: cited("Acme AI", "c1", "companies[0].basic_info.name"),
              cells: [
                { key: "growth_6m", ...cited(70, "c1", "companies[0].headcount.growth_percent.6m") }, // wrong number
                { key: "headcount", value: 40 }, // no ref / path
                { key: "founded", value: 2023, ref: "c1" }, // ref but no path
                { key: "domain", ...cited("acme.ai", "c7", "companies[0].basic_info.primary_domain") }, // call does not exist
                { key: "funding", ...cited(null, "c1", "companies[0].funding") }, // null in Crustdata
                { key: "hq", value: null }, // null, uncited
              ],
              people: [],
            },
          ],
        }),
      ),
    ]);
    const events: ScreenEvent[] = [];
    const result = await runScreenAgent({ query: "q", model, client, emit: (e) => events.push(e), now: NOW });
    const [growth, headcount, founded, domain, funding, hq, missing] = result.rows[0]!.cells;

    expect(growth).toMatchObject({ status: "corrected", value: 55, claimed: 70, citation: { ref: "c1", endpoint: "/company/search", path: "companies[0].headcount.growth_percent.6m" } });
    expect(headcount).toMatchObject({ status: "unavailable", value: null, claimed: 40, reason: expect.stringMatching(/No citation/) });
    expect(headcount).not.toHaveProperty("citation");
    expect(founded).toMatchObject({ status: "unavailable", value: null, claimed: 2023, reason: expect.stringMatching(/No citation path/), citation: { ref: "c1", path: "" } });
    expect(domain).toMatchObject({ status: "unavailable", value: null, claimed: "acme.ai", reason: expect.stringContaining("c7 does not exist") });
    expect(funding).toMatchObject({ status: "unavailable", value: null, reason: expect.stringMatching(/no value/) });
    expect(funding).not.toHaveProperty("claimed");
    expect(hq).toMatchObject({ status: "unavailable", value: null, reason: "Crustdata had no data for this." });
    expect(missing).toMatchObject({ key: "missing_col", status: "unavailable", reason: "Not provided." });
    expect(result.citationStats).toEqual({ verified: 1, corrected: 1, unavailable: 6 });
    expect(result.filters[0]!.applied).toBe("unavailable"); // invalid enum normalized
    expect(events.find((e) => e.type === "verify")).toMatchObject({ text: expect.stringContaining("1 verified, 1 corrected, 6 unavailable") });
  });

  it("treats citations to a failed call as unavailable", async () => {
    const { client } = crustFetch({ "POST /company/search": { status: 400, body: { error: "bad filter" } } });
    const model = scriptedModel([
      turn("", call("search_companies", SEARCH_INPUT)),
      turn("", call("submit_answer", { summary: "s", columns: [], filters: [], rows: [{ name: cited("Acme AI", "c1", "companies[0].basic_info.name"), cells: [], people: [] }] })),
    ]);
    const result = await runScreenAgent({ query: "q", model, client, now: NOW });
    expect(result.rows[0]!.name).toMatchObject({ status: "unavailable", value: null, reason: expect.stringContaining("c1 does not exist or failed") });
  });

  it("rejects an empty submit_answer and lets the model try again", async () => {
    const { client } = crustFetch({});
    const model = scriptedModel([turn("", call("submit_answer", {})), turn("", call("submit_answer", { summary: "Nothing matched.", columns: [], filters: [], rows: [] }))]);
    const result = await runScreenAgent({ query: "q", model, client, now: NOW });
    expect(lastToolResults(model, 1)[0]).toMatchObject({ isError: true, content: expect.stringContaining("needs a summary and rows") });
    expect(result).toMatchObject({ status: "ok", summary: "Nothing matched.", rows: [], steps: 2 });
  });
});

describe("runScreenAgent — tool errors", () => {
  it("passes a Crustdata 400 back to the model as a tool error and records it in the ledger", async () => {
    const { client, log } = crustFetch({ "POST /company/search": { status: 400, body: { error: "Unknown filter field basic_info.foundedd" } } });
    const bad = call("search_companies", { filters: { field: "basic_info.foundedd", type: "=", value: 2023 }, limit: 5 });
    const model = scriptedModel([
      turn("", bad),
      turn("Field name was wrong; giving up.", call("submit_answer", { summary: "The search failed.", columns: [], filters: [], rows: [] })),
    ]);
    const events: ScreenEvent[] = [];
    const result = await runScreenAgent({ query: "q", model, client, emit: (e) => events.push(e), now: NOW });

    expect(log).toHaveLength(1); // 400 is not retried
    const [r] = lastToolResults(model, 1);
    expect(r).toMatchObject({ id: bad.id, isError: true });
    expect(r!.content).toContain("search_companies failed with HTTP 400");
    expect(r!.content).toContain("Unknown filter field basic_info.foundedd");
    expect(r!.content).toContain("fix the field name");
    expect(result.calls).toEqual([expect.objectContaining({ ref: "c1", status: "error", upstreamStatus: 400, creditsUsed: null, error: expect.stringContaining("Crustdata 400") })]);
    expect(result.credits.used).toBe(0);
    expect(events.find((e) => e.type === "tool_result")).toMatchObject({ ref: "c1", status: "error", error: expect.stringContaining("HTTP 400") });
    expect(result.status).toBe("ok");
  });

  it("surfaces a persistent 429 after the client's bounded retries", async () => {
    const { client, log } = crustFetch({ "POST /company/search": { status: 429, body: { error: "rate limited" }, headers: { "retry-after": "0" } } });
    const model = scriptedModel([turn("", call("search_companies", SEARCH_INPUT)), turn("", call("submit_answer", { summary: "Rate limited.", columns: [], filters: [], rows: [] }))]);
    const result = await runScreenAgent({ query: "q", model, client, now: NOW });

    expect(log).toHaveLength(4); // first try + 3 retries (http.ts)
    expect(result.calls[0]).toMatchObject({ status: "error", upstreamStatus: 429 });
    const [r] = lastToolResults(model, 1);
    expect(r).toMatchObject({ isError: true, content: expect.stringContaining("HTTP 429") });
    expect(r!.content).toContain("rate limited after retries");
  });

  it("returns invalid input errors from the executor without calling Crustdata", async () => {
    const { client, log } = crustFetch({});
    const model = scriptedModel([turn("", call("search_people", { limit: 3 })), turn("", call("submit_answer", { summary: "s", columns: [], filters: [], rows: [] }))]);
    const result = await runScreenAgent({ query: "q", model, client, now: NOW });
    expect(log).toHaveLength(0);
    expect(lastToolResults(model, 1)[0]).toMatchObject({ isError: true, content: "search_people failed: search_people needs filters." });
    expect(result.calls[0]).toMatchObject({ status: "error", error: "search_people needs filters." });
  });

  it("answers an unknown tool with an error and keeps going", async () => {
    const { client, log } = crustFetch({ "POST /company/search": { body: COMPANIES, credits: "0.46" } });
    const model = scriptedModel([
      turn("", call("search_unicorns", { country: "IND" })),
      turn("", call("search_companies", SEARCH_INPUT)),
      turn("", call("submit_answer", { summary: "s", columns: [], filters: [], rows: [{ name: cited("Acme AI", "c1", "companies[0].basic_info.name"), cells: [], people: [] }] })),
    ]);
    const events: ScreenEvent[] = [];
    const result = await runScreenAgent({ query: "q", model, client, emit: (e) => events.push(e), now: NOW });

    const [r] = lastToolResults(model, 1);
    expect(r).toMatchObject({ isError: true, content: expect.stringMatching(/^Unknown tool search_unicorns\. Available: search_companies, search_people/) });
    expect(events.filter((e) => e.type === "tool_result").map((e) => e.type === "tool_result" && [e.tool, e.status])).toEqual([["search_unicorns", "error"], ["search_companies", "ok"]]);
    expect(result.calls.map((c) => c.ref)).toEqual(["c1"]); // unknown tools take no ledger slot
    expect(log).toHaveLength(1);
    expect(result.rows[0]!.name.status).toBe("verified");
    expect(result.status).toBe("ok");
  });
});

describe("runScreenAgent — caps", () => {
  it("refuses a call whose estimate would exceed the credit cap, without fetching", async () => {
    const big = { ...SEARCH_INPUT, limit: 50 };
    const est = estimateCredits("search_companies", big);
    expect(est).toBeGreaterThan(1);
    const { client, log } = crustFetch({ "POST /company/search": { body: COMPANIES, credits: "0.46" } });
    const model = scriptedModel([
      turn("", call("search_companies", big)),
      turn("", call("submit_answer", { summary: "Budget too small.", columns: [], filters: [], rows: [] })),
    ]);
    const events: ScreenEvent[] = [];
    const result = await runScreenAgent({ query: "q", model, client, creditCap: 1, emit: (e) => events.push(e), now: NOW });

    expect(log).toHaveLength(0);
    expect(result.calls).toEqual([expect.objectContaining({ ref: "c1", status: "refused", creditsEstimated: est, error: "credit cap" })]);
    expect(result.credits).toEqual({ used: 0, cap: 1 });
    expect(lastToolResults(model, 1)[0]).toMatchObject({ isError: true, content: expect.stringContaining(`Refused: this call could cost up to ${est} credits`) });
    expect(events.find((e) => e.type === "tool_result")).toMatchObject({ status: "refused" });
    expect(model.systems[0]).toContain("at most 1 Crustdata credits");
  });

  it("stops after maxSteps without a submit: incomplete result, last-turn warning, final event", async () => {
    const { client, log } = crustFetch({ "POST /company/search": { body: COMPANIES, credits: "0.1" } });
    const model = scriptedModel(Array.from({ length: 5 }, () => () => turn("still searching", call("search_companies", { ...SEARCH_INPUT, limit: 1 }))));
    const events: ScreenEvent[] = [];
    const result = await runScreenAgent({ query: "q", model, client, maxSteps: 3, emit: (e) => events.push(e), now: NOW });

    expect(result).toMatchObject({ status: "incomplete", steps: 3, rows: [], columns: [], citationStats: { verified: 0, corrected: 0, unavailable: 0 } });
    expect(result.summary).toContain("Stopped after 3 model turns");
    expect(result.caveats[0]).toContain("step limit (3)");
    expect(result.calls).toHaveLength(3);
    expect(log).toHaveLength(3);
    expect(model.seen).toHaveLength(3);
    const last = model.seen[2]!.at(-1)!;
    expect(last).toMatchObject({ role: "user", text: expect.stringContaining("This is your last turn") });
    expect(events.at(-1)).toEqual({ type: "final", result });
    expect(events.filter((e) => e.type === "final")).toHaveLength(1);
    expect(events.some((e) => e.type === "verify")).toBe(false);
  });

  it("nudges once when the model stops calling tools, then gives up as incomplete", async () => {
    const { client, log } = crustFetch({});
    const model = scriptedModel([turn("I think the answer is Acme."), turn("Really, it's Acme."), turn("never reached")]);
    const events: ScreenEvent[] = [];
    const result = await runScreenAgent({ query: "q", model, client, emit: (e) => events.push(e), now: NOW });

    expect(model.seen).toHaveLength(2);
    expect(model.seen[1]!.at(-1)).toMatchObject({ role: "user", text: expect.stringContaining("finish by calling submit_answer") });
    expect(result).toMatchObject({ status: "incomplete", steps: 2, calls: [] });
    expect(log).toHaveLength(0);
    expect(events.map((e) => e.type)).toEqual(["start", "thinking", "plan", "thinking", "plan", "final"]);
  });
});

describe("runScreenAgent — model failures", () => {
  it("rejects when the model API errors", async () => {
    const { client } = crustFetch({});
    const model = scriptedModel([new ModelApiError("OpenAI", 500, "server exploded")]);
    const events: ScreenEvent[] = [];
    await expect(runScreenAgent({ query: "q", model, client, emit: (e) => events.push(e), now: NOW })).rejects.toThrow("OpenAI API 500: server exploded");
    expect(events.map((e) => e.type)).toEqual(["start", "thinking"]);
  });

  it("rejects when the model fails mid-run, after tool calls", async () => {
    const { client } = crustFetch({ "POST /company/search": { body: COMPANIES, credits: "0.46" } });
    const model = scriptedModel([turn("", call("search_companies", SEARCH_INPUT)), new ModelApiError("OpenAI", 429, "slow down")]);
    await expect(runScreenAgent({ query: "q", model, client, now: NOW })).rejects.toBeInstanceOf(ModelApiError);
  });
});

describe("verifyAnswer filters", () => {
  it("keeps a real relaxation note and drops 'None'-style placeholders", async () => {
    const { verifyAnswer } = await import("./agent");
    const out = verifyAnswer(
      {
        summary: "s",
        columns: [],
        rows: [],
        filters: [
          { requirement: "a", applied: "server", detail: "d", relaxed: "None" },
          { requirement: "b", applied: "client", detail: "d", relaxed: "None; scope includes X" },
          { requirement: "c", applied: "server", detail: "d", relaxed: "Lowered growth from 50% to 30%: only 4 matches" },
        ],
      },
      [],
      new Map(),
    );
    expect(out.filters.map((f) => f.relaxed)).toEqual([undefined, undefined, "Lowered growth from 50% to 30%: only 4 matches"]);
  });
});

describe("runScreenAgent — client abort", () => {
  it("stops before the next model turn and the next Crustdata call once the signal aborts (no more credits)", async () => {
    const { client, log } = crustFetch({ "POST /company/search": { body: COMPANIES, credits: "0.46" }, "POST /person/search": { body: PEOPLE, credits: "0.92" } });
    const ac = new AbortController();
    const model = scriptedModel([
      turn("Search first.", call("search_companies", SEARCH_INPUT)),
      turn("Then people.", call("search_people", PEOPLE_INPUT)),
    ]);
    const events: ScreenEvent[] = [];
    const result = await runScreenAgent({ query: QUERY, model, client, now: NOW, signal: ac.signal, emit: (e) => { events.push(e); if (e.type === "tool_result") ac.abort(); } });
    expect(model.seen).toHaveLength(1); // the second turn never started
    expect(log.filter((l) => l.path === "/company/search")).toHaveLength(1);
    expect(log.filter((l) => l.path === "/person/search")).toHaveLength(0);
    expect(result.status).toBe("incomplete");
    expect(result.caveats.join(" ")).toMatch(/disconnect|stopped|abort/i);
  });
  it("does not start at all when the signal is already aborted", async () => {
    const { client, log } = crustFetch({});
    const ac = new AbortController();
    ac.abort();
    const model = scriptedModel([]);
    const result = await runScreenAgent({ query: QUERY, model, client, now: NOW, signal: ac.signal });
    expect(model.seen).toHaveLength(0);
    expect(log).toHaveLength(0);
    expect(result.status).toBe("incomplete");
  });
});
