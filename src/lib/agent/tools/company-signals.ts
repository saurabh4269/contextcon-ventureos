// company_signals — POST /company/enrich, returning only the requested sections: native headcount growth (overall
// and by function/role, region), funding & investors, follower growth, web traffic, recent news, founders/CXOs.
// Prefer Crustdata's own growth fields (headcount.growth_percent.six_months, by_role_growth_6m_pct …) over computing
// growth from timeseries. Heavy arrays (weekly timeseries, skills) are dropped from what is returned.
import type { ToolDef } from "../contract";
import { exec, ints, pick, strings } from "./shared";

const MAX = 5;
const CREDITS_PER_COMPANY = 2;

/** Keys kept per section. Values are Crustdata's own; nothing is renamed. */
export const SECTION_KEYS = {
  headcount: ["total", "largest_headcount_country", "growth_percent", "growth_absolute", "by_role_absolute", "by_role_percent", "by_role_growth_6m_pct", "by_role_growth_yoy_pct", "by_region_absolute"],
  funding: ["total_investment_usd", "last_round_type", "last_round_amount_usd", "last_fundraise_date", "num_funding_rounds", "investors", "milestones", "acquired_by", "acquisitions", "valuation_usd"],
  followers: ["count", "mom_percent", "qoq_percent", "six_months_growth_percent", "yoy_percent"],
  web_traffic: null,
  news: null,
  people: ["founders", "cxos"],
} as const satisfies Record<string, readonly string[] | null>;

export type Section = keyof typeof SECTION_KEYS;
const SECTIONS = Object.keys(SECTION_KEYS) as Section[];

const projectWebTraffic = (wt: unknown) => {
  // domain_traffic.{domain}: drop monthly_visitors_timeseries, keep the summary numbers.
  const dt = (wt as { domain_traffic?: Record<string, Record<string, unknown>> } | null)?.domain_traffic;
  if (!dt || typeof dt !== "object") return wt;
  return { domain_traffic: Object.fromEntries(Object.entries(dt).map(([d, v]) => [d, v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([k]) => !/timeseries/.test(k))) : v])) };
};

const projectCompany = (company: unknown, sections: Section[]) => {
  if (!company || typeof company !== "object") return company;
  const c = company as Record<string, unknown>;
  const out: Record<string, unknown> = { crustdata_company_id: c.crustdata_company_id, basic_info: pick(c.basic_info, ["name", "primary_domain", "year_founded", "professional_network_url"]) };
  for (const s of sections) {
    if (!(s in c)) continue;
    const keys = SECTION_KEYS[s];
    out[s] = s === "web_traffic" ? projectWebTraffic(c[s]) : s === "news" ? (Array.isArray(c[s]) ? (c[s] as unknown[]).slice(0, 10) : c[s]) : keys ? pick(c[s], keys) : c[s];
  }
  return out;
};

/** Enrich response is [{matched_on, match_type, matches: [{confidence_score, company_data}]}]; keep that shape. */
export const projectEnrich = (data: unknown, sections: Section[]) =>
  Array.isArray(data)
    ? data.map((e) =>
        e && typeof e === "object" && Array.isArray((e as { matches?: unknown[] }).matches)
          ? { ...(e as object), matches: (e as { matches: { company_data?: unknown }[] }).matches.map((m) => (m && typeof m === "object" ? { ...m, company_data: projectCompany(m.company_data, sections) } : m)) }
          : e,
      )
    : data;

export const companySignals: ToolDef = {
  spec: {
    name: "company_signals",
    description:
      `POST /company/enrich — growth, funding and people signals for up to ${MAX} known companies (2 credits per company). Pick sections: ${SECTIONS.join(", ")}. ` +
      "Paths in the response: [i].matches[0].company_data.headcount.total, .headcount.growth_percent.{mom,qoq,six_months,yoy,two_years} (percent), .headcount.growth_absolute.*, .headcount.by_role_absolute.{Engineering,Sales,…}, .headcount.by_role_growth_6m_pct.{function}, .headcount.by_role_growth_yoy_pct.{function}; " +
      ".funding.total_investment_usd, .funding.last_round_type, .funding.last_round_amount_usd, .funding.last_fundraise_date, .funding.investors[], .funding.milestones[]; .followers.six_months_growth_percent; .web_traffic.domain_traffic.{domain}.monthly_visitors/mom_pct/qoq_pct; .news[]; .people.founders[] (basic_profile, experience). " +
      "Prefer search_companies (cheaper, filters server-side on headcount.growth_percent.6m etc.) for screening; use this to deepen a short list.",
    input_schema: {
      type: "object",
      properties: {
        crustdata_company_ids: { type: "array", items: { type: "integer" }, maxItems: MAX },
        domains: { type: "array", items: { type: "string" }, maxItems: MAX },
        sections: { type: "array", items: { type: "string", enum: SECTIONS }, description: "Defaults to headcount and funding." },
      },
    },
  },
  estimateCredits: (input) => CREDITS_PER_COMPANY * Math.min(MAX, ints(input.crustdata_company_ids, MAX).length || strings(input.domains, MAX).length),
  execute: (input, client) => {
    const ids = ints(input.crustdata_company_ids, MAX);
    const domains = strings(input.domains, MAX);
    if (!ids.length && !domains.length) throw new Error("company_signals needs crustdata_company_ids or domains.");
    const asked = strings(input.sections, SECTIONS.length).filter((s): s is Section => (SECTIONS as string[]).includes(s));
    const sections: Section[] = asked.length ? asked : ["headcount", "funding"];
    const body = ids.length ? { crustdata_company_ids: ids } : { domains };
    // The client always requests every permitted field group (one cache entry per company); sections only shape the output.
    return exec("POST", "/company/enrich", body, client.enrichCompanies(body), (d) => projectEnrich(d, sections));
  },
};
