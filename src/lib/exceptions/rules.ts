// Which parts of a finished agent run need a person, and which auto-complete. Pure functions: a run's output in, the
// normalized artefact + the exception items out. Two producers today:
//   - the LLM screening agent (POST /api/live/screen → ScreenResult, feature/nl-screener: src/lib/agent/contract.ts)
//   - the deterministic sourcing agent (POST /api/agent/run → AgentRow[] + RunSummary, src/lib/agent/run.ts)
// `ScreenResultLike` mirrors only the ScreenResult fields used here, so this module does not depend on that branch;
// the real ScreenResult is structurally assignable to it.
import type { AgentRow, Dropped, RunSummary } from "@/lib/agent/run";
import type { Citation, ComputedField } from "@/lib/fields";
import { fmtMoney } from "@/lib/format";
import type { Artefact, ArtefactCell, ArtefactFounder, ArtefactRow, Evidence, RaiseInput, RunRecord } from "./types";

/** Policy: raise a credit item when a run spends at least this share of its cap (screen agent) … */
export const CREDIT_SHARE_ALERT = 0.8;
/** … or, for runs without a cap (sourcing agent), at least this many credits. Override with RUN_CREDIT_ALERT. */
export function creditAlertLimit(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.RUN_CREDIT_ALERT);
  return Number.isFinite(n) && n > 0 ? n : 40;
}

export type Derived = {
  run: { id: string; source: RunRecord["source"]; request: string; autoCompleted: number; summary?: string; credits?: RunRecord["credits"]; model?: string; artefact?: Artefact };
  raise: RaiseInput[];
};

/* ───────────── LLM screening agent (ScreenResult) ───────────── */

type ScreenCitation = { ref: string; method: string; endpoint: string; path: string; retrievedAt: string | null };
type ScreenCellLike = { key: string; label: string; value: string | number | boolean | null; status: "verified" | "corrected" | "unavailable"; citation?: ScreenCitation; claimed?: unknown; reason?: string };
export type ScreenResultLike = {
  status: "ok" | "incomplete";
  query: string;
  summary: string;
  columns: { key: string; label: string }[];
  rows: {
    rank: number;
    name: ScreenCellLike;
    cells: ScreenCellLike[];
    people: { name: ScreenCellLike; title: ScreenCellLike; prior: { company: ScreenCellLike; title: ScreenCellLike; period?: string }[] }[];
    peopleNote?: string;
    why?: string;
  }[];
  filters: { requirement: string; applied: "server" | "client" | "unavailable"; field?: string; detail: string; relaxed?: string }[];
  caveats: string[];
  requested?: number;
  model: { provider: string; model: string };
  calls: { ref: string; tool: string; path: string; status: "ok" | "error" | "refused"; error?: string; creditsUsed: number | null }[];
  credits: { used: number; cap: number };
  steps: number;
};

const screenCite = (c?: ScreenCitation): Citation | undefined =>
  c ? { source: "Crustdata", endpoint: `${c.method} ${c.endpoint}`, path: c.path, ref: c.ref, ...(c.retrievedAt ? { retrievedAt: c.retrievedAt } : {}) } : undefined;

const screenCell = (c: ScreenCellLike): ArtefactCell => ({
  key: c.key,
  label: c.label,
  value: c.status === "unavailable" ? null : c.value,
  status: c.status,
  ...(screenCite(c.citation) ? { citation: screenCite(c.citation) } : {}),
  ...(c.reason ? { reason: c.reason } : {}),
});

const cellText = (v: unknown) => (v === null || v === undefined ? null : typeof v === "object" ? JSON.stringify(v) : (v as string | number | boolean));

