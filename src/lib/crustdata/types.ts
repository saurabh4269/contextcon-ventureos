// Request/response types generated from Crustdata's OpenAPI (2025-11-01) — see scripts/crustdata-extract-openapi.mjs
// and scripts/crustdata-codegen.mjs. Only the aliases the app uses are re-exported here.
import type { components as CompanyComponents } from "./generated/company";
import type { components as PersonComponents } from "./generated/person";
import type { components as JobComponents } from "./generated/job";
import type { components as WebComponents } from "./generated/web";

export type CompanyIdentifyResponse = CompanyComponents["schemas"]["CompanyIdentifyResponse"];
export type CompanyIdentifyRequest = CompanyComponents["schemas"]["CompanyIdentifyRequest"];
export type CompanyEnrichResponse = CompanyComponents["schemas"]["CompanyEnrichResponse"];
export type CompanyEnrichRequest = CompanyComponents["schemas"]["CompanyEnrichRequest"];
export type CompanyEnrichData = CompanyComponents["schemas"]["CompanyEnrich"];
export type CompanySearchRequest = CompanyComponents["schemas"]["CompanySearchRequest"];
export type CompanySearchResponse = CompanyComponents["schemas"]["CompanySearchResponse"];
export type CompanySearchRow = CompanyComponents["schemas"]["CompanySearch"];

export type PersonSearchResponse = PersonComponents["schemas"]["PersonSearchResponse"];
export type PersonSearchProfile = PersonComponents["schemas"]["PersonSearch"];
export type PersonEmployment = PersonComponents["schemas"]["PersonSearchEmploymentDetails"];
export type PersonEnrichResponse = PersonComponents["schemas"]["PersonEnrichResponse"];
export type PersonEnrichData = PersonComponents["schemas"]["PersonEnrich"];

export type JobSearchResponse = JobComponents["schemas"]["JobSearchResponse"];
export type JobListing = JobComponents["schemas"]["Job"];

export type WebSearchLiveRequest = WebComponents["schemas"]["WebSearchRequest"];
export type WebSearchLiveResponse = WebComponents["schemas"]["WebSearchResponse"];
export type WebSearchResult = WebComponents["schemas"]["WebSearchResult"];

export type CrustdataErrorBody = {
  error?: string | { type?: string; message?: string; metadata?: unknown[] };
  description?: string;
  reason?: string;
  message?: string;
};

export type CrustdataCallMeta = {
  mode: "live" | "fixture";
  path: string;
  /** `X-Credits-Used` header of the original response (null when the header was absent or in fixture mode). */
  creditsUsed: string | null;
  requestId: string | null;
  asOf: string;
  /** Observed latency of the original network call, ms (0 for fixtures). */
  latencyMs: number;
  /** True when served from the response cache (no credits spent for this read). */
  cached: boolean;
  fixtureLabel?: string;
};
