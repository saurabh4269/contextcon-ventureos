// Raw Crustdata responses (api 2025-11-01) → the normalized live shapes in ./types. Pure; unit-tested against the
// real E2B captures in docs/crustdata/fixtures.
import type {
  CompanyEnrichData,
  CompanySearchResponse,
  JobSearchResponse,
  PersonEnrichData,
  PersonSearchProfile,
  WebSearchLiveResponse,
} from "@/lib/crustdata/types";
import type { LiveComp, LiveCompany, LiveEmployment, LiveJobs, LiveNews, LivePerson, Point } from "./types";

/** Crustdata strings can carry zero-width characters and stray whitespace (e.g. "Tomas‎  ‎Valenta"). */
export function clean(s: string | null | undefined): string | undefined {
  if (s == null) return undefined;
  const out = s.replace(/[​-‏‪-‮⁠﻿]/g, "").replace(/\s+/g, " ").trim();
  return out || undefined;
}

/** news[].confidence_score threshold; E2B captures show off-topic items at 0.85 and on-topic at 0.95. */
export const NEWS_MIN_CONFIDENCE = 0.9;

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const day = (d: string | null | undefined) => (d ? d.slice(0, 10) : undefined);

/** Sort by date and keep the last value per calendar month; returns the newest `months` months, oldest first. */
export function monthly(series: { date?: string | null; value?: number | null }[], months = 12): Point[] {
  const byMonth = new Map<string, Point>();
  for (const p of [...series].filter((x) => x.date && typeof x.value === "number").sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    const date = day(p.date)!;
    byMonth.set(date.slice(0, 7), { date, v: p.value as number });
  }
  return [...byMonth.values()].slice(-months);
}

/** Domain-keyed lookup (keys contain dots, so never split the path on "."). */
function trafficFor(company: CompanyEnrichData, domain: string) {
  const dt = company.web_traffic?.domain_traffic ?? {};
  return dt[domain] ?? Object.values(dt)[0];
}

export function normalizeCompany(company: CompanyEnrichData, requestedDomain: string): LiveCompany {
  const b = company.basic_info ?? {};
  const id = company.crustdata_company_id ?? b.crustdata_company_id;
  if (id == null) throw new Error("Enrich match has no crustdata_company_id");
  const domain = clean(b.primary_domain) ?? requestedDomain;
  const hc = company.headcount ?? {};
  const gp = hc.growth_percent ?? {};
  const fn = hc.by_function_timeseries?.CURRENT_FUNCTION ?? {};
  const byFunction = Object.entries(fn)
    .map(([label, pts]) => ({ label, monthly: monthly((pts ?? []).map((p) => ({ date: p.date, value: p.employee_count })), 6) }))
    .filter((f) => f.monthly.length > 0)
    .sort((a, b) => (b.monthly.at(-1)?.v ?? 0) - (a.monthly.at(-1)?.v ?? 0));
  const t = trafficFor(company, domain);
  return {
    id,
    name: clean(b.name) ?? domain,
    domain,
    website: clean(b.website),
    logoUrl: clean(b.logo_permalink),
    description: clean(b.description),
    yearFounded: num(b.year_founded),
    employeeRange: clean(b.employee_count_range),
    linkedinUrl: clean(b.professional_network_url),
    hq: clean(company.locations?.headquarters),
    country: clean(company.locations?.country),
    industries: (company.taxonomy?.professional_network_industries ?? []).map((x) => clean(x)).filter((x): x is string => !!x),
    categories: (company.taxonomy?.categories ?? []).map((x) => clean(x)).filter((x): x is string => !!x),
    headcount: {
      total: num(hc.total),
      growth: { mom: num(gp.mom), qoq: num(gp.qoq), six_months: num(gp.six_months), yoy: num(gp.yoy) },
      monthly: monthly((hc.timeseries ?? []).map((p) => ({ date: p.date, value: p.employee_count })), 12),
      byFunction,
    },
    funding: {
      totalUsd: num(company.funding?.total_investment_usd),
      lastRoundType: clean(company.funding?.last_round_type),
      lastRoundUsd: num(company.funding?.last_round_amount_usd),
      lastDate: day(company.funding?.last_fundraise_date),
      investors: (company.funding?.investors ?? []).map((x) => clean(x)).filter((x): x is string => !!x),
    },
    web: {
      domain: t?.domain ?? (t ? domain : undefined),
      monthlyVisitors: num(t?.monthly_visitors),
      momPct: num(t?.mom_pct),
      qoqPct: num(t?.qoq_pct),
      monthly: monthly((t?.monthly_visitors_timeseries ?? []).map((p) => ({ date: p.date, value: p.monthly_visitors })), 12),
    },
    // enrich news is matched by name and is noisy for short names ("Pepperdine E2B"); keep high-confidence matches only
    followers: {
      count: num(company.followers?.count),
      qoqPct: num(company.followers?.qoq_percent),
      sixMonthPct: num(company.followers?.six_months_growth_percent),
      yoyPct: num(company.followers?.yoy_percent),
    },
    news: (company.news ?? [])
      .filter((n) => clean(n.article_title) && (n.confidence_score ?? 0) >= NEWS_MIN_CONFIDENCE)
      .map((n) => ({ title: clean(n.article_title)!, url: clean(n.article_url), date: day(n.article_publish_date), publisher: clean(n.article_publisher_name) }))
      .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? ""))),
  };
}