export function fromScreenResult(r: ScreenResultLike, runId: string): Derived {
  const raise: RaiseInput[] = [];
  const domainOf = (row: ScreenResultLike["rows"][number]) => {
    const d = row.cells.find((c) => /^(domain|website|primary_domain)$/i.test(c.key) && c.status !== "unavailable");
    return d ? String(d.value).replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase() : undefined;
  };

  const rows: ArtefactRow[] = r.rows.map((row) => ({
    rank: row.rank,
    name: String(row.name.value ?? row.name.claimed ?? "unnamed"),
    domain: domainOf(row),
    cells: row.cells.map(screenCell),
    founders: row.people.map(
      (p): ArtefactFounder => ({
        name: String(p.name.value ?? p.name.claimed ?? "unnamed"),
        ...(p.title.value !== null && p.title.status !== "unavailable" ? { title: String(p.title.value) } : {}),
        prior: p.prior.filter((x) => x.company.status !== "unavailable" && x.company.value !== null).map((x) => `${x.company.value}${x.title.status !== "unavailable" && x.title.value ? ` (${x.title.value})` : ""}${x.period ? ` ${x.period}` : ""}`),
        ...(screenCite(p.name.citation) ? { citation: screenCite(p.name.citation) } : {}),
      }),
    ),
    ...(row.peopleNote ? { foundersNote: row.peopleNote } : {}),
    ...(row.why ? { why: row.why } : {}),
    notes: [],
  }));

  let clean = 0;
  r.rows.forEach((row, i) => {
    const name = rows[i].name;
    const subject = { name, ...(rows[i].domain ? { domain: rows[i].domain, href: `/deal?domain=${encodeURIComponent(rows[i].domain!)}` } : {}) };
    let flagged = false;

    if (row.name.status !== "verified") {
      flagged = true;
      raise.push({
        key: `${runId}:r${i}:match`,
        runId,
        kind: "ambiguous_match",
        title: `Which company is “${cellText(row.name.claimed) ?? name}”?`,
        reason: row.name.status === "corrected" ? "The model named this company differently from the Crustdata record it cited." : row.name.reason ?? "The company name has no resolvable Crustdata citation.",
        subject,
        evidence: [
          { label: "Model said", value: cellText(row.name.claimed) },
          { label: "Crustdata record", value: row.name.status === "unavailable" ? null : cellText(row.name.value), ...(screenCite(row.name.citation) ? { citation: screenCite(row.name.citation) } : {}) },
        ],
        ...(row.name.status === "corrected" ? { proposed: { label: "Crustdata name", value: row.name.value } } : {}),
        target: { row: i, cell: "name" },
      });
    }

    for (const c of row.cells.filter((c) => c.status === "corrected")) {
      flagged = true;
      raise.push({
        key: `${runId}:r${i}:conflict:${c.key}`,
        runId,
        kind: "conflicting_data",
        title: `${c.label} for ${name}: sources disagree`,
        reason: "The model's value does not match the Crustdata field it cited. The Crustdata value is shown; confirm it or enter the right one.",
        subject,
        evidence: [
          { label: "Model said", value: cellText(c.claimed) },
          { label: "Crustdata", value: cellText(c.value), ...(screenCite(c.citation) ? { citation: screenCite(c.citation) } : {}) },
        ],
        proposed: { label: "Crustdata value", value: c.value },
        target: { row: i, cell: c.key },
      });
    }

    const missing = row.cells.filter((c) => c.status === "unavailable");
    const noFounders = row.people.length === 0;
    if (missing.length || noFounders) {
      flagged = true;
      const evidence: Evidence[] = missing.map((c) => ({ label: c.label, value: null, note: c.reason ?? "not reported" }));
      if (noFounders) evidence.push({ label: "Founders", value: null, note: row.peopleNote ?? "no founders found on Crustdata" });
      const one = missing.length === 1 && !noFounders ? missing[0] : undefined;
      raise.push({
        key: `${runId}:r${i}:missing`,
        runId,
        kind: "missing_data",
        title: `${name}: ${[...missing.map((c) => c.label), ...(noFounders ? ["founders"] : [])].join(", ")} not on Crustdata`,
        reason: "Requested data is unavailable for this company. Keep it marked unavailable, exclude the company, or enter a value you have verified elsewhere (shown as entered by a person).",
        subject,
        evidence,
        ...(one ? {} : { actions: { approve: "Keep, marked unavailable", reject: "Exclude row" } }),
        target: { row: i, ...(one ? { cell: one.key } : {}) },
      });
    }
    if (!flagged) clean++;
  });

  // Run-level items
  const refused = r.calls.filter((c) => c.status === "refused");
  if (refused.length || (r.credits.cap > 0 && r.credits.used >= r.credits.cap * CREDIT_SHARE_ALERT)) {
    raise.push({
      key: `${runId}:credits`,
      runId,
      kind: "credit_threshold",
      title: refused.length ? `Credit cap reached: ${refused.length} Crustdata call${refused.length === 1 ? "" : "s"} not made` : `Run used ${r.credits.used} of ${r.credits.cap} Crustdata credits`,
      reason: refused.length ? "The run stopped calling Crustdata at its credit cap, so the result may be partial." : `Spend reached ${Math.round(CREDIT_SHARE_ALERT * 100)}% of the per-run cap (policy).`,
      evidence: [
        { label: "Credits used", value: r.credits.used, note: "sum of X-Credits-Used across calls" },
        { label: "Cap", value: r.credits.cap },
        ...refused.map((c) => ({ label: `Refused ${c.ref}`, value: `${c.tool} ${c.path}`, ...(c.error ? { note: c.error } : {}) })),
      ],
    });
  }
  if (r.status === "incomplete") {
    raise.push({
      key: `${runId}:incomplete`,
      runId,
      kind: "incomplete_run",
      title: "The agent stopped before a final answer",
      reason: "The step or credit cap was reached, or the model stopped without submitting. What was verified so far is kept.",
      evidence: [
        { label: "Model turns", value: r.steps },
        { label: "Rows verified", value: r.rows.length },
      ],
    });
  }
  const caveats: Evidence[] = [
    ...r.filters.filter((f) => f.applied === "unavailable").map((f) => ({ label: f.requirement, value: "not applied", note: f.detail })),
    ...r.filters.filter((f) => f.relaxed).map((f) => ({ label: f.requirement, value: "relaxed", note: f.relaxed })),
    ...(r.requested && r.rows.length < r.requested ? [{ label: "Results", value: `${r.rows.length} of ${r.requested} requested`, note: "fewer matches than asked" }] : []),
  ];
  if (caveats.length) {
    raise.push({
      key: `${runId}:caveats`,
      runId,
      kind: "low_confidence",
      title: "The shortlist does not match the request as written",
      reason: "Some requirements could not be applied on Crustdata or were relaxed to find enough matches. Keep the shortlist with these caveats, or discard it.",
      evidence: caveats,
      actions: { approve: "Keep with caveats", reject: "Discard shortlist" },
    });
  }

  return {
    run: {
      id: runId,
      source: "screen-agent",
      request: r.query,
      autoCompleted: clean,
      summary: r.summary,
      credits: { used: r.credits.used, cap: r.credits.cap },
      model: `${r.model.provider} · ${r.model.model}`,
      artefact: { kind: "shortlist", columns: r.columns, rows },
    },
    raise,
  };
}

