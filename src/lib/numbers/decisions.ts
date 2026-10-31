// GET /api/deals/:id/decisions — the builder's decision contract (builder main e28ea49, route
// src/app/api/deals/[id]/decisions): { dealId, companyDomain, decisions, endpoints, fields }, every decision a ComputedField.
//
// Two sources, never a fixture:
//   · this build: decisions computed locally (src/lib/numbers/local.ts: firm mandate × live Crustdata research × peers
//     × firm memory, via resolveDealNumbers); anything an input is missing for is unavailable with the reason;
//   · the builder backend, only when DEALDESK_BUILDER_URL is set (an optional override): its ok decisions replace ours
//     after their citations are re-anchored to the call we made (endpoint + JSON path + retrieval time). Fields citing
//     fixture/sample/demo sources, or with no citations, are dropped and the local value stays. Any builder failure
//     falls back to the local values.
import { isOk, ok, unavailable, type Citation, type ComputedField, type FieldInput } from "@/lib/fields";
import { enforceCited } from "@/lib/provenance";
import { isMoney, fmtMoney } from "@/lib/format";
import type { DealNumbers, DealValuation } from "./deal-numbers";

export const DECISION_KEYS = [
  "fitScore",
  "screenerVerdict",
  "valuationRange",
  "returnMultipleLow",
  "returnMultipleHigh",
  "compsMedianMultiple",
  "diligenceVerdict",
  "icMemoArrUsedM",
  "icMemoValuation",
  "icMemoCompsLine",
] as const;
export type DecisionKey = (typeof DECISION_KEYS)[number];
export type Decisions = Record<DecisionKey, ComputedField<unknown>>;

/** Builder fields plus this build's valuation stats (valuationLow/High/Cap, founderAsk) and Crustdata company numbers. */
export type DecisionFields = DealNumbers &
  Decisions & { valuationLow: ComputedField<unknown>; valuationHigh: ComputedField<unknown>; valuationCap: ComputedField<unknown>; founderAsk: ComputedField<unknown> };

export type DecisionsResponse = {
  dealId: string;
  companyDomain: string;
  /** "crustdata" = this build only; "crustdata+builder" = at least one decision came from the builder backend. */
  source: "crustdata" | "crustdata+builder";
  decisions: Decisions;
  endpoints: Record<string, string>;
  fields: DecisionFields;
  builder?: { status: "used" | "not_configured" | "unavailable"; reason?: string };
  /** Review queue (/review) items for this deal's decisions: unavailable or partial-input decisions wait for a person. */
  review?: { runId: string; href: string; open: { id: string; key: string; kind: string }[]; resolved: { id: string; key: string; status: string }[] };
};

const SCREENER = "The screener verdict is computed from the fit score against the firm mandate; it was not computed for this deal.";

const moneyText = (v: unknown) => (isMoney(v) ? fmtMoney(v) : String(v));

/** Valuation range from the low/high fields: only when both are ok; the citations are theirs. */
function rangeField(low: ComputedField<unknown>, high: ComputedField<unknown>): ComputedField<unknown> {
  if (!isOk(low) || !isOk(high)) return unavailable(low.status === "unavailable" ? low.reason : high.status === "unavailable" ? high.reason : "Valuation range unavailable.");
  return ok(`${moneyText(low.value)}–${moneyText(high.value)}`, `Low and high of the valuation (${low.method})`, low.reasoning, [...low.citations, ...high.citations], [
    { name: "low", value: low.value },
    { name: "high", value: high.value },
  ]);
}

export function localDecisions(domain: string, numbers: DealNumbers, valuation: DealValuation, screener?: ComputedField<unknown>): DecisionsResponse {
  const fields: DecisionFields = {
    ...numbers,
    screenerVerdict: screener ?? unavailable(SCREENER),
    valuationRange: rangeField(valuation.low, valuation.high),
    valuationLow: valuation.low,
    valuationHigh: valuation.high,
    valuationCap: valuation.cap,
    founderAsk: valuation.ask,
    // the valuation route's multiples are the authoritative ones when they differ from the numbers route
    returnMultipleLow: isOk(valuation.returnMultipleLow) ? valuation.returnMultipleLow : numbers.returnMultipleLow,
    returnMultipleHigh: isOk(valuation.returnMultipleHigh) ? valuation.returnMultipleHigh : numbers.returnMultipleHigh,
    compsMedianMultiple: isOk(valuation.compsMedianMultiple) ? valuation.compsMedianMultiple : numbers.compsMedianMultiple,
  };
  return { dealId: domain, companyDomain: domain, source: "crustdata", ...pick(domain, enforceCited(fields)) };
}

