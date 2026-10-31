// Crustdata tools exposed to the research agent. Each execution goes through the app's CrustdataClient (rate limits,
// 429 back-off, cache), is recorded in a call ledger with its body, credits and retrieval time, and its raw response
// is kept so the final answer's citations can be resolved against it. The model sees a pruned copy (long text cut,
// arrays capped) whose array indices match the raw response, so paths it cites are valid in both.
import type { CrustdataClient } from "@/lib/crustdata";
import type { LedgerCall, ToolDef, ToolExecution } from "./contract";
import type { ToolSpec } from "./model";
import { EXTRA_TOOLS } from "./tools/index";

export type ToolContext = {
  client: CrustdataClient;
  ledger: LedgerCall[];
  raw: Map<string, unknown>;
  creditCap: number;
};

const FILTER_NODE = {
  type: "object",
  description:
    'A condition {"field","type","value"} or a group {"op":"and"|"or","conditions":[...]}. Operators: =, !=, <, >, =<, =>, in, not_in, is_null, is_not_null, (.) fuzzy text, [.] exact token. Use =< and => (never <= or >=). in/not_in take arrays.',
};

const COMPANY_FIELD_GROUPS = ["crustdata_company_id", "basic_info", "headcount", "locations", "taxonomy", "funding", "followers", "roles", "revenue"];

