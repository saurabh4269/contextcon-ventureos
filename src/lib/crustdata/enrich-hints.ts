import type { CompanyEnrichResponse } from "./types";
import { sanitizeCrustdataName } from "./enrich-fields";

/** Screener hints (was imported from the builder's @/lib/journey/thesis, which is not part of this repo). */
export type ScreenerEnrichHints = {
  industries?: string[];
  hqCountry?: string;
  fundingStage?: string;
  headcountLatest?: number;
};

type CompanyDataBlock = {
  basic_info?: {
    name?: string;
    industries?: string[];
    primary_domain?: string;
  };
  taxonomy?: {
    professional_network_industries?: string[];
    professional_network_industry?: string | null;
  };
  locations?: { country?: string | null };
  headcount?: {
    total?: number | null;
    largest_headcount_country?: string | null;
    timeseries?: Array<{ date?: string; employee_count?: number | null; count?: number | null }>;
    growth_percent?: {
      mom?: number | null;
      qoq?: number | null;
      six_months?: number | null;
      yoy?: number | null;
    };
  };
  funding?: {
    last_round_type?: string | null;
  };
  news?: Array<{
    article_title?: string;
    article_url?: string;
    article_publish_date?: string;
    article_publisher_name?: string;
  }>;
};

function unwrapCompanyData(row: unknown): CompanyDataBlock | undefined {
  if (!row || typeof row !== "object") return undefined;
  const r = row as {
    matches?: Array<{ company_data?: CompanyDataBlock }>;
    company_data?: CompanyDataBlock;
  };
  if (r.matches?.[0]?.company_data) return r.matches[0].company_data;
  if (r.company_data) return r.company_data;
  return undefined;
}

function firstEnrichBlock(data: CompanyEnrichResponse | unknown): CompanyDataBlock | undefined {
  if (Array.isArray(data)) {
    return unwrapCompanyData(data[0]);
  }
  const raw = data as { results?: unknown[] };
  if (Array.isArray(raw.results)) {
    return unwrapCompanyData(raw.results[0]);
  }
  return unwrapCompanyData(data);
}

/** Latest indexed headcount: headcount.total, else the newest headcount.timeseries point (the API does not sort it). */
export function latestHeadcountFromCompanyData(company: CompanyDataBlock | undefined): number | undefined {
  if (!company) return undefined;
  const hc = company.headcount;
  if (typeof hc?.total === "number") return hc.total;
  const series = (hc?.timeseries ?? [])
    .filter((p) => p.date && typeof (p.employee_count ?? p.count) === "number")
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const last = series[series.length - 1];
  return last ? ((last.employee_count ?? last.count) as number) : undefined;
}

/** Industries live in taxonomy (enrich basic_info has no `industries`; identify's basic_info does). */
export function industriesFromCompanyData(company: CompanyDataBlock | undefined): string[] | undefined {
  const fromTaxonomy = company?.taxonomy?.professional_network_industries;
  if (fromTaxonomy?.length) return fromTaxonomy.map((i) => i.trim()).filter(Boolean);
  const single = company?.taxonomy?.professional_network_industry;
  if (single?.trim()) return [single.trim()];
  return company?.basic_info?.industries ?? undefined;
}

export function screenerHintsFromEnrich(data: CompanyEnrichResponse | unknown): ScreenerEnrichHints {
  const company = firstEnrichBlock(data);
  return {
    industries: industriesFromCompanyData(company),
    hqCountry: company?.locations?.country ?? company?.headcount?.largest_headcount_country ?? undefined,
    fundingStage: company?.funding?.last_round_type ?? undefined,
    headcountLatest: latestHeadcountFromCompanyData(company),
  };
}

export function companyNameFromEnrich(data: CompanyEnrichResponse | unknown): string | undefined {
  const name = firstEnrichBlock(data)?.basic_info?.name;
  return sanitizeCrustdataName(name);
}

export function newsArticlesFromEnrich(data: CompanyEnrichResponse | unknown) {
  const news = firstEnrichBlock(data)?.news ?? [];
  return news.map((n) => ({
    title: n.article_title,
    url: n.article_url,
    publishedAt: n.article_publish_date,
    publisher: n.article_publisher_name,
  }));
}

export function headcountGrowthFromEnrich(data: CompanyEnrichResponse | unknown) {
  return firstEnrichBlock(data)?.headcount?.growth_percent;
}
