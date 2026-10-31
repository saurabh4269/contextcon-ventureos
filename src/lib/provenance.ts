// Provenance: one `Why` (reasons + clickable sources) for any value the product shows, whatever shape it arrived in:
//   · ComputedField (src/lib/fields.ts) — numbers, decisions, valuation; inputs that are themselves ComputedFields
//     (e.g. a verdict's criteria) become evidence rows with their own sources;
//   · a raw value read straight from one live Crustdata call (LiveCall + JSON path), e.g. a founder or a comparable;
//   · an agent cell (verified / corrected / unavailable, cited by ledger ref — the screening agent's contract).
// Plus the guards that keep "every number has a source" true: `uncitedOk` finds ok values without a usable source
// and `enforceCited` withholds them (status → unavailable) instead of shipping an unsourced number.
import type { Why, WhyEvidence, WhySource } from "@port/types";
import { isOk, unavailable, type Citation, type ComputedField } from "@/lib/fields";
import { fmtDateTime, fmtMoney, isMoney } from "@/lib/format";

export type { Why, WhyEvidence, WhySource };

/** The parts of an upstream call a source chip shows (LiveCall and the agent's LedgerCall both fit). */
export type CallMeta = {
  method: string;
  path: string;
  retrievedAt: string | null;
  cached: boolean;
  creditsUsed: string | number | null;
  ref?: string;
};

/* ── sources ── */

/** A citation is usable when it names its source and either an external URL or the endpoint + JSON path, and when. */
export function isUsableCitation(c: unknown): c is Citation {
  if (!c || typeof c !== "object") return false;
  const x = c as Citation;
  const where = !!x.url || (!!x.endpoint && !!x.path);
  return !!x.source && where && !!x.retrievedAt && !Number.isNaN(Date.parse(String(x.retrievedAt)));
}

const creditsText = (v: unknown) => (v == null || v === "" ? undefined : String(v));
const endpointOf = (c: CallMeta) => `${c.method} ${c.path}`;

export function sourceFromCall(call: CallMeta, path?: string, url?: string): WhySource {
  return {
    label: "Crustdata",
    endpoint: endpointOf(call),
    ...(path ? { path } : {}),
    ...(url ? { url } : {}),
    ...(call.retrievedAt ? { retrievedAt: call.retrievedAt, retrieved: fmtDateTime(call.retrievedAt) } : {}),
    cached: call.cached,
    ...(creditsText(call.creditsUsed) ? { credits: creditsText(call.creditsUsed) } : {}),
    ...(call.ref ? { ref: call.ref } : {}),
  };
}

/** Citation → chip. Cached/credits come from the citation when it carries them, else from the matching call. */
export function sourceFromCitation(c: Citation, calls: CallMeta[] = []): WhySource {
  const call = c.endpoint ? calls.find((x) => endpointOf(x) === c.endpoint) : undefined;
  const at = (c.retrievedAt as string | undefined) ?? call?.retrievedAt ?? undefined;
  const cached = typeof c.cached === "boolean" ? c.cached : call?.cached;
  const credits = creditsText(c.creditsUsed ?? call?.creditsUsed);
  return {
    label: c.source,
    ...(c.endpoint ? { endpoint: c.endpoint } : {}),
    ...(c.path ? { path: c.path } : {}),
    ...(c.url ? { url: c.url } : {}),
    // a stale-cache fallback (Crustdata was down) says so next to the time it was fetched
    ...(at ? { retrievedAt: at, retrieved: `${fmtDateTime(at)}${c.stale ? " · stale: Crustdata was unavailable" : ""}` } : {}),
    ...(cached != null ? { cached } : {}),
    ...(credits ? { credits } : {}),
  };
}

/* ── values ── */

const looksLikeField = (v: unknown): v is ComputedField<unknown> =>
  !!v && typeof v === "object" && ((v as { status?: unknown }).status === "ok" ? "value" in (v as object) : (v as { status?: unknown }).status === "unavailable" && typeof (v as { reason?: unknown }).reason === "string");

/** Evidence value as text: money in its own currency (never converted), numbers grouped, null says so. */
export function evidenceText(v: unknown): string {
  if (v === null || v === undefined) return "not returned";
  if (isMoney(v)) return `${fmtMoney(v, { compact: false })} (${v.currency})`;
  if (typeof v === "number") return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "string") return v;
  const s = JSON.stringify(v);
  return s.length > 160 ? `${s.slice(0, 159)}…` : s;
}

/** pass/fail for a criterion value: booleans, "pass"/"fail"/"met"/"not met"-style strings, `{ pass | met | ok }` objects. */
export function verdictOf(v: unknown): WhyEvidence["verdict"] {
  const b = typeof v === "object" && v ? ((v as Record<string, unknown>).pass ?? (v as Record<string, unknown>).met ?? (v as Record<string, unknown>).ok) : v;
  if (typeof b === "boolean") return b ? "pass" : "fail";
  if (typeof b === "string") {
    const s = b.toLowerCase().trim();
    if (/^(pass|passed|met|yes|true|fit|strong|ok)$/.test(s)) return "pass";
    if (/^(fail|failed|not met|no|false|miss|weak|reject)$/.test(s)) return "fail";
  }
  return undefined;
}