const SPECS: ToolSpec[] = [
  {
    name: "search_companies",
    description:
      "POST /company/search — filter (and optionally rank) Crustdata's company index. Filterable fields include basic_info.year_founded, basic_info.employee_count_range, basic_info.company_type, basic_info.markets, locations.country (full name or ISO alpha-3, e.g. IND, USA), locations.headquarters, headcount.total, headcount.growth_percent.{1m,3m,6m,12m} (percent, 50 = +50%), headcount.growth_absolute.{1m,3m,6m,12m}, taxonomy.professional_network_industry, taxonomy.categories, taxonomy.professional_network_specialities, funding.last_round_type, funding.total_investment_usd, funding.last_fundraise_date, followers.count. Growth paths are filterable but NOT sortable. Sortable: headcount.total, basic_info.year_founded, funding.total_investment_usd, followers.count. `search_query` adds hybrid semantic ranking (useful for concepts with no field, e.g. 'B2B SaaS'); with it total_count is null. Cost ≈0.03 credits/row + 0.2/row if headcount or funding returned/filtered + 0.1/row for taxonomy.",
    input_schema: {
      type: "object",
      properties: {
        filters: FILTER_NODE,
        search_query: { type: "string", description: "Optional natural-language ranking query (hybrid search)." },
        fields: { type: "array", items: { type: "string" }, description: `Field groups or dotted fields to return. Groups: ${COMPANY_FIELD_GROUPS.join(", ")}.` },
        sorts: { type: "array", items: { type: "object", properties: { field: { type: "string" }, order: { type: "string", enum: ["asc", "desc"] } }, required: ["field", "order"] } },
        limit: { type: "integer", minimum: 1, maximum: 50 },
        cursor: { type: "string", description: "next_cursor from a previous identical search, for the next page." },
      },
      required: ["limit"],
    },
  },
  {
    name: "search_people",
    description:
      "POST /person/search — find people. Useful fields: experience.employment_details.current.company_id (crustdata_company_id; `in` with an array works for several companies at once), experience.employment_details.current.title ((.) 'Founder' matches Co-Founder, Founder & CEO…), experience.employment_details.past.company_name, basic_profile.location.country, basic_profile.name. Return fields: basic_profile, experience, education, social_handles. Cost ≈0.03/row + 0.1/row when filtering on experience + 0.1/row when returning experience.",
    input_schema: {
      type: "object",
      properties: {
        filters: FILTER_NODE,
        fields: { type: "array", items: { type: "string" } },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      required: ["filters", "limit"],
    },
  },
  {
    name: "enrich_companies",
    description: "POST /company/enrich — full company profile (headcount history, funding, web traffic, people). 2 credits per company; use only when search fields are not enough. Max 5 per call.",
    input_schema: {
      type: "object",
      properties: {
        crustdata_company_ids: { type: "array", items: { type: "integer" } },
        domains: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "enrich_person",
    description: "POST /person/enrich — full profile for LinkedIn URLs (experience, education). 1 credit each, max 5 per call. Prefer search_people with fields [basic_profile, experience] for founders.",
    input_schema: {
      type: "object",
      properties: { linkedin_urls: { type: "array", items: { type: "string" }, maxItems: 5 } },
      required: ["linkedin_urls"],
    },
  },
];

// Live-calibrated 2026-10-31: basic_info + locations + headcount + taxonomy cost 0.53 credits/row on /company/search.
const PER_ROW = { base: 0.03, premium: 0.2, taxonomy: 0.1, experienceFilter: 0.1, experienceField: 0.1 };
const round2 = (n: number) => Math.round(n * 100) / 100;

const mentions = (x: unknown, re: RegExp) => re.test(JSON.stringify(x ?? null));

/** Worst-case credit estimate for a call (used for the cap before the call runs). */
export function estimateCredits(tool: string, input: Record<string, unknown>): number {
  if (tool === "search_companies") {
    const limit = Number(input.limit ?? 10);
    const fields = (input.fields as string[] | undefined) ?? [];
    let row = PER_ROW.base;
    const used = [fields.length ? fields : ["basic_info", "headcount", "locations", "taxonomy"], input.filters];
    if (mentions(used, /headcount/)) row += PER_ROW.premium;
    if (mentions(used, /funding/)) row += PER_ROW.premium;
    if (mentions(used, /locations|roles|followers|revenue/)) row += PER_ROW.premium;
    if (mentions(used, /taxonomy/)) row += PER_ROW.taxonomy;
    return round2(limit * row);
  }
  if (tool === "search_people") {
    const limit = Number(input.limit ?? 10);
    let row = PER_ROW.base;
    if (mentions(input.filters, /experience/)) row += PER_ROW.experienceFilter;
    if (mentions(input.fields, /experience/)) row += PER_ROW.experienceField;
    return round2(limit * row);
  }
  if (tool === "enrich_companies") return 2 * (((input.crustdata_company_ids as unknown[]) ?? []).length + ((input.domains as unknown[]) ?? []).length);
  if (tool === "enrich_person") return ((input.linkedin_urls as unknown[]) ?? []).length;
  return 0;
}

export const creditsSpent = (ledger: LedgerCall[]) => round2(ledger.reduce((s, c) => s + (c.status === "ok" ? (c.creditsUsed ?? c.creditsEstimated) : 0), 0));

/**
 * Copy for the model: strings cut to `maxStr`, nested arrays to `maxArr` (indices preserved), noisy keys dropped.
 * Top-level result lists (companies, profiles) are never cut — every returned row was paid for.
 */
export function prune(v: unknown, maxStr = 280, maxArr = 12, depth = 0): unknown {
  if (typeof v === "string") return v.length > maxStr ? `${v.slice(0, maxStr)}…` : v;
  if (Array.isArray(v)) return (depth <= 1 ? v : v.slice(0, maxArr)).map((x) => prune(x, maxStr, maxArr, depth + 1));
  if (v && typeof v === "object") {
    if (depth > 8) return "…";
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      if (/^(skills|summary|logo_permalink|profile_picture_permalink|all_office_addresses|description_html|certifications|honors)$/.test(k)) continue;
      if (x === null || (Array.isArray(x) && x.length === 0)) continue;
      out[k] = prune(x, maxStr, maxArr, depth + 1);
    }
    return out;
  }
  return v;
}

const clampInt = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

const spec = (name: string) => SPECS.find((s) => s.name === name)!;
const run = (path: string, body: Record<string, unknown>, call: Promise<{ data: unknown; meta: ToolExecution["meta"] }>): Promise<ToolExecution> =>
  call.then(({ data, meta }) => ({ method: "POST", path, body, data, meta }));

/** The core Crustdata tools. Extra tools (src/lib/agent/tools/*.ts) are appended via EXTRA_TOOLS. */
export const CORE_TOOLS: ToolDef[] = [
  {
    spec: spec("search_companies"),
    estimateCredits: (input) => estimateCredits("search_companies", input),
    execute: (input, client) => {
      const body: Record<string, unknown> = {
        ...(input.filters ? { filters: input.filters } : {}),
        ...(typeof input.search_query === "string" && input.search_query.trim() ? { search: { query: input.search_query.trim().slice(0, 500), mode: "hybrid" } } : {}),
        fields: Array.isArray(input.fields) && input.fields.length ? input.fields : ["crustdata_company_id", "basic_info", "headcount", "locations", "taxonomy"],
        ...(Array.isArray(input.sorts) && input.sorts.length ? { sorts: input.sorts } : {}),
        limit: clampInt(input.limit, 1, 50, 10),
        ...(typeof input.cursor === "string" ? { cursor: input.cursor } : {}),
      };
      if (!body.filters && !body.search) throw new Error("search_companies needs filters or a search_query.");
      return run("/company/search", body, client.searchCompanies(body as never));
    },
  },
  {
    spec: spec("search_people"),
    estimateCredits: (input) => estimateCredits("search_people", input),
    execute: (input, client) => {
      if (!input.filters) throw new Error("search_people needs filters.");
      const body = { filters: input.filters, fields: Array.isArray(input.fields) && input.fields.length ? input.fields : ["basic_profile", "experience", "social_handles"], limit: clampInt(input.limit, 1, 50, 10) };
      return run("/person/search", body, client.searchPeople(body));
    },
  },
  {
    spec: spec("enrich_companies"),
    estimateCredits: (input) => estimateCredits("enrich_companies", input),
    execute: (input, client) => {
      const ids = ((input.crustdata_company_ids as unknown[]) ?? []).map(Number).filter(Number.isSafeInteger).slice(0, 5);
      const domains = ((input.domains as unknown[]) ?? []).map(String).filter(Boolean).slice(0, 5 - ids.length);
      if (!ids.length && !domains.length) throw new Error("enrich_companies needs crustdata_company_ids or domains.");
      const body = ids.length ? { crustdata_company_ids: ids } : { domains };
      return run("/company/enrich", body, client.enrichCompanies(body));
    },
  },
  {
    spec: spec("enrich_person"),
    estimateCredits: (input) => estimateCredits("enrich_person", input),
    execute: (input, client) => {
      const urls = ((input.linkedin_urls as unknown[]) ?? []).map(String).filter((u) => /linkedin\.com\//i.test(u)).slice(0, 5);
      if (!urls.length) throw new Error("enrich_person needs LinkedIn profile URLs.");
      const body = { professional_network_profile_urls: urls, fields: ["basic_profile", "experience", "education", "social_handles"] };
      return run("/person/enrich", body, client.enrichPeople(body));
    },
  },
];

/** Every tool the agent can call, by name. Later entries do not override core tools. */
export function toolRegistry(extra: ToolDef[] = EXTRA_TOOLS): Map<string, ToolDef> {
  const m = new Map<string, ToolDef>();
  for (const t of [...CORE_TOOLS, ...extra]) if (!m.has(t.spec.name)) m.set(t.spec.name, t);
  return m;
}

const rowsOf = (data: unknown): { rows?: number; totalCount?: number | null } => {
  const d = data as { companies?: unknown[]; profiles?: unknown[]; job_listings?: unknown[]; results?: unknown[]; total_count?: number | null };
  if (Array.isArray(d?.companies)) return { rows: d.companies.length, totalCount: d.total_count ?? null };
  if (Array.isArray(d?.profiles)) return { rows: d.profiles.length, totalCount: d.total_count ?? null };
  if (Array.isArray(d?.job_listings)) return { rows: d.job_listings.length, totalCount: d.total_count ?? null }; // search_jobs (instance C)
  if (Array.isArray(d?.results)) return { rows: d.results.length }; // web_search (instance C)
  if (Array.isArray(data)) return { rows: data.length };
  return {};
};

/** Run one tool call through the registry. Never throws: failures come back as `{ isError: true }` text for the model. */
export async function runTool(ctx: ToolContext, registry: Map<string, ToolDef>, tool: string, input: Record<string, unknown>): Promise<{ ref?: string; content: string; isError?: boolean }> {
  const def = registry.get(tool);
  if (!def) return { content: `Unknown tool ${tool}. Available: ${[...registry.keys()].join(", ")}.`, isError: true };
  const ref = `c${ctx.ledger.length + 1}`;
  const est = def.estimateCredits(input);
  const spent = creditsSpent(ctx.ledger);
  if (spent + est > ctx.creditCap) {
    ctx.ledger.push({ ref, tool, method: "POST", path: "", body: input, status: "refused", creditsUsed: null, creditsEstimated: est, retrievedAt: null, cached: false, ms: 0, error: "credit cap" });
    return { ref, content: `Refused: this call could cost up to ${est} credits; ${spent} of the ${ctx.creditCap}-credit cap is already used. Use a smaller limit or fewer fields, or answer with what you have.`, isError: true };
  }
  const t0 = Date.now();
  try {
    const x = await def.execute(input, ctx.client);
    const used = x.meta.creditsUsed != null && x.meta.creditsUsed !== "" && Number.isFinite(Number(x.meta.creditsUsed)) ? Number(x.meta.creditsUsed) : null;
    ctx.raw.set(ref, x.data);
    ctx.ledger.push({ ref, tool, method: x.method, path: x.path, body: x.body, status: "ok", creditsUsed: x.meta.cached ? 0 : used, creditsEstimated: est, retrievedAt: x.meta.retrievedAt, cached: x.meta.cached, ms: Date.now() - t0, ...rowsOf(x.data), ...(x.meta.keyUsed === "backup" ? { key: "backup" as const, note: x.meta.keyNote } : {}) });
    const total = creditsSpent(ctx.ledger);
    const credits = { this_call: used ?? est, used_so_far: total, remaining: Math.max(0, Math.round((ctx.creditCap - total) * 100) / 100) };
    return { ref, content: JSON.stringify({ ref, endpoint: `${x.method} ${x.path}`, credits, response: prune(x.data) }) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = typeof (e as { status?: unknown }).status === "number" ? ((e as { status: number }).status) : undefined;
    ctx.ledger.push({ ref, tool, method: "POST", path: "", body: input, status: "error", creditsUsed: null, creditsEstimated: est, retrievedAt: null, cached: false, ms: Date.now() - t0, error: msg, ...(status ? { upstreamStatus: status } : {}) });
    const hint = status === 429 ? " (rate limited after retries — wait or make fewer calls)" : status === 400 ? " (request rejected — fix the field name or filter shape and retry)" : "";
    return { ref, content: `${tool} failed${status ? ` with HTTP ${status}` : ""}: ${msg}${hint}`, isError: true };
  }
}
