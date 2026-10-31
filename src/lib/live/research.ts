// Live company research for the deal page: identify → enrich, then founders / jobs / web search / comparables in
// parallel. Every call reports status, latency and credits; one failing call never hides the others, and an empty
// identify `matches[]` is "no_match" — errors are never reported as no-match.
import type { CrustdataClient } from "@/lib/crustdata";
import { companyFields } from "@/lib/numbers/company-fields";
import { comparableCompaniesSearchBody } from "@/lib/crustdata/company-queries";
import { COMPANY_ENRICH_FIELD_GROUPS } from "@/lib/crustdata/enrich-fields";
import { jobSearchByCompanyId } from "@/lib/crustdata/job-queries";
import { founderPersonSearchBody, linkedInPersonEnrichBody } from "@/lib/crustdata/person-queries";
import type { CompanyEnrichData, CrustdataCallMeta, PersonEnrichData } from "@/lib/crustdata/types";
import { CrustdataMalformedResponseError } from "@/lib/crustdata/http";
import { firstMatch, normalizeComps, normalizeCompany, normalizeJobs, normalizeNews, normalizePerson } from "./normalize";
import type { Peer } from "@/lib/numbers/local";
import type { CompanyLookup, IdentifyData, LiveCall, LiveComp, LiveCompany, LiveJobs, LiveNews, LivePerson, PersonLookup, ResearchResult } from "./types";

export type CallSpec = Pick<LiveCall, "id" | "method" | "path" | "body">;

export const fromMeta = <T>(spec: CallSpec, meta: CrustdataCallMeta, status: LiveCall["status"], data?: T): LiveCall<T> => ({
  ...spec,
  status,
  ms: meta.latencyMs,
  cached: meta.cached,
  retrievedAt: meta.retrievedAt,
  creditsUsed: meta.creditsUsed,
  ...(meta.stale ? { stale: true, note: meta.staleNote } : {}),
  ...(data === undefined ? {} : { data }),
});

function errorCall<T>(spec: CallSpec, e: unknown, ms: number): LiveCall<T> {
  return { ...spec, status: "error", ms, cached: false, retrievedAt: null, creditsUsed: null, error: e instanceof Error ? e.message : String(e) };
}

/** Run one call; failures become an error LiveCall instead of rejecting the whole research. */
export async function attempt<T>(spec: CallSpec, run: () => Promise<LiveCall<T>>): Promise<LiveCall<T>> {
  const t0 = Date.now();
  try {
    return await run();
  } catch (e) {
    return errorCall<T>(spec, e, Date.now() - t0);
  }
}

/** identify (0 credits) → enrich by id (2 credits). Throws on transport/API errors (caller maps to a failure). */
export async function lookupCompany(client: CrustdataClient, domain: string): Promise<CompanyLookup> {
  const idBody = { domains: [domain] };
  const idSpec: CallSpec = { id: "identify", method: "POST", path: "/company/identify", body: idBody };
  const identified = await client.identifyCompany(idBody);
  // identify always answers a top-level array; anything else is a broken response, never "no match"
  if (!Array.isArray(identified.data)) throw new CrustdataMalformedResponseError(200, "POST", "/company/identify", JSON.stringify(identified.data) ?? "", "not the documented top-level array");
  const match = firstMatch<{ crustdata_company_id?: number; basic_info?: { name?: string; crustdata_company_id?: number } }>(identified.data);
  const id = match?.companyData.crustdata_company_id ?? match?.companyData.basic_info?.crustdata_company_id;
  if (!match || id == null) return { status: "no_match", domain, identify: fromMeta(idSpec, identified.meta, "no_match") };
  const identify = fromMeta<IdentifyData>(idSpec, identified.meta, "ok", { id, name: match.companyData.basic_info?.name ?? domain, confidence: match.confidence, matchType: match.matchType });

  const enBody = { crustdata_company_ids: [id], fields: [...COMPANY_ENRICH_FIELD_GROUPS] };
  const enSpec: CallSpec = { id: "enrich", method: "POST", path: "/company/enrich", body: enBody };
  const enriched = await client.enrichCompanies(enBody);
  const em = firstMatch<CompanyEnrichData>(enriched.data);
  if (!em) {
    // identify matched but enrich did not: report it as such, not as "no match for the domain"
    throw new Error(`Crustdata identify matched ${domain} (id ${id}) but /company/enrich returned no match for that id.`);
  }
  const company = normalizeCompany(em.companyData, domain);
  return { status: "ok", company, identify, enrich: fromMeta(enSpec, enriched.meta, "ok", company) };
}