function pick(id: string, fields: DecisionFields): Pick<DecisionsResponse, "decisions" | "endpoints" | "fields"> {
  const decisions = Object.fromEntries(DECISION_KEYS.map((k) => [k, fields[k]])) as Decisions;
  const enc = encodeURIComponent(id);
  const endpoints: Record<string, string> = Object.fromEntries(DECISION_KEYS.map((k) => [k, `/api/deals/${enc}/decisions#${k}`]));
  endpoints.valuationRange = `/api/deals/${enc}/valuation`;
  for (const k of ["returnMultipleLow", "returnMultipleHigh", "compsMedianMultiple"]) endpoints[k] = `/api/deals/${enc}/valuation#${k}`;
  return { decisions, endpoints, fields };
}

/* ── builder backend (opt-in) ── */

type BuilderCitation = { label?: string; value?: unknown; source?: string; ref?: string; url?: string };
type BuilderField = { status?: string; value?: unknown; inputs?: { label?: string; name?: string; value?: unknown; source?: string }[]; method?: string; citations?: BuilderCitation[]; reasoning?: string; reason?: string };

const NOT_REAL = /fixture|sample|demo|seed|mock/i;

/** One builder field → ours, with each citation pointing at the decisions call we made. null when it cannot be trusted. */
export function fromBuilderField(key: string, f: unknown, call: { url: string; endpoint: string; retrievedAt: string }): ComputedField<unknown> | null {
  const b = f as BuilderField | null;
  if (!b || b.status !== "ok" || b.value === undefined || b.value === null) return null;
  const cites = Array.isArray(b.citations) ? b.citations : [];
  if (!cites.length) return null;
  const all = [...cites.map((c) => `${c.source ?? ""} ${c.ref ?? ""} ${c.label ?? ""}`), ...(b.inputs ?? []).map((i) => `${i.source ?? ""}`), b.method ?? ""];
  if (all.some((s) => NOT_REAL.test(s))) return null;
  const citations: Citation[] = cites.map((c, i) => ({
    source: `Deal Desk builder · ${c.source ?? "unknown"}`,
    endpoint: call.endpoint,
    path: `fields.${key}.citations[${i}]`,
    retrievedAt: call.retrievedAt,
    ...(c.url ? { url: c.url } : {}),
    ...(c.label ? { label: c.label } : {}),
    ...(c.value !== undefined ? { value: c.value } : {}),
    ...(c.ref ? { ref: c.ref } : {}),
  }));
  const inputs: FieldInput[] = (b.inputs ?? []).map((i) => ({ name: i.name ?? i.label ?? "input", value: i.value, ...(i.source ? { source: i.source } : {}) }));
  return ok(b.value, b.method ?? "Builder decision engine", b.reasoning ?? "", citations, inputs);
}

export async function withBuilder(local: DecisionsResponse, opts: { baseUrl?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {}): Promise<DecisionsResponse> {
  const base = (opts.baseUrl ?? process.env.DEALDESK_BUILDER_URL ?? "").replace(/\/+$/, "");
  if (!base) return { ...local, builder: { status: "not_configured" } };
  const path = `/api/deals/${encodeURIComponent(local.companyDomain)}/decisions`;
  const url = `${base}${path}`;
  const retrievedAt = new Date().toISOString();
  try {
    const res = await (opts.fetchImpl ?? fetch)(url, { headers: { accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(opts.timeoutMs ?? 8000) });
    if (!res.ok) return { ...local, builder: { status: "unavailable", reason: `Builder backend answered HTTP ${res.status} for this deal.` } };
    const body = (await res.json()) as { fields?: Record<string, unknown>; decisions?: Record<string, unknown> };
    const src = { ...(body.fields ?? {}), ...(body.decisions ?? {}) };
    const call = { url, endpoint: `GET ${path}`, retrievedAt };
    const fields = { ...local.fields } as Record<string, ComputedField<unknown>>;
    let used = 0;
    for (const k of DECISION_KEYS) {
      const f = fromBuilderField(k, src[k], call); // a trusted builder decision overrides the local one
      if (f) { fields[k] = f; used++; }
    }
    if (!used) return { ...local, builder: { status: "unavailable", reason: "Builder backend returned no cited decisions for this deal." } };
    return { ...local, source: "crustdata+builder", ...pick(local.dealId, enforceCited(fields as DecisionFields)), builder: { status: "used" } };
  } catch (e) {
    return { ...local, builder: { status: "unavailable", reason: `Builder backend unreachable (${e instanceof Error ? e.name : "error"}).` } };
  }
}
