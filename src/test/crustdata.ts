// TEST-ONLY. Serves the checked-in Crustdata captures (docs/crustdata/fixtures: real E2B responses from 2026-10-31,
// api 2025-11-01, emails/phones stripped) through an injected `fetch`, so unit tests exercise the real client, HTTP
// handling and normalizers without network or credits. Production code must never import this module (enforced by
// src/test/guards.test.ts).
import fs from "node:fs";
import path from "node:path";
import { createCrustdataClient, CRUSTDATA_BASE_URL } from "@/lib/crustdata";
import { CRUSTDATA_DEMO_E2B } from "@/lib/crustdata/demo-targets";
import { companyIdFromJobSearchBody } from "@/lib/crustdata/job-queries";
import { companyIdFromPersonSearchBody } from "@/lib/crustdata/person-queries";

const FIXTURE_ROOT = path.join(process.cwd(), "docs/crustdata/fixtures");
const ID_DOMAINS: Record<number, string> = { [CRUSTDATA_DEMO_E2B.crustdataCompanyId]: CRUSTDATA_DEMO_E2B.domain };

/** e2b.dev → e2b, acme-robotics.com → acme-robotics */
const slug = (domain: string) => domain.toLowerCase().replace(/^www\./, "").replace(/\.[a-z]{2,}(?:\.[a-z]{2,})?$/i, "").replace(/\./g, "-");

export function loadFixture<T>(name: string): T {
  const file = path.join(FIXTURE_ROOT, name);
  if (!fs.existsSync(file)) throw new Error(`Missing Crustdata fixture ${name} (expected at ${file})`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}
const has = (name: string) => fs.existsSync(path.join(FIXTURE_ROOT, name));

type Route = { file: string; credits: string } | { status: number; body: unknown };

function route(method: string, p: string, body: Record<string, unknown>): Route {
  const domain = (body.domains as string[] | undefined)?.[0] ?? ID_DOMAINS[Number((body.crustdata_company_ids as unknown[] | undefined)?.[0])];
  const byDomain = (prefix: string, credits: string): Route =>
    domain && has(`${prefix}-${slug(domain)}.json`) ? { file: `${prefix}-${slug(domain)}.json`, credits } : { status: 404, body: { error: `no ${prefix} capture for ${domain}` } };
  const byCompany = (prefix: string, id: number | null | undefined, credits: string): Route => {
    const d = id != null ? ID_DOMAINS[id] : undefined;
    return { file: d && has(`${prefix}-${slug(d)}.json`) ? `${prefix}-${slug(d)}.json` : `${prefix}-empty.json`, credits };
  };
  switch (`${method} ${p}`) {
    case "POST /company/identify": return byDomain("company-identify", "0");
    case "POST /company/enrich": return byDomain("company-enrich", "2");
    case "POST /company/search": return { status: 200, body: { companies: [], next_cursor: null, total_count: 0 } };
    case "POST /person/search": return byCompany("person-search", companyIdFromPersonSearchBody(body), "0.66");
    case "POST /person/enrich": return { file: "person-enrich-e2b-founder.json", credits: "1" };
    case "POST /job/search": return byCompany("job-search", companyIdFromJobSearchBody(body), "0.75");
    case "POST /web/search/live": return { file: "web-search-live.json", credits: "1" };
    default: return { status: 501, body: { error: `no capture for ${method} ${p}` } };
  }
}

/** A `fetch` that answers Crustdata requests from the captures. Records every request for assertions. */
export function fixtureFetch(log: { method: string; path: string; body: unknown }[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const p = url.startsWith(CRUSTDATA_BASE_URL) ? url.slice(CRUSTDATA_BASE_URL.length) : url;
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    log.push({ method, path: p, body });
    const r = route(method, p, body);
    if ("file" in r) return new Response(fs.readFileSync(path.join(FIXTURE_ROOT, r.file), "utf8"), { status: 200, headers: { "content-type": "application/json", "x-credits-used": r.credits } });
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

/** The real client wired to the captures (dummy key; never reaches the network). */
export const fixtureClient = (log?: { method: string; path: string; body: unknown }[]) => createCrustdataClient({ apiKey: "test-key-not-real", fetchImpl: fixtureFetch(log) });