/** Why for a ComputedField. Inputs that are ComputedFields (criteria of a decision) get their own nested Why. */
export function whyFromField(f: ComputedField<unknown> | undefined | null, calls: CallMeta[] = []): Why {
  if (!f) return { status: "unavailable", summary: "Not provided by the API.", evidence: [], sources: [] };
  if (!isOk(f)) return { status: "unavailable", summary: f.reason, evidence: [], sources: [] };
  return {
    status: "ok",
    summary: f.reasoning,
    method: f.method,
    evidence: (f.inputs ?? []).map((i): WhyEvidence => {
      if (looksLikeField(i.value)) {
        const why = whyFromField(i.value, calls);
        return { name: i.name, value: isOk(i.value) ? evidenceText(i.value.value) : "unavailable", verdict: isOk(i.value) ? verdictOf(i.value.value) : "unknown", why };
      }
      return { name: i.name, value: evidenceText(i.value), ...(verdictOf(i.verdict ?? i.pass ?? i.met) ? { verdict: verdictOf(i.verdict ?? i.pass ?? i.met) } : {}) };
    }),
    sources: (f.citations ?? []).map((c) => sourceFromCitation(c, calls)),
  };
}

/** Why for a decision (verdict / fit score) and the criteria it was decided on, each a ComputedField with sources. */
export function whyFromDecision(decision: ComputedField<unknown> | undefined | null, criteria: { name: string; field: ComputedField<unknown> | undefined }[], calls: CallMeta[] = []): Why {
  const base = whyFromField(decision, calls);
  const rows: WhyEvidence[] = criteria.map(({ name, field }) => ({
    name,
    value: isOk(field) ? evidenceText(field.value) : "unavailable",
    verdict: isOk(field) ? verdictOf(field.value) ?? undefined : "unknown",
    why: whyFromField(field, calls),
  }));
  return { ...base, evidence: [...rows, ...base.evidence.filter((e) => !rows.some((r) => r.name === e.name))] };
}

/** Why for a value read directly from one live call (no computation): the call's endpoint + the JSON path. */
export function whyFromCall(call: (CallMeta & { status?: string; error?: string; note?: string }) | undefined, path: string, summary: string, opts: { url?: string; method?: string } = {}): Why {
  if (!call || call.status === "error" || call.status === "skipped" || !call.retrievedAt)
    return { status: "unavailable", summary: call?.error ?? call?.note ?? "No upstream call returned this value.", evidence: [], sources: [] };
  return { status: "ok", summary, method: opts.method ?? "Read as returned", evidence: [], sources: [sourceFromCall(call, path, opts.url)] };
}

/** Agent cell (screening agent contract): verified / corrected / unavailable with a ledger-ref citation. */
export type AgentCellLike = {
  label?: string;
  value: unknown;
  status: "verified" | "corrected" | "unavailable";
  claimed?: unknown;
  reason?: string;
  citation?: { ref: string; method: string; endpoint: string; path: string; retrievedAt: string | null };
};
export function whyFromAgentCell(cell: AgentCellLike, ledger: CallMeta[] = []): Why {
  if (cell.status === "unavailable") return { status: "unavailable", summary: cell.reason ?? "No cited value.", evidence: [], sources: [] };
  const c = cell.citation;
  const call = c ? ledger.find((x) => x.ref === c.ref) : undefined;
  const src: WhySource[] = c
    ? [{
        label: "Crustdata",
        endpoint: `${c.method} ${c.endpoint}`,
        path: c.path,
        ref: c.ref,
        ...(c.retrievedAt ? { retrievedAt: c.retrievedAt, retrieved: fmtDateTime(c.retrievedAt) } : {}),
        ...(call ? { cached: call.cached } : {}),
        ...(creditsText(call?.creditsUsed) ? { credits: creditsText(call?.creditsUsed) } : {}),
      }]
    : [];
  return cell.status === "verified"
    ? { status: "verified", summary: "The value was checked against the cited path in the raw Crustdata response.", method: "Server-side citation check", evidence: [], sources: src }
    : { status: "corrected", summary: `The model said ${evidenceText(cell.claimed)}; the cited Crustdata path holds ${evidenceText(cell.value)}, which is shown instead.`, method: "Server-side citation check", evidence: [{ name: "model claimed", value: evidenceText(cell.claimed) }], sources: src };
}

/* ── guards ── */

/**
 * Walk any payload (API response, builder output) and list every ComputedField with status "ok" that has no usable
 * citation (source + URL or endpoint + path, and retrievedAt). Nested fields (criteria in inputs) are checked too.
 */
export function uncitedOk(payload: unknown, at = "$"): string[] {
  const out: string[] = [];
  const seen = new Set<unknown>();
  const walk = (v: unknown, p: string) => {
    if (!v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${p}[${i}]`));
    const o = v as Record<string, unknown>;
    if (o.status === "ok" && "value" in o && o.value !== null && o.value !== undefined) {
      const cites = Array.isArray(o.citations) ? o.citations : [];
      if (!cites.some(isUsableCitation)) out.push(p);
    }
    for (const [k, x] of Object.entries(o)) walk(x, `${p}.${k}`);
  };
  walk(payload, at);
  return out;
}

/** Replace every ok field without a usable source by `unavailable` (the number is withheld, never shown unsourced). */
export function enforceCited<T extends Record<string, ComputedField<unknown>>>(fields: T): T {
  return Object.fromEntries(
    Object.entries(fields).map(([k, f]) => [k, isOk(f) && uncitedOk(f).length ? unavailable(`Withheld: no source (endpoint and path, or URL, with retrieval time) was recorded for this ${k} value.`) : f]),
  ) as T;
}
