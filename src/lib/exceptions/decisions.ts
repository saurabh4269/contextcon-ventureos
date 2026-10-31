// Deal decisions ↔ review queue. GET /api/deals/:id/decisions routes the decisions a person has to settle to /review:
//   - an `unavailable` decision (fit score, screener verdict, valuation range, IC memo figures …) → missing_data
//   - an `ok` decision that rests on partial inputs (an input that is itself unavailable/empty) → low_confidence
// and reads resolved items back: a value a person entered (edit) fills the decision as ok, cited to that review item
// and labelled as theirs; a rejected low-confidence decision is withheld with the reason. Pure functions; the route
// owns the store. Nothing is invented — the only values that appear are Crustdata/builder ones or the person's own.
import { isOk, ok, unavailable, type ComputedField } from "@/lib/fields";
import { enforceCited } from "@/lib/provenance";
import type { DecisionKey, DecisionsResponse } from "@/lib/numbers/decisions";
import type { Derived } from "./rules";
import type { ExceptionStore } from "./store";
import type { ExceptionItem, RaiseInput } from "./types";

/** Decisions a person can settle in the review queue (the rest are computed figures that follow from these). */
export const REVIEWED_DECISIONS: readonly DecisionKey[] = ["fitScore", "screenerVerdict", "valuationRange", "diligenceVerdict", "icMemoArrUsedM", "icMemoValuation", "icMemoCompsLine"];
const LABEL: Record<string, string> = {
  fitScore: "Fit score", screenerVerdict: "Screener verdict", valuationRange: "Valuation range", diligenceVerdict: "Diligence verdict",
  icMemoArrUsedM: "IC memo · ARR used", icMemoValuation: "IC memo · valuation", icMemoCompsLine: "IC memo · comps line",
};

export const decisionRunId = (domain: string) => `deal:${domain.toLowerCase()}:decisions`;
export const decisionItemKey = (domain: string, key: string) => `${decisionRunId(domain)}:${key}`;
const keyOf = (item: ExceptionItem, domain: string) => {
  const p = `${decisionRunId(domain)}:`;
  return item.key.startsWith(p) ? item.key.slice(p.length) : null;
};

const isBlank = (v: unknown) => v == null || v === "" || (typeof v === "string" && /^unavailable/i.test(v)) || (typeof v === "object" && v !== null && (v as { status?: unknown }).status === "unavailable");
/** Inputs this ok decision was computed from that were themselves missing. Empty → full confidence. */
export function partialInputs(f: ComputedField<unknown>): string[] {
  return isOk(f) ? (f.inputs ?? []).filter((i) => isBlank(i.value)).map((i) => i.name) : [];
}

/** The review run + items for a decisions response. Keys already resolved (any outcome) are not raised again. */
export function fromDecisions(r: DecisionsResponse, resolvedKeys: ReadonlySet<string> = new Set()): Derived {
  const company = { name: r.companyDomain, domain: r.companyDomain, href: `/deal?domain=${encodeURIComponent(r.companyDomain)}` };
  const raise: RaiseInput[] = [];
  let auto = 0;
  for (const k of REVIEWED_DECISIONS) {
    const f = r.decisions[k];
    const key = decisionItemKey(r.companyDomain, k);
    if (isOk(f)) {
      const missing = partialInputs(f);
      if (!missing.length) { auto++; continue; }
      if (resolvedKeys.has(key)) continue;
      raise.push({
        key, kind: "low_confidence", subject: company,
        title: `${r.companyDomain}: ${LABEL[k]} rests on partial inputs`,
        reason: `Computed without ${missing.join(", ")}. Approve to keep it, reject to withhold it, or enter the value yourself (labelled as yours).`,
        evidence: [
          { label: LABEL[k]!, value: typeof f.value === "object" ? JSON.stringify(f.value) : (f.value as string | number | boolean), note: f.method },
          ...f.citations.slice(0, 5).map((c) => ({ label: "Source", value: c.source, citation: c })),
          ...missing.map((m) => ({ label: m, value: null, note: "input unavailable" })),
        ],
        proposed: { label: `${LABEL[k]}: ${typeof f.value === "object" ? JSON.stringify(f.value) : String(f.value)}`, value: f.value },
        actions: { approve: "Keep this value", reject: "Withhold it", edit: "Enter the value" },
        target: { cell: k },
      });
    } else if (f && !resolvedKeys.has(key)) {
      raise.push({
        key, kind: "missing_data", subject: company,
        title: `${r.companyDomain}: ${LABEL[k]} is unavailable`,
        reason: `${f.reason} Keep it marked unavailable, or enter it yourself (labelled as yours).`,
        evidence: [{ label: LABEL[k]!, value: null, note: f.reason }, { label: "Computed by", value: r.endpoints[k] ?? `/api/deals/${r.companyDomain}/decisions` }],
        actions: { approve: "Keep unavailable", reject: "Dismiss", edit: "Enter the value" },
        target: { cell: k },
      });
    }
  }
  return {
    run: { id: decisionRunId(r.companyDomain), source: "deal", request: `Decision fields for ${r.companyDomain}`, autoCompleted: auto, summary: `${auto} of ${REVIEWED_DECISIONS.length} decisions cited and complete; ${raise.length} need a person.` },
    raise,
  };
}