type AnyEmployment = {
  name?: string | null;
  title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  crustdata_company_id?: number | null;
  company_website?: string | null;
};
const employment = (e: AnyEmployment): LiveEmployment | undefined =>
  clean(e.name)
    ? { company: clean(e.name)!, title: clean(e.title), start: day(e.start_date), end: day(e.end_date), companyId: e.crustdata_company_id ?? undefined, companyDomain: clean(e.company_website)?.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") }
    : undefined;
const byStartDesc = (a: LiveEmployment, b: LiveEmployment) => String(b.start ?? "").localeCompare(String(a.start ?? ""));

/** Works for /person/search profiles and /person/enrich person_data (same group names). */
export function normalizePerson(p: PersonSearchProfile | PersonEnrichData): LivePerson {
  const bp = (p as PersonSearchProfile).basic_profile ?? {};
  const ed = (p as PersonSearchProfile).experience?.employment_details;
  const loc = bp.location as { full_location?: string | null; raw?: string | null } | null | undefined;
  const schools = ((p as PersonSearchProfile).education?.schools ?? []) as { school?: string; degree?: string | null; field_of_study?: string | null; start_year?: number | null; end_year?: number | null }[];
  return {
    id: (p as PersonSearchProfile).crustdata_person_id,
    name: clean(bp.name) ?? clean(bp.professional_network_name) ?? "Unknown",
    title: clean(bp.current_title),
    headline: clean(bp.headline),
    location: clean(loc?.full_location ?? loc?.raw),
    linkedinUrl: clean((p as PersonSearchProfile).social_handles?.professional_network_identifier?.profile_url),
    pictureUrl: clean(bp.profile_picture_permalink),
    current: ((ed?.current ?? []) as AnyEmployment[]).map(employment).filter((x): x is LiveEmployment => !!x).sort(byStartDesc),
    past: ((ed?.past ?? []) as AnyEmployment[]).map(employment).filter((x): x is LiveEmployment => !!x).sort(byStartDesc),
    schools: schools
      .filter((s) => clean(s.school))
      .map((s) => ({ school: clean(s.school)!, degree: clean(s.degree), field: clean(s.field_of_study), start: s.start_year ?? undefined, end: s.end_year ?? undefined })),
  };
}

export function normalizeJobs(data: JobSearchResponse): LiveJobs {
  const listings = (data.job_listings ?? [])
    .filter((j) => clean(j.job_details?.title))
    .map((j) => {
      const loc = (j as { location?: { raw?: string | null } | null }).location;
      const meta = (j as { metadata?: { date_added?: string | null } }).metadata;
      return { title: clean(j.job_details?.title)!, category: clean(j.job_details?.category), url: clean(j.job_details?.url), date: day(meta?.date_added), location: clean(loc?.raw) };
    });
  const counts = new Map<string, number>();
  for (const l of listings) counts.set(l.category ?? "Uncategorized", (counts.get(l.category ?? "Uncategorized") ?? 0) + 1);
  return {
    total: data.total_count ?? listings.length,
    listings,
    byCategory: [...counts.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
  };
}

/**
 * Web search results, keeping only those that mention the company name (live results for short names are noisy —
 * "E2B" also matches Intel/Veeva "E2B" pages). Returns nothing rather than off-topic results.
 */
export function normalizeNews(data: WebSearchLiveResponse, mustMention?: string): LiveNews {
  const needle = mustMention?.toLowerCase();
  return {
    query: data.query,
    results: (data.results ?? [])
      .filter((r) => clean(r.title))
      .filter((r) => !needle || `${r.title ?? ""} ${r.snippet ?? ""}`.toLowerCase().includes(needle))
      .map((r) => ({ title: clean(r.title)!, url: clean(r.url), snippet: clean(r.snippet), source: clean(r.source) })),
  };
}

export function normalizeComps(data: CompanySearchResponse): LiveComp[] {
  return (data.companies ?? []).flatMap((c) => {
    const id = c.crustdata_company_id ?? c.basic_info?.crustdata_company_id;
    const name = clean(c.basic_info?.name);
    if (id == null || !name) return [];
    return [
      {
        id,
        name,
        domain: clean(c.basic_info?.primary_domain),
        description: clean(c.basic_info?.description),
        yearFounded: num(c.basic_info?.year_founded),
        employeeRange: clean(c.basic_info?.employee_count_range),
        totalUsd: num(c.funding?.total_investment_usd),
        lastRoundType: clean(c.funding?.last_round_type),
      },
    ];
  });
}

/** First match's company_data in an identify/enrich response (top-level array). */
export function firstMatch<T>(data: unknown): { matchType?: string; confidence?: number; companyData: T } | undefined {
  const row = Array.isArray(data) ? (data[0] as { match_type?: string; matches?: { confidence_score?: number; company_data?: T; person_data?: T }[] } | undefined) : undefined;
  const m = row?.matches?.[0];
  const payload = m?.company_data ?? m?.person_data;
  return payload ? { matchType: row?.match_type, confidence: m?.confidence_score, companyData: payload } : undefined;
}

/**
 * "https://www.E2B.dev/path" → "e2b.dev"; internationalised hosts → punycode ("bücher.de" → "xn--bcher-kva.de").
 * Returns undefined for things that are not a plausible domain.
 */
export function normalizeDomainInput(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  let d = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0]!.replace(/\.$/, "");
  if (/[^\x00-\x7f]/.test(d)) d = toAsciiHost(d).replace(/^www\./, "").replace(/\.$/, "");
  return /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d) ? d : undefined;
}

/** WHATWG host parsing (IDNA → punycode); the input unchanged when it is not a parseable host. */
function toAsciiHost(host: string): string {
  if (/[@:\\]/.test(host)) return host; // userinfo/port: not a bare host, let the regex reject it
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return host;
  }
}

/** Normalize a LinkedIn profile URL; undefined when it isn't one. */
export function normalizeLinkedInUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const m = raw.trim().match(/^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9_%-]+)\/?(?:[?#].*)?$/i);
  return m ? `https://www.linkedin.com/in/${m[1]}` : undefined;
}
