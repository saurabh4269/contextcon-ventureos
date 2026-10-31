// Ready-made exception items for the cases any caller hits (the sourcing agent, the LLM screening loop, a route):
// an ambiguous or unknown company match, a value Crustdata does not have, two sources that disagree, a run over its
// credit budget, and every outbound send (dry run only). Each returns a RaiseInput for `raiseException` / `recordRun`;
// nothing here is invented — evidence is what the caller passes, with its citation when there is one.
import type { Citation } from "@/lib/fields";
import type { Resolution as CompanyResolution } from "@/lib/live/resolve";
import { EXCEPTION_KINDS, type Evidence, type RaiseInput } from "./types";

type Common = { runId?: string | null; target?: RaiseInput["target"] };
const subjectOf = (name: string, domain?: string) => ({ name, ...(domain ? { domain, href: `/deal?domain=${encodeURIComponent(domain)}` } : {}) });

/** A company reference that did not resolve to exactly one Crustdata record (resolveCompany → ambiguous / no_match). */
export function ambiguousMatch(r: Exclude<CompanyResolution, { status: "ok" }>, opts: Common = {}): RaiseInput {
  const top = r.suggestions[0];
  return {
    key: `${opts.runId ?? "adhoc"}:match:${r.input.toLowerCase()}`,
    kind: "ambiguous_match",
    title: r.status === "ambiguous" ? `"${r.input}" matches ${r.suggestions.length} companies` : `No exact company for "${r.input}"`,
    reason: `${r.message} A person picks one; the agent never guesses.`,
    subject: { name: r.input },
    evidence: r.suggestions.map((s) => ({
      label: s.name ?? `#${s.companyId}`,
      value: s.domain ?? null,
      note: `crustdata_company_id ${s.companyId}${s.confidence != null ? ` · confidence ${s.confidence}` : ""}`,
      ...(r.calls.identify.retrievedAt ? { citation: { source: "Crustdata", endpoint: "POST /company/identify", path: "[0].matches[]", retrievedAt: r.calls.identify.retrievedAt } } : {}),
    })),
    ...(top ? { proposed: { label: `${top.name ?? top.domain ?? top.companyId}${top.domain ? ` (${top.domain})` : ""}`, value: top } } : {}),
    actions: top ? { approve: "Accept top match", reject: "Exclude", edit: "Pick another (domain)" } : { approve: "Accept as unmatched", reject: "Exclude", edit: "Enter the domain" },
    runId: opts.runId ?? null,
    ...(opts.target ? { target: opts.target } : {}),
  };
}

/** A value the request needs that Crustdata does not have for this company (the field's own `unavailable` reason). */
export function missingData(company: { name: string; domain?: string }, field: string, reason: string, opts: Common = {}): RaiseInput {
  return {
    key: `${opts.runId ?? "adhoc"}:missing:${company.domain ?? company.name}:${field}`,
    kind: "missing_data",
    title: `${company.name}: ${field} is unavailable`,
    reason: `${reason} Keep it marked unavailable, enter it yourself (labelled as yours), or exclude the company.`,
    subject: subjectOf(company.name, company.domain),
    evidence: [{ label: field, value: null, note: reason }],
    runId: opts.runId ?? null,
    ...(opts.target ? { target: opts.target } : {}),
  };
}

/** Two sources disagree (e.g. the model's claim vs the cited Crustdata path, or search vs enrich). */
export function conflictingData(company: { name: string; domain?: string }, field: string, a: { label: string; value: string | number | null; citation?: Citation }, b: { label: string; value: string | number | null; citation?: Citation }, opts: Common = {}): RaiseInput {
  return {
    key: `${opts.runId ?? "adhoc"}:conflict:${company.domain ?? company.name}:${field}`,
    kind: "conflicting_data",
    title: `${company.name}: ${field} — ${a.label} and ${b.label} disagree`,
    reason: `${a.label} says ${a.value ?? "nothing"}, ${b.label} says ${b.value ?? "nothing"}. A person decides which stands.`,
    subject: subjectOf(company.name, company.domain),
    evidence: [a, b].map((x): Evidence => ({ label: x.label, value: x.value, ...(x.citation ? { citation: x.citation } : {}) })),
    proposed: { label: `${b.label}: ${b.value ?? "—"}`, value: b.value },
    runId: opts.runId ?? null,
    ...(opts.target ? { target: opts.target } : {}),
  };
}

/** A run that spent (or would spend) at least `limit` Crustdata credits. */
export function creditThreshold(runId: string, used: number, limit: number, detail?: string): RaiseInput {
  return {
    key: `${runId}:credits`,
    kind: "credit_threshold",
    title: `Run used ${used} Crustdata credits`,
    reason: `Spend is at or above the alert of ${limit} credits. Confirm the result is worth it.${detail ? ` ${detail}` : ""}`,
    evidence: [
      { label: "Credits used", value: used, note: "sum of X-Credits-Used; cache hits cost 0" },
      { label: "Alert at", value: limit },
    ],
    runId,
  };
}

/** Every outbound message (email, Slack, calendar invite) waits for a person; approving it runs the dry-run transport only. */
export function outboundSend(draft: { channel: "email" | "slack" | "calendar" | string; to: string; subject?: string; body: string }, opts: Common & { about?: { name: string; domain?: string } } = {}): RaiseInput {
  return {
    key: `${opts.runId ?? "adhoc"}:outbound:${draft.channel}:${draft.to}:${draft.subject ?? draft.body.slice(0, 40)}`,
    kind: "outbound_send",
    title: `Send ${draft.channel} to ${draft.to}`,
    reason: "Anything that contacts another person needs approval. Sends are dry runs in this build (event rules): nothing leaves the server.",
    ...(opts.about ? { subject: subjectOf(opts.about.name, opts.about.domain) } : {}),
    evidence: [
      { label: "To", value: draft.to },
      ...(draft.subject ? [{ label: "Subject", value: draft.subject }] : []),
      { label: "Body", value: draft.body.slice(0, 2000) },
    ],
    proposed: { label: `${draft.channel} to ${draft.to}`, value: draft },
    runId: opts.runId ?? null,
  };
}

/** Validates a RaiseInput from an untrusted body; returns a message for the 400 when it is not one. */
export function parseRaise(v: unknown): { ok: true; input: RaiseInput } | { ok: false; message: string } {
  const x = v as Partial<RaiseInput> | null;
  if (!x || typeof x !== "object") return { ok: false, message: "item must be an object" };
  if (typeof x.kind !== "string" || !EXCEPTION_KINDS.includes(x.kind)) return { ok: false, message: `kind must be one of ${EXCEPTION_KINDS.join(", ")}` };
  for (const k of ["key", "title", "reason"] as const) if (typeof x[k] !== "string" || !x[k]!.trim() || x[k]!.length > 2000) return { ok: false, message: `${k} must be a non-empty string (≤ 2000 chars)` };
  if (x.evidence !== undefined && !Array.isArray(x.evidence)) return { ok: false, message: "evidence must be an array" };
  return { ok: true, input: { ...x, evidence: (x.evidence ?? []).slice(0, 50) } as RaiseInput };
}
