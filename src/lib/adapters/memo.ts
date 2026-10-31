// Live IC memo (port MemoScreen, the same layout as the fixture memo) from real sources only:
//   · GET /api/deals/:domain/decisions → verdict, valuation range, revenue used, risk flags, open review items, and the
//     numbered sources (one per cited endpoint across the ok fields);
//   · GET /api/live/research?domain=  → company name, logo and last round type (title).
// Nothing the API does not compute is shown as a number: no cap or founder ask (term sheets are not ingested) → "—"
// with the API's reason; no ARR bridge or deck-vs-bank growth figure; no analyst disagreement.
import type { FlagLevel, MemoData, OutlineItem, SourceRef, SrcKind, StepState, Valuation } from "@port/types";
import { isOk, type Citation, type ComputedField } from "@/lib/fields";
import { fmtDate, fmtMoney, fmtTime, isMoney, money } from "@/lib/format";
import type { DecisionsResponse } from "@/lib/numbers/decisions";
import type { ResearchResult } from "@/lib/live/types";

type F = ComputedField<unknown>;
type ResearchOk = Extract<ResearchResult, { status: "ok" }>;

const LABEL: Record<string, string> = {
  fitScore: "Fit score", screenerVerdict: "Screener verdict", diligenceVerdict: "Diligence verdict",
  criterionSector: "Sector", criterionStage: "Stage", criterionGeo: "Geography", criterionCheckSize: "Check size", criterionMemory: "Firm memory",
  valuationRange: "Valuation range", valuationLow: "Valuation (low)", valuationHigh: "Valuation (high)", valuationCap: "Valuation cap", founderAsk: "Founder ask",
  returnMultipleLow: "Return multiple (low)", returnMultipleHigh: "Return multiple (high)", compsMedianMultiple: "Comps median multiple",
  icMemoArrUsedM: "Est. revenue (Crustdata)", icMemoValuation: "Memo valuation", icMemoCompsLine: "Comps line",
  growthYoY: "Headcount growth", headcountLatest: "Headcount", lastFundingUsdM: "Last funding round",
};
const label = (k: string) => LABEL[k] ?? k;
/** The memo box caption for the revenue figure (port default "Verified ARR" is for founder-provided, checked numbers). */
export const REVENUE_LABEL = "Est. revenue (Crustdata)";

/** USD money or a plain number already in $M → $M, rounded to 2 decimals (null when neither). */
const toM = (v: unknown): number | null => {
  const n = isMoney(v) ? (v.currency === "USD" ? v.amount / 1e6 : NaN) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

const kindOf = (c: Citation): SrcKind => (/crustdata/i.test(c.source) ? "crust" : /mandate|settings|review|memory/i.test(c.source) ? "db" : c.url ? "web" : "db");
const endpointOf = (c: Citation) => `${c.source.replace(/\s*\(.*\)\s*$/, "")} · ${(c.endpoint ?? c.url ?? "").replace(/^(GET|POST|PUT|PATCH|DELETE) /, "")}`.replace(/ · $/, "");

/** One numbered source per cited endpoint, in field order. */
export function memoSources(fields: Record<string, F>): { sources: SourceRef[]; citeOf: (k: string) => number } {
  const by = new Map<string, SourceRef>();
  const first = new Map<string, number>();
  for (const [k, f] of Object.entries(fields)) {
    if (!isOk(f)) continue;
    for (const c of f.citations) {
      const key = endpointOf(c);
      if (!by.has(key)) by.set(key, { kind: kindOf(c), label: key, n: by.size + 1, ...(c.url && /^https?:/.test(c.url) ? { href: c.url } : {}) });
      if (!first.has(k)) first.set(k, by.get(key)!.n!);
    }
  }
  return { sources: [...by.values()], citeOf: (k) => first.get(k) ?? 0 };
}

/** Risk flags the diligence verdict found ("Flags: a; b." in its reasoning). No severity is computed, so each is "mid". */
export function riskFlags(f: F | undefined): FlagLevel[] {
  if (!isOk(f)) return [];
  const m = /Flags: (.+?)\.?$/.exec(f.reasoning);
  return m ? m[1]!.split(";").map((): FlagLevel => "mid") : [];
}

const latestAt = (fields: Record<string, F>) => {
  const at = Object.values(fields).flatMap((f) => (isOk(f) ? f.citations.map((c) => c.retrievedAt).filter((x): x is string => !!x) : []));
  return at.length ? at.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a)) : null;
};