/** Apply resolved review items to the response: a person's edit fills the decision (cited to the review item); a rejected
 *  low-confidence decision is withheld. Then every field is re-checked (enforceCited). */
export function applyDecisionReviews(r: DecisionsResponse, items: readonly ExceptionItem[]): DecisionsResponse {
  const decisions = { ...r.decisions };
  const latest = new Map<string, ExceptionItem>();
  for (const it of items) {
    const k = keyOf(it, r.companyDomain);
    if (!k || !it.resolution || !(REVIEWED_DECISIONS as readonly string[]).includes(k)) continue;
    const prev = latest.get(k);
    if (!prev || prev.resolution!.at < it.resolution.at) latest.set(k, it);
  }
  for (const [k, it] of latest) {
    const res = it.resolution!;
    const dk = k as DecisionKey;
    if (res.action === "edit" && res.value) {
      decisions[dk] = ok(
        res.value,
        "Entered by you in the review queue",
        `${LABEL[dk]} was ${isOk(r.decisions[dk]) ? "replaced" : "unavailable"}; you entered ${res.value} on review. This is your value, not Crustdata's or the builder's.`,
        [{ source: "Deal Desk review queue (entered by you)", endpoint: `POST /api/exceptions/${it.id}`, path: "resolution.value", retrievedAt: res.at, url: `/review?item=${encodeURIComponent(it.id)}` }],
        [{ name: "entered by", value: res.by }, ...(res.note ? [{ name: "note", value: res.note }] : [])],
      );
    } else if (res.action === "reject" && it.kind === "low_confidence") {
      decisions[dk] = unavailable(`Withheld: you rejected this low-confidence ${LABEL[dk]} in the review queue${res.note ? ` (${res.note})` : ""}.`);
    }
  }
  const checked = enforceCited(decisions);
  return { ...r, decisions: checked, fields: { ...r.fields, ...checked } };
}

type StoreLike = Pick<ExceptionStore, "list" | "recordRun">;
/** Read resolved review items back into the response, then (unless `raise: false`) record the decision run with the
 *  items still needing a person. Idempotent: open items are deduped by key, resolved keys are never re-raised. */
export function withReview(r: DecisionsResponse, store: StoreLike, opts: { raise?: boolean } = {}): DecisionsResponse {
  const prefix = `${decisionRunId(r.companyDomain)}:`;
  const mine = store.list({ status: "all" }).items.filter((x) => x.key.startsWith(prefix));
  const applied = applyDecisionReviews(r, mine);
  const resolved = new Set(mine.filter((x) => x.status !== "open").map((x) => x.key));
  const d = fromDecisions(applied, resolved);
  const items = opts.raise === false ? mine.filter((x) => x.status === "open") : store.recordRun(d.run, d.raise).items;
  return {
    ...applied,
    review: {
      runId: d.run.id,
      href: "/review",
      open: items.filter((x) => x.status === "open").map((x) => ({ id: x.id, key: x.key.slice(prefix.length), kind: x.kind })),
      resolved: mine.filter((x) => x.status !== "open").map((x) => ({ id: x.id, key: x.key.slice(prefix.length), status: x.status })),
    },
  };
}
