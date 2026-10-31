// "Accept a company anywhere": parse companyId | domain | company (domain, URL or name) from messy input, then resolve
// it to a crustdata_company_id with /company/identify (0 credits). Never guesses silently: a broken domain is a 400
// with a `suggestion`, an unknown domain or an unclear name comes back as no_match / ambiguous with "did you mean"
// suggestions, and Crustdata errors are thrown (the route maps them to a failure), never reported as no_match.
import type { CrustdataClient } from "@/lib/crustdata";
import type { CrustdataCallMeta } from "@/lib/crustdata/types";
import { CrustdataMalformedResponseError } from "@/lib/crustdata/http";
import { clean, normalizeDomainInput } from "./normalize";
import type { IdentifyData, LiveCall } from "./types";

export type CompanyRef = { kind: "id"; id: number } | { kind: "domain"; domain: string; raw: string } | { kind: "name"; name: string };
export type ParsedCompanyRef = { ok: true; ref: CompanyRef } | { ok: false; message: string; suggestion?: string };

export type Suggestion = { companyId: number; name?: string; domain?: string; confidence?: number };
export type ResolvedCompany = { status: "ok"; companyId: number; name?: string; domain?: string; via: "id" | "domain" | "name"; identify?: LiveCall };
export type Unresolved =
  | { status: "no_match"; input: string; message: string; suggestions: Suggestion[]; calls: { identify: LiveCall; suggest?: LiveCall } }
  | { status: "ambiguous"; input: string; message: string; suggestions: Suggestion[]; calls: { identify: LiveCall } };
export type Resolution = ResolvedCompany | Unresolved;

export const MAX_COMPANY_INPUT = 200;
const MAX_SUGGESTIONS = 5;

// control characters, soft hyphen, zero-width / bidi marks, word joiners, BOM
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f­​-‏‪-‮⁠-⁤﻿]/g;

