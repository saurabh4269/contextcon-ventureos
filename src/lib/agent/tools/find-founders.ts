// find_founders — POST /person/search for founders of several known companies in one call, returning each person's
// full employment history (current + past employers and titles, with dates) and education, so "who founded it and
// what did they do before" is answered from one cited response.
import type { ToolDef } from "../contract";
import { clampInt, exec, ints, round2 } from "./shared";

const MAX_COMPANIES = 25;
// 0.03 base + 0.1 for filtering on experience + 0.1 for returning experience (CREDIT_COSTS / pricing docs).
const PER_ROW = 0.23;

export const findFounders: ToolDef = {
  spec: {
    name: "find_founders",
    description:
      "POST /person/search — founders (title matches 'Founder': Co-Founder, Founder & CEO …) currently at the given crustdata_company_ids (up to 25 companies per call). " +
      "Response: profiles[i].basic_profile.name/.headline, profiles[i].experience.employment_details.current[j] (crustdata_company_id, name = employer name, title, start_date), " +
      "profiles[i].experience.employment_details.past[j] (name = employer name, crustdata_company_id, title, start_date, end_date, years_at_company) = what they did before, profiles[i].education.schools[j], profiles[i].social_handles.professional_network_identifier.profile_url. " +
      "Match a person to a company via experience.employment_details.current[j].crustdata_company_id. Companies with no row have no founder on Crustdata — say so, do not guess. Cost ≈0.23 credits per returned person.",
    input_schema: {
      type: "object",
      properties: {
        crustdata_company_ids: { type: "array", items: { type: "integer" }, maxItems: MAX_COMPANIES },
        title_keyword: { type: "string", description: "Defaults to 'Founder'. E.g. 'CEO' or 'CTO' for other leaders." },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Max people (default 3 per company, capped at 50)." },
      },
      required: ["crustdata_company_ids"],
    },
  },
  estimateCredits: (input) => {
    const n = ints(input.crustdata_company_ids, MAX_COMPANIES).length;
    return round2(clampInt(input.limit, 1, 50, Math.min(50, Math.max(1, n * 3))) * PER_ROW);
  },
  execute: async (input, client) => {
    const ids = ints(input.crustdata_company_ids, MAX_COMPANIES);
    if (!ids.length) throw new Error("find_founders needs crustdata_company_ids (use identify_company or search_companies first).");
    const title = typeof input.title_keyword === "string" && input.title_keyword.trim() ? input.title_keyword.trim().slice(0, 60) : "Founder";
    const body = {
      filters: {
        op: "and",
        conditions: [
          ids.length === 1
            ? { field: "experience.employment_details.current.company_id", type: "=", value: ids[0] }
            : { field: "experience.employment_details.current.company_id", type: "in", value: ids },
          { field: "experience.employment_details.current.title", type: "(.)", value: title },
        ],
      },
      fields: ["basic_profile", "experience", "education", "social_handles"],
      limit: clampInt(input.limit, 1, 50, Math.min(50, ids.length * 3)),
    };
    return exec("POST", "/person/search", body, client.searchPeople(body));
  },
};
