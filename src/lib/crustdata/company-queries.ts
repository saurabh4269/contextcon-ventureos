// /company/search request bodies.
//
// The builder's comparable-company searches were rejected by the API (400 filter_shape, replayed live 2026-10-31):
// build-deal-graph.ts sent `{ filters: { industries: { contains }, employee_count_range: { in } } }` and mcp/tools.ts
// sent `{ field: "industries", type: "(.)" }` (no such field); on empty results the graph then inserted invented
// companies ("FlowBot", "LedgerOps"). /company/search takes the same filter-tree shape as person and job search
// (`{ field, type, value }` or `{ op, conditions }`) and optionally a ranked `search: { query, mode }`.

/** Base-price fields (0.03 credits/row). */
const BASE_FIELDS = [
  "crustdata_company_id",
  "basic_info.name",
  "basic_info.primary_domain",
  "basic_info.description",
  "basic_info.year_founded",
  "basic_info.employee_count_range",
] as const;
/** Premium group (+0.2 credits/row) — only requested when the caller wants stage/raised. */
const FUNDING_FIELDS = ["funding.total_investment_usd", "funding.last_round_type"] as const;

export type ComparableInput = {
  crustdataCompanyId: number;
  /** What the company does, e.g. basic_info.description + taxonomy.categories. Required: no query, no search. */
  query: string;
  limit?: number;
  withFunding?: boolean;
};

/**
 * Ranked (hybrid) search for companies like the target, excluding the target. Live-verified shape
 * (`search` + `filters: { field: "crustdata_company_id", type: "not_in", value: [id] }`, 0.03 credits/row base).
 */
export function comparableCompaniesSearchBody(input: ComparableInput) {
  const query = input.query.replace(/\s+/g, " ").trim();
  if (!query) throw new Error("comparableCompaniesSearchBody: a description query is required (nothing to compare on)");
  return {
    search: { query: query.slice(0, 300), mode: "hybrid" as const },
    filters: { field: "crustdata_company_id", type: "not_in" as const, value: [input.crustdataCompanyId] },
    fields: [...BASE_FIELDS, ...(input.withFunding ? FUNDING_FIELDS : [])],
    limit: input.limit ?? 5,
  };
}