/* ───────────── deterministic sourcing agent (AgentRow + RunSummary) ───────────── */

const SOURCING_COLUMNS = [
  { key: "founded", label: "Founded" },
  { key: "hq", label: "HQ" },
  { key: "headcount", label: "Headcount" },
  { key: "growth", label: "Growth" },
  { key: "funding", label: "Funding" },
];

function fieldCell<T>(key: string, label: string, f: ComputedField<T>, render: (v: T) => string | number | null): ArtefactCell {
  if (f.status !== "ok") return { key, label, value: null, status: "unavailable", reason: f.reason };
  const v = render(f.value);
  if (v === null) return { key, label, value: null, status: "unavailable", reason: "not reported" };
  return { key, label, value: v, status: "verified", ...(f.citations[0] ? { citation: f.citations[0] } : {}) };
}

export function sourcingArtefactRow(row: AgentRow): ArtefactRow {
  const founders: ArtefactFounder[] =
    row.founders.status === "ok"
      ? row.founders.value.map((f) => ({
          name: f.name,
          ...(f.title ? { title: f.title } : {}),
          prior: f.prior.map((p) => `${p.company}${p.title ? ` (${p.title})` : ""}`),
          ...(f.citations[0] ? { citation: f.citations[0] } : {}),
        }))
      : [];
  return {
    rank: row.rank,
    name: row.name,
    ...(row.domain ? { domain: row.domain } : {}),
    cells: [
      fieldCell("founded", "Founded", row.founded, (v) => v),
      fieldCell("hq", "HQ", row.hq, (v) => v),
      fieldCell("headcount", "Headcount", row.headcountNow, (v) => v),
      fieldCell("growth", `Growth (${row.growthWindow})`, row.growth, (v) => `${v > 0 ? "+" : ""}${v}%`),
      fieldCell("funding", "Funding", row.funding, (v) => (v.total ? fmtMoney(v.total, { compact: true }) : null)),
    ],
    founders,
    ...(row.founders.status === "unavailable" ? { foundersNote: row.founders.reason } : row.founders.status === "pending" ? { foundersNote: "Founder lookup did not finish." } : {}),
    notes: [],
  };
}

