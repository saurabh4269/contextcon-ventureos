// Person search/enrich request bodies. Filter trees follow the documented PersonSearchCondition /
// PersonSearchConditionGroup shapes (live-verified by the builder for the founder query).

const CURRENT_COMPANY_ID = "experience.employment_details.current.company_id";
const CURRENT_TITLE = "experience.employment_details.current.title";

/**
 * Founders currently at a company. `fields` defaults to basic profile + social handles (0.13 credits/row: base 0.03 +
 * 0.1 for filtering on experience). Pass `withExperience` to also return work history (+0.1/row).
 */
export function founderPersonSearchBody(crustdataCompanyId: number, limit = 25, opts: { withExperience?: boolean } = {}) {
  return {
    filters: {
      op: "and",
      conditions: [
        { field: CURRENT_COMPANY_ID, type: "=", value: crustdataCompanyId },
        { field: CURRENT_TITLE, type: "(.)", value: "Founder" },
      ],
    },
    fields: opts.withExperience ? ["basic_profile", "social_handles", "experience", "education"] : ["basic_profile", "social_handles"],
    limit,
  };
}

export function currentEmployeesSearchBody(crustdataCompanyId: number, limit = 25) {
  return {
    filters: { op: "and", conditions: [{ field: CURRENT_COMPANY_ID, type: "=", value: crustdataCompanyId }] },
    fields: ["basic_profile"],
    limit,
  };
}

/**
 * Exact-name person search. The builder sent a bare condition; the API accepts a single condition too, but we keep the
 * same group shape as every other query so one validator covers all bodies.
 */
export function personByNameSearchBody(name: string, limit = 5) {
  return {
    filters: { op: "and", conditions: [{ field: "basic_profile.name", type: "=", value: name }] },
    fields: ["basic_profile"],
    limit,
  };
}

export function linkedInPersonEnrichBody(profileUrl: string) {
  return {
    professional_network_profile_urls: [profileUrl],
    fields: ["basic_profile", "experience", "education", "social_handles"],
  };
}

export type PersonSearchProfileLite = {
  crustdata_person_id?: number;
  basic_profile?: { name?: string };
};

export function readPersonSearchResults(data: { profiles?: PersonSearchProfileLite[]; total_count?: number | null }): {
  profiles: PersonSearchProfileLite[];
  totalCount: number;
} {
  const profiles = data.profiles ?? [];
  return { profiles, totalCount: data.total_count ?? profiles.length };
}

export function companyIdFromPersonSearchBody(body: Record<string, unknown>): number | undefined {
  const filters = body.filters as { field?: string; value?: unknown; conditions?: Array<{ field?: string; value?: unknown }> } | undefined;
  if (!filters || typeof filters !== "object") return undefined;
  const conds = "conditions" in filters ? (filters.conditions ?? []) : [filters];
  for (const c of conds) {
    if (c.field?.includes("company_id") && typeof c.value === "number") return c.value;
  }
  return undefined;
}

export type PersonEnrichMatch = {
  person_data?: {
    crustdata_person_id?: number;
    basic_profile?: { name?: string };
    experience?: unknown;
  };
};

/** First matched person in a /person/enrich response (top-level array of `{ matched_on, matches[] }`). */
export function readPersonEnrichPersonData(data: unknown): PersonEnrichMatch["person_data"] | undefined {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return undefined;
  const matches = (row as { matches?: Array<{ person_data?: PersonEnrichMatch["person_data"] }> }).matches;
  return matches?.[0]?.person_data;
}
