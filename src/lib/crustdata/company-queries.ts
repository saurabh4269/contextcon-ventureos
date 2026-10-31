// /company/search request bodies.
//
// The builder's comparable-company searches were rejected by the API: build-deal-graph.ts sent
// `{ filters: { industries: { contains }, employee_count_range: { in } } }` and mcp/tools.ts sent
// `{ field: "industries", type: "(.)" }` (no such field). /company/search takes the same filter-tree shape as person and
// job search: a SearchCondition `{ field, type, value }` or a group `{ op: "and" | "or", conditions: [...] }`, with field
// names from the documented list (basic_info.industries, basic_info.employee_count_range, …).

export type CompanySearchCondition = { field: string; type: string; value: unknown };
export type CompanySearchGroup = { op: "and" | "or"; conditions: (CompanySearchCondition | CompanySearchGroup)[] };

/** Fields requested for comparable rows. `funding` is a premium group (+0.2 credits/row); basic_info is base price. */
export const COMPS_FIELDS = ["basic_info", "funding"] as const;

export type ComparableInput = {
  crustdataCompanyId: number;
  /** basic_info.industries of the target (taxonomy is a premium filter; industries is not). */
  industries: string[];
  /** basic_info.employee_count_range of the target, e.g. "51-200". */
  employeeCountRange?: string | null;
  limit?: number;
};

/**
 * Companies in the same industry (any of the target's first two industries) and the same headcount band, excluding the
 * target itself, sorted by total funding. Throws when there is nothing to compare on — never sends an empty filter.
 */
export function comparableCompaniesSearchBody(input: ComparableInput) {
  const industries = input.industries.map((i) => i.trim()).filter(Boolean).slice(0, 2);
  if (!industries.length) throw new Error("comparableCompaniesSearchBody: target has no basic_info.industries to compare on");
  const conditions: (CompanySearchCondition | CompanySearchGroup)[] = [
    industries.length === 1
      ? { field: "basic_info.industries", type: "(.)", value: industries[0] }
      : { op: "or", conditions: industries.map((v) => ({ field: "basic_info.industries", type: "(.)", value: v })) },
    { field: "crustdata_company_id", type: "!=", value: input.crustdataCompanyId },
  ];
  if (input.employeeCountRange) conditions.push({ field: "basic_info.employee_count_range", type: "=", value: input.employeeCountRange });
  return {
    filters: { op: "and" as const, conditions },
    fields: [...COMPS_FIELDS],
    sorts: [{ field: "funding.total_investment_usd", order: "desc" as const }],
    limit: input.limit ?? 5,
  };
}