/** Axis for the range chart: 0 to the high plus a quarter, rounded up to a whole $M. */
const axisFor = (high: number) => ({ min: 0, max: Math.max(1, Math.ceil(high * 1.25)) });

export function toLiveMemo(domain: string, d: DecisionsResponse, research: ResearchOk | null): MemoData {
  const fields = d.fields as unknown as Record<string, F>;
  const { sources, citeOf } = memoSources(fields);
  const c = research?.company;
  const name = c?.name ?? domain;
  const lo = fields.valuationLow, hi = fields.valuationHigh, cap = fields.valuationCap, ask = fields.founderAsk;
  const low = isOk(lo) ? toM(lo.value) : null, high = isOk(hi) ? toM(hi.value) : null;
  const priced = low != null && high != null;
  const why = (f: F | undefined, k: string) => (f && !isOk(f) ? f.reason : `${label(k)} not provided by the API.`);
  const valuation: Valuation = {
    basis: "pre-money",
    currency: "USD",
    unit: "M",
    // Unpriced: NaN renders "—" in the range text and no bars; the empty chart keeps the layout.
    low: low ?? NaN,
    high: high ?? NaN,
    cap: isOk(cap) ? toM(cap.value) ?? NaN : NaN,
    ...(isOk(ask) && toM(ask.value) != null ? { ask: toM(ask.value)! } : {}),
    capRationale: isOk(cap) ? cap.reasoning : why(cap, "valuationCap"),
    source: { kind: "crust", label: isOk(lo) ? lo.method : why(lo, "valuationLow") },
    axis: axisFor(high ?? 1),
  };
  const arr = fields.icMemoArrUsedM;
  const arrM = isOk(arr) ? toM(arr.value) : null;
  const verdict = fields.diligenceVerdict;
  const open = d.review?.open ?? [];
  const at = latestAt(fields);
  const ok = Object.values(fields).filter(isOk).length;
  const total = Object.keys(fields).length;
  const unavailable = Object.entries(fields).filter(([, f]) => !isOk(f));
  const state = (done: boolean, warn = false): StepState => (done ? (warn ? "warn" : "done") : "queued");
  const outline: OutlineItem[] = [
    { id: "rec", label: "Recommendation", state: state(isOk(verdict), open.some((o) => o.key === "diligenceVerdict")), selected: true },
    { id: "ov", label: "Company overview", state: state(!!research) },
    { id: "dd", label: "Diligence findings", state: state(isOk(verdict), riskFlags(verdict).length > 0) },
    { id: "val", label: "Valuation", state: state(priced) },
    { id: "icq", label: "Expected IC questions", state: state(true, unavailable.length > 0) },
    { id: "close", label: "Closing conditions", state: state(true, open.length > 0) },
  ];
  return {
    company: { id: domain, name, initial: name[0]!.toUpperCase(), ...(c?.logoUrl ? { logoUrl: c.logoUrl } : {}), domain },
    outline,
    meta: { draft: at ? `Draft from live data · ${fmtDate(at)}` : "Draft from live data", citations: ok, unsupported: 0 },
    title: c?.funding.lastRoundType ? `${name} · ${c.funding.lastRoundType.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase())}` : name,
    recommendation: {
      verdict: isOk(verdict) ? String(verdict.value) : "No recommendation yet",
      valuation,
      valuationCite: citeOf("valuationLow"),
      // Crustdata's estimated revenue midpoint, not founder-provided or checked: never labelled "verified". "~" marks
      // the estimate; the cite gives its source.
      verifiedArr: { value: arrM != null ? `~${fmtMoney(money(arrM * 1e6, "USD"))}` : "—", cite: citeOf("icMemoArrUsedM"), label: REVENUE_LABEL },
      flags: riskFlags(verdict),
    },
    // Before close: every decision the review queue holds for a person.
    conditions: open.map((o) => ({ id: o.id, text: `${label(o.key)}: approve, reject or enter it in Review`, cite: citeOf(o.key) })),
    bridge: [],
    // Questions IC will ask: the values this build could not compute, with the API's reason.
    questions: unavailable.map(([k, f]) => `${label(k)}: ${(f as Extract<F, { status: "unavailable" }>).reason}`),
    sources,
    activity: [
      ...(at ? [{ id: "computed", label: `Computed ${ok} of ${total} fields`, at: fmtTime(at) }] : []),
      ...(open.length ? [{ id: "review", label: `${open.length} sent to Review`, at: at ? fmtTime(at) : "—" }] : []),
    ],
    exportNote: "Export this draft",
  };
}