export async function searchFounders(client: CrustdataClient, companyId: number, limit = 5): Promise<LiveCall<{ total: number; people: LivePerson[] }>> {
  const body = founderPersonSearchBody(companyId, limit, { withExperience: true });
  const spec: CallSpec = { id: "founders", method: "POST", path: "/person/search", body };
  return attempt(spec, async () => {
    const { data, meta } = await client.searchPeople(body);
    const people = (data.profiles ?? []).map(normalizePerson);
    return fromMeta(spec, meta, "ok", { total: data.total_count ?? people.length, people });
  });
}

export async function searchJobs(client: CrustdataClient, companyId: number, limit = 25): Promise<LiveCall<LiveJobs>> {
  const body = jobSearchByCompanyId(companyId, limit);
  const spec: CallSpec = { id: "jobs", method: "POST", path: "/job/search", body };
  return attempt(spec, async () => {
    const { data, meta } = await client.searchJobs(body);
    return fromMeta(spec, meta, "ok", normalizeJobs(data));
  });
}

/** Web search for the company; results that do not mention `mustMention` are dropped (live results are noisy). */
export async function searchNews(client: CrustdataClient, query: string, mustMention?: string): Promise<LiveCall<LiveNews>> {
  const body = { query, human_mode: false, page: 1 };
  const spec: CallSpec = { id: "news", method: "POST", path: "/web/search/live", body };
  return attempt(spec, async () => {
    const { data, meta } = await client.webSearchLive(body);
    return fromMeta(spec, meta, "ok", normalizeNews(data, mustMention));
  });
}

export async function searchComps(client: CrustdataClient, company: Pick<LiveCompany, "id" | "description" | "categories">, limit = 5): Promise<LiveCall<LiveComp[]>> {
  const query = [company.description, company.categories.slice(0, 3).join(", ")].filter(Boolean).join(" · ");
  if (!query) {
    return { id: "comps", method: "POST", path: "/company/search", body: null, status: "skipped", ms: 0, cached: false, retrievedAt: null, creditsUsed: null, note: "No description or categories to search comparables on." };
  }
  const body = comparableCompaniesSearchBody({ crustdataCompanyId: company.id, query, limit, withFunding: true });
  const spec: CallSpec = { id: "comps", method: "POST", path: "/company/search", body };
  return attempt(spec, async () => {
    const { data, meta } = await client.searchCompanies(body as never);
    return fromMeta(spec, meta, "ok", normalizeComps(data));
  });
}

export async function enrichPerson(client: CrustdataClient, linkedinUrl: string): Promise<PersonLookup> {
  const body = linkedInPersonEnrichBody(linkedinUrl);
  const spec: CallSpec = { id: "person", method: "POST", path: "/person/enrich", body };
  const { data, meta } = await client.enrichPeople(body);
  const m = firstMatch<PersonEnrichData>(data);
  if (!m) return { status: "no_match", linkedinUrl, call: fromMeta(spec, meta, "no_match") };
  const person = normalizePerson(m.companyData);
  return { status: "ok", person, call: fromMeta(spec, meta, "ok", person) };
}

/** The deal page's research run. Throws only when identify/enrich fail (nothing to show without the company). */
export async function researchCompany(client: CrustdataClient, domain: string): Promise<ResearchResult> {
  const requestedAt = new Date().toISOString();
  const looked = await lookupCompany(client, domain);
  if (looked.status === "no_match") return { status: "no_match", domain, requestedAt, calls: { identify: looked.identify } };
  if (looked.status !== "ok") return looked;
  const c = looked.company;
  const [founders, jobs, news, comps] = await Promise.all([
    searchFounders(client, c.id),
    searchJobs(client, c.id),
    searchNews(client, `"${c.name}" ${c.categories[0] ?? c.description ?? ""}`.trim(), c.name),
    searchComps(client, c),
  ]);
  const base = { status: "ok" as const, domain, requestedAt, company: c, calls: { identify: looked.identify, enrich: looked.enrich, founders, jobs, news, comps } };
  return { ...base, fields: companyFields({ ...base, fields: {} }) };
}