export function fromSourcingRun(summary: RunSummary, agentRows: AgentRow[], dropped: Dropped[] = [], opts: { creditLimit?: number } = {}): Derived {
  const runId = summary.runId;
  const byId = new Map(agentRows.map((r) => [r.id, r]));
  const ordered = summary.rowOrder.map((id) => byId.get(id)).filter((r): r is AgentRow => !!r);
  const rows = ordered.map(sourcingArtefactRow);
  const raise: RaiseInput[] = [];
  let clean = 0;

  ordered.forEach((row, i) => {
    const subject = { name: row.name, ...(row.domain ? { domain: row.domain, href: `/deal?domain=${encodeURIComponent(row.domain)}` } : {}) };
    const cite = row.sourceCitation;
    let flagged = false;

    const failed = row.checks.filter((c) => c.ok === false);
    if (failed.length) {
      flagged = true;
      raise.push({
        key: `${runId}:r${i}:conflict`,
        runId,
        kind: "conflicting_data",
        title: `${row.name}: search and enrich disagree`,
        reason: "Company search matched this company, but its enriched record does not meet the request. Keep it (search wins) or exclude it.",
        subject,
        evidence: failed.map((c) => ({ label: c.label, value: c.detail, citation: cite })),
        actions: { approve: "Keep it", reject: "Exclude" },
        target: { row: i },
      });
    }

    if (row.relaxed.length) {
      flagged = true;
      raise.push({
        key: `${runId}:r${i}:relaxed`,
        runId,
        kind: "low_confidence",
        title: `${row.name} matched only after relaxing the request`,
        reason: "It did not match every constraint as written. Keep it on the shortlist or exclude it.",
        subject,
        evidence: row.relaxed.map((r) => ({ label: "Relaxed", value: r, citation: cite })),
        actions: { approve: "Keep it", reject: "Exclude" },
        target: { row: i },
      });
    }

    const unverified = row.checks.filter((c) => c.ok === null);
    const foundersMissing = row.founders.status !== "ok" || row.founders.value.length === 0;
    if (unverified.length || foundersMissing || row.errors.length) {
      flagged = true;
      const evidence: Evidence[] = [
        ...unverified.map((c) => ({ label: c.label, value: null, note: c.detail })),
        ...(foundersMissing ? [{ label: "Founders", value: null, note: row.founders.status === "unavailable" ? row.founders.reason : row.founders.status === "pending" ? "lookup did not finish" : "no founders found on Crustdata" }] : []),
        ...row.errors.map((e) => ({ label: "Error", value: e })),
      ];
      raise.push({
        key: `${runId}:r${i}:missing`,
        runId,
        kind: "missing_data",
        title: `${row.name}: ${[...unverified.map((c) => c.label.toLowerCase()), ...(foundersMissing ? ["founders"] : []), ...(row.errors.length ? ["partial failure"] : [])].join(", ")} could not be verified`,
        reason: "Part of what the request needs is unavailable on Crustdata for this company. Keep it marked unavailable, or exclude it.",
        subject,
        evidence,
        actions: { approve: "Keep, marked unavailable", reject: "Exclude" },
        target: { row: i },
      });
    }
    if (!flagged) clean++;
  });

  const limit = opts.creditLimit ?? creditAlertLimit();
  if (summary.credits >= limit) {
    raise.push({
      key: `${runId}:credits`,
      runId,
      kind: "credit_threshold",
      title: `Run used ${summary.credits} Crustdata credits`,
      reason: `Spend is at or above the per-run alert of ${limit} credits (policy: RUN_CREDIT_ALERT). Confirm the result is worth it.`,
      evidence: [
        { label: "Credits used", value: summary.credits, note: "sum of X-Credits-Used; cache hits cost 0" },
        { label: "Live calls", value: summary.liveCalls },
        { label: "Cached calls", value: summary.cachedCalls },
      ],
    });
  }
  const caveats: Evidence[] = [
    ...(summary.returned < summary.requested ? [{ label: "Results", value: `${summary.returned} of ${summary.requested} requested`, note: "fewer matches than asked" }] : []),
    ...(summary.failedCalls > 0 ? [{ label: "Failed Crustdata calls", value: summary.failedCalls }] : []),
  ];
  if (caveats.length) {
    raise.push({
      key: `${runId}:caveats`,
      runId,
      kind: "low_confidence",
      title: "The shortlist is incomplete",
      reason: "The run returned fewer companies than asked or some Crustdata calls failed. Keep the shortlist as is, or discard it.",
      evidence: caveats,
      actions: { approve: "Keep with caveats", reject: "Discard shortlist" },
    });
  }

  return {
    run: {
      id: runId,
      source: "sourcing-agent",
      request: summary.request,
      autoCompleted: clean,
      summary: `${summary.sentence} ${summary.rankingReason}`.trim() + (dropped.length ? ` ${dropped.length} candidate${dropped.length === 1 ? "" : "s"} dropped automatically with a reason.` : ""),
      credits: { used: summary.credits },
      model: "Deterministic request parser (no LLM)",
      artefact: { kind: "shortlist", columns: SOURCING_COLUMNS, rows },
    },
    raise,
  };
}