/** Same rule as the routes' companyIdParam: a positive safe integer. */
export function parseCompanyId(raw: string | null): number | undefined {
  const id = raw && /^\d+$/.test(raw) ? Number(raw) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

/** Light repair of an almost-domain ("strpe..com", "stripe,com", "stripe .com", "stripe.com..") — only ever offered as a suggestion. */
function repairDomain(s: string): string | undefined {
  const fixed = s
    .replace(/\s+\./g, ".")
    .replace(/,(?=\S)/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+/, "")
    .replace(/[./\\]+$/, "");
  return normalizeDomainInput(fixed);
}

const looksLikeUrl = (s: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^www\./i.test(s) || /^[^\s/]+\.[^\s/]+\//.test(s);

/**
 * `companyId` (unchanged behaviour), else `domain`, else `company` (a domain, a URL or a company name in any script).
 * Messy input is normalised (trim, case, scheme/www/path, invisible characters); broken domains are rejected with a
 * suggestion instead of being corrected.
 */
export function parseCompanyRef(q: URLSearchParams): ParsedCompanyRef {
  if (q.has("companyId")) {
    const id = parseCompanyId(q.get("companyId"));
    return id ? { ok: true, ref: { kind: "id", id } } : { ok: false, message: "companyId must be a positive integer (crustdata_company_id)" };
  }
  const param = q.has("domain") ? "domain" : "company";
  const raw = q.get(param);
  const s = (raw ?? "").replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
  if (!s) return { ok: false, message: "pass companyId, domain (e.g. e2b.dev) or company (a domain, URL or company name)" };
  if (s.length > MAX_COMPANY_INPUT) return { ok: false, message: `${param} is too long (${s.length} characters, max ${MAX_COMPANY_INPUT})` };
  if (!/[\p{L}\p{N}]/u.test(s)) return { ok: false, message: `${param} must contain a company domain or name (got only symbols/emoji)` };

  const domain = normalizeDomainInput(s);
  if (domain) return { ok: true, ref: { kind: "domain", domain, raw: s } };
  const suggestion = repairDomain(s);
  if (suggestion) return { ok: false, message: `${param} "${s}" is not a valid domain. Did you mean ${suggestion}?`, suggestion };
  if (param === "domain" || looksLikeUrl(s)) return { ok: false, message: `${param} "${s}" is not a valid company domain, e.g. e2b.dev` };
  return { ok: true, ref: { kind: "name", name: s } };
}

/** Case-, whitespace- and punctuation-insensitive form of a company name ("Mercari, Inc" ≠ "Mercari"; "e2b" = "E2B"). */
export const nameKey = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");

type IdentifyRow = {
  matches?: { confidence_score?: number | null; company_data?: { crustdata_company_id?: number | null; basic_info?: { name?: string | null; primary_domain?: string | null; crustdata_company_id?: number | null } | null } | null }[] | null;
};

/** All candidates of an identify response (top-level array, one row per identifier), de-duplicated by id. */
function candidates(data: unknown): Suggestion[] {
  // identify always answers a top-level array; anything else is a broken response, never "no match"
  if (!Array.isArray(data)) throw new CrustdataMalformedResponseError(200, "POST", "/company/identify", JSON.stringify(data) ?? "", "not the documented top-level array");
  const seen = new Set<number>();
  const out: Suggestion[] = [];
  for (const row of data as IdentifyRow[]) {
    for (const m of Array.isArray(row?.matches) ? row.matches : []) {
      const cd = m?.company_data;
      const id = cd?.crustdata_company_id ?? cd?.basic_info?.crustdata_company_id;
      if (id == null || seen.has(id)) continue;
      seen.add(id);
      if (typeof id !== "number") continue;
      const str = (v: unknown) => (typeof v === "string" ? clean(v) : undefined);
      out.push({ companyId: id, name: str(cd?.basic_info?.name), domain: str(cd?.basic_info?.primary_domain), confidence: typeof m?.confidence_score === "number" ? m.confidence_score : undefined });
    }
  }
  return out;
}

const call = <T>(body: unknown, meta: CrustdataCallMeta, status: LiveCall["status"], data?: T): LiveCall<T> => ({
  id: "identify",
  method: "POST",
  path: "/company/identify",
  body,
  status,
  ms: meta.latencyMs,
  cached: meta.cached,
  retrievedAt: meta.retrievedAt,
  creditsUsed: meta.creditsUsed,
  ...(meta.stale ? { stale: true, note: meta.staleNote } : {}),
  ...(data === undefined ? {} : { data }),
});

const ok = (c: Suggestion, via: "domain" | "name", identify: LiveCall): ResolvedCompany => ({ status: "ok", companyId: c.companyId, name: c.name, domain: c.domain, via, identify });
const identifyData = (c: Suggestion): IdentifyData => ({ id: c.companyId, name: c.name ?? c.domain ?? String(c.companyId), confidence: c.confidence });
const didYouMean = (s: Suggestion[]) =>
  s.length ? ` Did you mean ${s.map((x) => (x.domain ? `${x.name ?? x.domain} (${x.domain})` : x.name ?? `#${x.companyId}`)).join(", ")}?` : "";

/** The label a company is named after: "app.razorpay.com" → "razorpay", "flipkart.co.in" → "flipkart", "strpe.com" → "strpe". */
export function brandLabel(domain: string): string {
  const labels = domain.split(".");
  labels.pop(); // TLD
  // second-level public suffixes such as co.in, com.au, co.uk
  if (labels.length >= 2 && labels.at(-1)!.length <= 3 && /^(co|com|net|org|ac|gov|edu|ltd|plc)$/.test(labels.at(-1)!)) labels.pop();
  return labels.at(-1) ?? domain;
}

/**
 * "Did you mean" for a domain with no identify match: identify the first label as a name (0 credits). Suggestions
 * only, never auto-picked. Best effort — if this lookup fails, the honest no_match still stands (the call says why).
 */
export async function suggestForDomain(client: CrustdataClient, domain: string): Promise<{ suggestions: Suggestion[]; message: string; suggest: LiveCall }> {
  const sBody = { names: [brandLabel(domain)], exact_match: false };
  const t0 = Date.now();
  try {
    const sRes = await client.identifyCompany(sBody);
    const suggestions = candidates(sRes.data).slice(0, MAX_SUGGESTIONS);
    return {
      suggestions,
      message: `No company found for the domain ${domain}.${didYouMean(suggestions)}`,
      suggest: call(sBody, sRes.meta, suggestions.length ? "ok" : "no_match", suggestions.length ? suggestions : undefined),
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return {
      suggestions: [],
      message: `No company found for the domain ${domain}.`,
      suggest: { id: "identify", method: "POST", path: "/company/identify", body: sBody, status: "error", ms: Date.now() - t0, cached: false, retrievedAt: null, creditsUsed: null, error },
    };
  }
}

/** Resolve a parsed reference to a crustdata_company_id. Throws on Crustdata errors (never turned into no_match). */
export async function resolveCompany(client: CrustdataClient, ref: CompanyRef): Promise<Resolution> {
  if (ref.kind === "id") return { status: "ok", companyId: ref.id, via: "id" };

  if (ref.kind === "domain") {
    const body = { domains: [ref.domain] };
    const res = await client.identifyCompany(body);
    const match = candidates(res.data)[0];
    if (match) return ok(match, "domain", call(body, res.meta, "ok", identifyData(match)));
    const identify = call(body, res.meta, "no_match");
    const { suggestions, message, suggest } = await suggestForDomain(client, ref.domain);
    return { status: "no_match", input: ref.domain, message, suggestions, calls: { identify, suggest } };
  }

  const body = { names: [ref.name], exact_match: false };
  const res = await client.identifyCompany(body);
  const all = candidates(res.data);
  const exact = all.filter((c) => c.name && nameKey(c.name) === nameKey(ref.name));
  if (exact.length === 1) return ok(exact[0]!, "name", call(body, res.meta, "ok", identifyData(exact[0]!)));
  if (exact.length > 1) {
    const suggestions = exact.slice(0, MAX_SUGGESTIONS);
    return {
      status: "ambiguous",
      input: ref.name,
      message: `"${ref.name}" matches ${exact.length} companies; pass domain= or companyId= to pick one.${didYouMean(suggestions)}`,
      suggestions,
      calls: { identify: call(body, res.meta, "ok", suggestions) },
    };
  }
  // no exact name: the fuzzy candidates are suggestions only
  const suggestions = all.slice(0, MAX_SUGGESTIONS);
  return {
    status: "no_match",
    input: ref.name,
    message: `No company named "${ref.name}" found.${didYouMean(suggestions)}`,
    suggestions,
    calls: { identify: call(body, res.meta, suggestions.length ? "ok" : "no_match", suggestions.length ? suggestions : undefined) },
  };
}

/** `resolved` block added to a route's response when the company was given as a domain or name. */
export const resolvedInfo = (r: ResolvedCompany) => ({ companyId: r.companyId, name: r.name, domain: r.domain, via: r.via, identify: r.identify });

/**
 * Shared body of the id-keyed routes (people, jobs): id → `run(id)` unchanged; domain/name → resolve, then
 * `{ ...run(id), resolved }`, or the no_match / ambiguous Resolution (HTTP 200) when it does not resolve.
 */
export async function runForCompany<T extends object>(client: CrustdataClient, ref: CompanyRef, run: (companyId: number) => Promise<T>) {
  if (ref.kind === "id") return run(ref.id);
  const r = await resolveCompany(client, ref);
  if (r.status !== "ok") return r;
  return { ...(await run(r.companyId)), resolved: resolvedInfo(r) };
}

/** parseCompanyRef in liveRoute's `parse` shape. */
export function companyRefParam(q: URLSearchParams): { ok: true; input: CompanyRef } | { ok: false; message: string; suggestion?: string } {
  const p = parseCompanyRef(q);
  return p.ok ? { ok: true, input: p.ref } : p;
}