type PeerRow = {
  crustdata_company_id?: number;
  basic_info?: { name?: string; primary_domain?: string; crustdata_company_id?: number };
  funding?: { last_round_type?: string | null; last_round_amount_usd?: number | null; last_fundraise_date?: string | null; total_investment_usd?: number | null } | null;
  revenue?: { estimated?: { lower_bound_usd?: number | null; upper_bound_usd?: number | null } | null } | null;
  locations?: { country?: string | null } | null;
};
const PEER_FIELDS = [
  "crustdata_company_id",
  "basic_info.name",
  "basic_info.primary_domain",
  "funding.last_round_type",
  "funding.last_round_amount_usd",
  "funding.last_fundraise_date",
  "funding.total_investment_usd",
  "revenue.estimated.lower_bound_usd",
  "revenue.estimated.upper_bound_usd",
  "locations.country",
];
const fin = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/**
 * Peers for valuation comps: live /company/search on the company's primary industry, last round type and country,
 * with funding and estimated revenue. When fewer than `want` peers come back, geography then stage are relaxed
 * (the result says which constraints it kept).
 */
export async function searchPeers(
  client: CrustdataClient,
  company: Pick<LiveCompany, "id" | "industries" | "country" | "funding">,
  opts: { limit?: number; want?: number } = {},
): Promise<{ call: LiveCall<Peer[]>; matched: ("sector" | "stage" | "geo")[] }> {
  const industry = company.industries[0];
  const base: CallSpec = { id: "peers", method: "POST", path: "/company/search", body: null };
  if (!industry) return { call: { ...base, status: "skipped", ms: 0, cached: false, retrievedAt: null, creditsUsed: null, note: "Crustdata returned no industry for the company, so peers cannot be matched on sector.", data: [] }, matched: [] };
  const limit = opts.limit ?? 10, want = opts.want ?? 3;
  const stage = company.funding.lastRoundType, country = company.country;
  const plans: ("sector" | "stage" | "geo")[][] = [["sector", "stage", "geo"], ["sector", "stage"], ["sector", "geo"], ["sector"]].filter(
    (p) => (!p.includes("stage") || stage) && (!p.includes("geo") || country),
  ) as ("sector" | "stage" | "geo")[][];
  let last: { call: LiveCall<Peer[]>; matched: ("sector" | "stage" | "geo")[] } | undefined;
  for (const matched of plans) {
    const conds: Record<string, unknown>[] = [{ field: "taxonomy.professional_network_industry", type: "=", value: industry }];
    if (matched.includes("stage")) conds.push({ field: "funding.last_round_type", type: "=", value: stage });
    if (matched.includes("geo")) conds.push({ field: "locations.country", type: "=", value: country });
    conds.push({ field: "funding.last_round_amount_usd", type: "=>", value: 1 });
    const body = { filters: { op: "and", conditions: conds }, fields: PEER_FIELDS, sorts: [{ field: "funding.last_fundraise_date", order: "desc" }], limit: limit + 1 };
    const spec: CallSpec = { ...base, body };
    const call = await attempt<Peer[]>(spec, async () => {
      const { data, meta } = await client.searchCompanies(body as never);
      const rows = ((data as { companies?: PeerRow[] }).companies ?? []).flatMap((c): Peer[] => {
        const id = c.crustdata_company_id ?? c.basic_info?.crustdata_company_id;
        const name = c.basic_info?.name?.trim();
        if (id == null || id === company.id || !name) return [];
        return [{ id, name, domain: c.basic_info?.primary_domain ?? undefined, country: c.locations?.country ?? undefined, lastRoundType: c.funding?.last_round_type ?? undefined, lastRoundUsd: fin(c.funding?.last_round_amount_usd), lastDate: c.funding?.last_fundraise_date ?? undefined, totalUsd: fin(c.funding?.total_investment_usd), revenueLowUsd: fin(c.revenue?.estimated?.lower_bound_usd), revenueHighUsd: fin(c.revenue?.estimated?.upper_bound_usd) }];
      });
      return fromMeta(spec, meta, "ok", rows.slice(0, limit));
    });
    last = { call, matched };
    if (call.status === "error" || (call.data?.length ?? 0) >= want) return last;
  }
  return last!;
}
