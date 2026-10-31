// identify_company — POST /company/identify (free). Resolves names, domains or LinkedIn company URLs to
// crustdata_company_id + basic_info, so other tools can filter by id instead of fuzzy names.
import type { ToolDef } from "../contract";
import { exec, ints, strings } from "./shared";

const MAX = 10;

export const identifyCompany: ToolDef = {
  spec: {
    name: "identify_company",
    description:
      "POST /company/identify — resolve companies by name, website domain, LinkedIn company URL or crustdata_company_id (exactly one kind per call, up to 10). Free (0 credits). Returns a top-level array, one entry per identifier: [i].matched_on, [i].matches[j].confidence_score, [i].matches[j].company_data.crustdata_company_id and .basic_info (name, primary_domain, year_founded, employee_count_range, industries, professional_network_url). Names can match several companies — check confidence_score and domain. Use exact_match with domains for a strict match.",
    input_schema: {
      type: "object",
      properties: {
        names: { type: "array", items: { type: "string" }, maxItems: MAX },
        domains: { type: "array", items: { type: "string" }, maxItems: MAX },
        linkedin_urls: { type: "array", items: { type: "string" }, maxItems: MAX },
        crustdata_company_ids: { type: "array", items: { type: "integer" }, maxItems: MAX },
        exact_match: { type: "boolean", description: "Strict domain match (domains only)." },
      },
    },
  },
  estimateCredits: () => 0,
  execute: async (input, client) => {
    const ids = ints(input.crustdata_company_ids, MAX);
    const domains = strings(input.domains, MAX).map((d) => d.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""));
    const urls = strings(input.linkedin_urls, MAX).filter((u) => /linkedin\.com\/company\//i.test(u));
    const names = strings(input.names, MAX);
    // Exactly one identifier kind per request (API rule); the most precise kind wins.
    const body: Record<string, unknown> = ids.length
      ? { crustdata_company_ids: ids }
      : domains.length
        ? { domains, ...(input.exact_match === true ? { exact_match: true } : {}) }
        : urls.length
          ? { professional_network_profile_urls: urls }
          : names.length
            ? { names }
            : (() => {
                throw new Error("identify_company needs names, domains, linkedin_urls or crustdata_company_ids.");
              })();
    return exec("POST", "/company/identify", body, client.identifyCompany(body as never));
  },
};
