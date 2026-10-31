/** Default RPM from https://docs.crustdata.com/general/rate-limits.md (api-version 2025-11-01) */
import { rateLimitKeyForPath } from "./request-path";
export const DEFAULT_RATE_LIMITS_RPM: Record<string, number> = {
  "/company/enrich": 15,
  "/company/search": 30,
  "/company/identify": 30,
  "/company/search/autocomplete": 300,
  "/person/enrich": 15,
  "/person/search": 30,
  "/person/identify": 30,
  "/person/search/autocomplete": 300,
  "/job/search": 30,
  "/web/search/live": 10,
  "/web/enrich/live": 10,
  "/watch/company": 10,
  "/watch/company/:id": 10,
  "/watch/company/:id/runs": 10,
  "/watch/person": 10,
  "/watch/job/search": 10,
};

export function rpmForPath(path: string): number {
  const key = rateLimitKeyForPath(path);
  return DEFAULT_RATE_LIMITS_RPM[key] ?? DEFAULT_RATE_LIMITS_RPM[path] ?? 30;
}
