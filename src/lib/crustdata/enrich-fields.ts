/** Permitted company enrich field groups (403 if technographics/crunchbase/maps/social_posts/hiring.recent_openings). */
export const COMPANY_ENRICH_FIELD_GROUPS = [
  "basic_info",
  "headcount",
  "funding",
  "web_traffic",
  "followers",
  "news",
  "people",
  "taxonomy",
  "locations",
  "revenue",
] as const;

export type CompanyEnrichFieldGroup = (typeof COMPANY_ENRICH_FIELD_GROUPS)[number];

export function withCompanyEnrichFields<T extends Record<string, unknown>>(body: T): T & { fields: CompanyEnrichFieldGroup[] } {
  return { ...body, fields: [...COMPANY_ENRICH_FIELD_GROUPS] };
}

/** Strip zero-width and trim display names from Crustdata payloads. */
export function sanitizeCrustdataName(raw: string | undefined | null): string | undefined {
  if (raw == null) return undefined;
  const cleaned = raw.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  return cleaned || undefined;
}

export function sanitizeDomain(raw: string | undefined | null): string | undefined {
  if (raw == null) return undefined;
  return raw.trim().replace(/^www\./i, "").toLowerCase() || undefined;
}
