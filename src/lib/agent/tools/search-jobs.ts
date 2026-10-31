// search_jobs — POST /job/search. Hiring signals: open roles by company, function, title, location and date, plus
// server-side aggregations (count, or group_by company/category) so "who is hiring most engineers" needs no rows.
import type { ToolDef } from "../contract";
import { clampInt, exec, round2 } from "./shared";

const PER_ROW = 0.03; // docs.crustdata.com/general/pricing (CREDIT_COSTS.jobSearchPerRow)
const MAX_LIMIT = 50;
const DEFAULT_FIELDS = ["job_details.title", "job_details.category", "job_details.url", "company.basic_info.crustdata_company_id", "company.basic_info.name", "location.raw", "location.country", "metadata.date_added"];

type Agg = { type: "count" } | { type: "group_by"; field: string; agg: "count"; size: number };

const aggregations = (v: unknown): Agg[] =>
  (Array.isArray(v) ? v : [])
    .map((a): Agg | null => {
      const x = a as { type?: unknown; field?: unknown; size?: unknown };
      if (x?.type === "count") return { type: "count" };
      if (x?.type === "group_by" && typeof x.field === "string" && x.field.trim()) return { type: "group_by", field: x.field.trim(), agg: "count", size: clampInt(x.size, 1, 50, 10) };
      return null;
    })
    .filter((a): a is Agg => a !== null)
    .slice(0, 3);

export const searchJobs: ToolDef = {
  spec: {
    name: "search_jobs",
    description:
      "POST /job/search — job postings (hiring signals). Filter fields: company.basic_info.company_id (crustdata_company_id; `in` with an array for several companies), company.basic_info.name, job_details.title ((.) fuzzy), job_details.category (e.g. Engineering, Sales, Marketing), job_details.workplace_type, location.country, location.city, metadata.date_added (YYYY-MM-DD, use => for 'since'). " +
      "Sort by metadata.date_added. Aggregations run server-side: {type:'count'} for a total, {type:'group_by', field:'company.basic_info.company_id'|'job_details.category'|'location.country', size} for counts per bucket — set limit 0 to get only aggregations. " +
      "Response: job_listings[i].job_details.title/.category/.url, job_listings[i].metadata.date_added, total_count, aggregations[k]. Cost 0.03 credits per returned row.",
    input_schema: {
      type: "object",
      properties: {
        filters: { type: "object", description: 'Condition {"field","type","value"} or group {"op":"and"|"or","conditions":[...]}. Use => and =< (never >= or <=).' },
        fields: { type: "array", items: { type: "string" } },
        sorts: { type: "array", items: { type: "object", properties: { field: { type: "string" }, order: { type: "string", enum: ["asc", "desc"] } }, required: ["field", "order"] } },
        aggregations: { type: "array", items: { type: "object", properties: { type: { type: "string", enum: ["count", "group_by"] }, field: { type: "string" }, size: { type: "integer" } }, required: ["type"] } },
        limit: { type: "integer", minimum: 0, maximum: MAX_LIMIT },
        cursor: { type: "string" },
      },
      required: ["filters", "limit"],
    },
  },
  estimateCredits: (input) => round2(clampInt(input.limit, 0, MAX_LIMIT, 20) * PER_ROW),
  execute: async (input, client) => {
    if (!input.filters || typeof input.filters !== "object") throw new Error("search_jobs needs filters.");
    const aggs = aggregations(input.aggregations);
    const limit = clampInt(input.limit, 0, MAX_LIMIT, 20);
    if (limit === 0 && !aggs.length) throw new Error("search_jobs with limit 0 needs aggregations.");
    const body: Record<string, unknown> = {
      filters: input.filters,
      fields: Array.isArray(input.fields) && input.fields.length ? input.fields : DEFAULT_FIELDS,
      sorts: Array.isArray(input.sorts) && input.sorts.length ? input.sorts : [{ field: "metadata.date_added", order: "desc" }],
      limit,
      ...(aggs.length ? { aggregations: aggs } : {}),
      ...(typeof input.cursor === "string" && input.cursor ? { cursor: input.cursor } : {}),
    };
    return exec("POST", "/job/search", body, client.searchJobs(body));
  },
};
