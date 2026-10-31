import { sanitizeCrustdataName } from "./enrich-fields";

export type CompanyMatchBlock = {
  matched_on?: string;
  match_type?: string;
  matches?: Array<{
    confidence_score?: number;
    company_data?: {
      crustdata_company_id?: number;
      basic_info?: {
        name?: string;
        primary_domain?: string;
        crustdata_company_id?: number;
      };
    };
  }>;
};

export function firstIdentifyOrEnrichRow(data: unknown): CompanyMatchBlock | undefined {
  if (Array.isArray(data)) return data[0] as CompanyMatchBlock | undefined;
  const wrapped = data as { results?: CompanyMatchBlock[] };
  if (Array.isArray(wrapped.results)) return wrapped.results[0];
  return undefined;
}

export function companyMatchesFromResponse(data: unknown): CompanyMatchBlock["matches"] {
  const row = firstIdentifyOrEnrichRow(data);
  return row?.matches ?? [];
}

export function hasCrustdataCompanyMatch(data: unknown): boolean {
  const matches = companyMatchesFromResponse(data) ?? [];
  return matches.some(
    (m) =>
      (m?.company_data?.crustdata_company_id ?? m?.company_data?.basic_info?.crustdata_company_id) !=
      null,
  );
}

export function primaryCompanyMatch(data: unknown): {
  id?: number;
  name?: string;
  domain?: string;
  confidence?: number;
} | null {
  const row = firstIdentifyOrEnrichRow(data);
  const match = row?.matches?.[0];
  if (!match?.company_data) return null;
  const cd = match.company_data;
  const id = cd.crustdata_company_id ?? cd.basic_info?.crustdata_company_id;
  if (id == null) return null;
  return {
    id,
    name: sanitizeCrustdataName(cd.basic_info?.name),
    domain: cd.basic_info?.primary_domain?.trim(),
    confidence: match.confidence_score,
  };
}

export function noMatchSummary(domain: string): string {
  return `No Crustdata match for ${domain} (matches: [])`;
}
