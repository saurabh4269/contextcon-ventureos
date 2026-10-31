// Live Today (port TodaySummaryScreen) from real sources only:
//   · work rows  = deals actually worked on this server (GET /api/exceptions: item subjects + "deal:<domain>:…" runs),
//                  each with its fit score and verdict from GET /api/deals/:domain/decisions and its name/sector from
//                  GET /api/live/research. A deal without an ok fit score shows the fit as "—".
//                + companies from GET /api/pipeline/deals (inbox threads that name a domain, research recorded in memory):
//                  inbound ones only when the subject reads like a pitch; shown by domain (no subject text), fit "—".
//   · inbound    = Gmail inbox threads (metadata only) whose subject reads like a pitch; only the count per IST day is
//                  shown, never a sender or subject. When the window is not fully covered the count says "+".
//   · meetings   = Google Calendar primary, upcoming.
//   · hero / waiting = open review-queue items.
// Nothing here is a fixture; empty sources give the screen's own empty states.
import type { FitSignal, MeetingItem, TodaySummaryData, WaitingItem, WorkRow } from "@port/types";
import { isOk, type ComputedField } from "@/lib/fields";
import { fmtDate, fmtTime, fmtWeekdayDate, fmtWeekdayShort, istDay, istDayStart } from "@/lib/format";
import type { ExceptionsResponse } from "@/lib/exceptions/types";
import type { InboxThread } from "@/lib/google/gmail";
import type { Meeting } from "@/lib/google/calendar";
import type { DecisionsResponse } from "@/lib/numbers/decisions";
import type { ResearchResult } from "@/lib/live/types";
import type { PipelineDealRow } from "@/lib/inbox/pipeline";

type F = ComputedField<unknown>;
type ResearchOk = Extract<ResearchResult, { status: "ok" }>;
const DAY_MS = 86_400_000;

/* ── known deals ── */
export type KnownDeal = {
  domain: string;
  /** latest activity on this server (exception item or run), UTC ISO */
  lastAt: string;
  /** open review-queue items for this deal */
  open: number;
  research?: ResearchOk | null;
  decisions?: DecisionsResponse | null;
};

const DEAL_RUN = /^deal:([^:]+):/;

/** Domains of deals worked on this server, newest activity first (item subjects and deal runs). */
export function knownDeals(ex: Pick<ExceptionsResponse, "items" | "runs">, max = 12): KnownDeal[] {
  const by = new Map<string, KnownDeal>();
  const touch = (domain: string | undefined, at: string, open: boolean) => {
    const d = domain?.trim().toLowerCase();
    if (!d) return;
    const k = by.get(d) ?? { domain: d, lastAt: at, open: 0 };
    if (Date.parse(at) > Date.parse(k.lastAt)) k.lastAt = at;
    if (open) k.open++;
    by.set(d, k);
  };
  for (const x of ex.items) touch(x.subject?.domain, x.resolution?.at ?? x.createdAt, x.status === "open");
  for (const r of ex.runs) touch(DEAL_RUN.exec(r.id)?.[1], r.finishedAt ?? r.createdAt, false);
  return [...by.values()].sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt)).slice(0, max);
}

/* ── work rows ── */
const verdictOf = (f: F | undefined) => (isOk(f) ? String(f.value) : null);
const CRITERIA: [string, string][] = [["criterionSector", "sector"], ["criterionStage", "stage"], ["criterionGeo", "geography"], ["criterionCheckSize", "check size"], ["criterionMemory", "firm memory"]];

/** Met / not met mandate criteria behind the fit score (the fit pill tooltip). */
export function fitSignals(fields: Partial<Record<string, F>>): FitSignal[] {
  return CRITERIA.flatMap(([k, label]) => {
    const f = fields[k];
    if (!isOk(f) || (f.value !== "met" && f.value !== "not met")) return [];
    return [{ label: `${label} ${String(f.value)}`, effect: f.value === "met" ? ("up" as const) : ("down" as const) }];
  });
}

/** The decision a row offers, from the screener verdict; open review items come first. */
function rowAction(screener: string | null, open: number): WorkRow["action"] {
  if (open) return { kind: "review", label: "Review", recommended: true };
  if (screener === "Decline") return { kind: "pass", label: "Pass" };
  if (screener === "Advance") return { kind: "memo", label: "Open memo", recommended: true };
  return { kind: "review", label: "Review" };
}

const whenLabel = (iso: string, now: Date) => (istDay(iso) === istDay(now.toISOString()) ? fmtTime(iso) : fmtDate(iso));

/** Fit score from decisions, or NaN (the fit pill reads "—") when there is no ok score. */
const fitOf = (d: DecisionsResponse | null | undefined): { score: number; reasoning: string } | null => {
  const f = d?.fields.fitScore;
  return isOk(f) && Number.isFinite(Number(f.value)) ? { score: Math.round(Number(f.value)), reasoning: f.reasoning } : null;
};

export function toWorkRow(k: KnownDeal, now: Date = new Date()): WorkRow {
  const fit = fitOf(k.decisions);
  const c = k.research?.company;
  const name = c?.name ?? k.domain;
  const sector = c?.categories[0] ?? c?.industries[0] ?? "—";
  const screener = verdictOf(k.decisions?.fields.screenerVerdict);
  const action = rowAction(screener, k.open);
  const reason = fit?.reasoning ?? (k.decisions ? "No fit score: the mandate criteria could not be checked" : "Decisions unavailable for this deal");
  const why = screener ? `${screener} · ${reason}` : reason;
  return {
    id: k.domain,
    company: { id: k.domain, name, initial: name[0]!.toUpperCase(), sector, ...(c?.logoUrl ? { logoUrl: c.logoUrl } : {}) },
    // No pipeline stage is recorded anywhere in this build: every known deal is shown as New.
    stage: "new",
    fit: { score: fit?.score ?? NaN, why, signals: k.decisions ? fitSignals(k.decisions.fields as unknown as Record<string, F>) : [] },
    action,
    href: action.kind === "review" && k.open ? "/review" : action.kind === "memo" ? `/memo?id=${encodeURIComponent(k.domain)}` : `/deal?domain=${encodeURIComponent(k.domain)}`,
    when: whenLabel(k.lastAt, now),
  };
}

/** Pipeline companies fit to show: researched/opened ones, and inbound ones whose subject-derived name reads like a pitch. */
export const realPipelineDeals = (deals: PipelineDealRow[]): PipelineDealRow[] => deals.filter((d) => d.source !== "inbound" || PITCH_LIKE.test(d.name));

/** A pipeline company with no decisions run here: shown by its domain, fit "—", opening the live deal page. */
export function pipelineWorkRow(d: PipelineDealRow, now: Date = new Date()): WorkRow {
  return {
    id: d.domain,
    company: { id: d.domain, name: d.domain, initial: d.domain[0]!.toUpperCase(), sector: "—", domain: d.domain },
    stage: "new",
    fit: { score: NaN, why: d.source === "inbound" ? "Pitch-like email in your inbox names this domain" : "Researched on Deal Desk; no decisions run yet" },
    action: { kind: "claim", label: "Open deal", recommended: true },
    href: d.href,
    when: whenLabel(d.at, now),
  };
}

/* ── inbound (Gmail, pitch-like threads, counts only) ── */
/** Subject wording that reads like a founder pitch or a fundraise. Anything else is never counted or shown. */
export const PITCH_LIKE = /\b(pitch|deck|fund ?rais\w*|raising|pre-?seed|seed round|series [a-c]\b|investment opportunity|investor update|term sheet|intro to .* founder)/i;

export type InboundWindow = { days: string[]; series: number[]; total: number; complete: boolean; prior: number | null };

/**
 * Pitch-like threads per IST day over the last `span` days (today included). `fetchedSince` is the `since` the threads
 * were fetched with; `truncated` = the route returned its max, so older threads may be missing.
 */
export function inboundWindow(threads: InboxThread[], now: Date, opts: { span: number; fetchedSince: string; truncated: boolean }): InboundWindow {
  const pitch = threads.filter((t) => PITCH_LIKE.test(t.subject));
  const keys = Array.from({ length: opts.span }, (_, i) => new Date(now.getTime() - (opts.span - 1 - i) * DAY_MS).toISOString());
  const dayKeys = keys.map(istDay);
  const series = dayKeys.map((d) => pitch.filter((t) => istDay(t.lastMessageAt) === d).length);
  const start = istDayStart(dayKeys[0]!);
  const oldest = threads.length ? Math.min(...threads.map((t) => Date.parse(t.lastMessageAt))) : Infinity;
  const complete = !opts.truncated || oldest < start;
  const priorStart = start - opts.span * DAY_MS;
  const priorCovered = Date.parse(opts.fetchedSince) <= priorStart && (!opts.truncated || oldest < priorStart);
  const prior = priorCovered ? pitch.filter((t) => { const at = Date.parse(t.lastMessageAt); return at >= priorStart && at < start; }).length : null;
  return { days: keys.map(fmtWeekdayShort), series, total: series.reduce((a, b) => a + b, 0), complete, prior };
}

export function inboundMetric(w: InboundWindow | { unavailable: string }, span: number): TodaySummaryData["metric"] {
  const label = "Pitch-like inbound";
  if ("unavailable" in w) return { label, sub: w.unavailable, value: "—", unit: "threads", delta: "unavailable", up: false, days: [], series: [], href: "/settings" };
  const delta = w.prior == null ? "no prior window" : w.prior === 0 ? (w.total ? "none the window before" : "same as the window before") : `${w.total >= w.prior ? "+" : "−"}${Math.abs(Math.round((100 * (w.total - w.prior)) / w.prior))}% vs the window before`;
  return {
    label,
    sub: `Gmail threads that read like a pitch, last ${span} days`,
    value: `${w.total}${w.complete ? "" : "+"}`,
    unit: "threads",
    delta,
    up: w.prior == null || w.total >= w.prior,
    days: w.days,
    series: w.series,
  };
}

/* ── meetings (Google Calendar) ── */
const minutes = (m: Meeting) => (m.end && !m.allDay ? Math.round((Date.parse(m.end) - Date.parse(m.start)) / 60_000) : null);
const initialsOf = (s: string) => s.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "—";

/** The card labels every meeting with a kind; a calendar event says none, so only titles that name one are shown
 *  (this also keeps personal events off the page). */
export function meetingKind(title: string): MeetingItem["kind"] | null {
  if (/\b(IC|investment committee)\b/i.test(title)) return "ic";
  if (/\bboard\b/i.test(title)) return "board";
  if (/\b(LP|LPs|limited partners?)\b/.test(title)) return "lp";
  if (/\b(pitch|founders?|intro call|diligence)\b/i.test(title)) return "founder";
  return null;
}

export function toMeetingItem(m: Meeting, now: Date = new Date()): MeetingItem | null {
  const kind = meetingKind(m.summary);
  if (!kind) return null;
  const mins = minutes(m);
  const today = istDay(m.start) === istDay(now.toISOString());
  return {
    id: m.id,
    kind,
    title: m.summary,
    day: today ? "Today" : fmtDate(m.start),
    time: m.allDay ? "All day" : fmtTime(m.start).replace(/ IST$/, ""),
    duration: mins != null ? `${mins} min` : "",
    people: [{ name: m.summary, email: "", role: "", initials: initialsOf(m.summary) }],
    agenda: [],
    meetLink: m.link ?? "",
  };
}

/* ── the screen ── */
export type TodayInputs = {
  now: Date;
  /** "Good morning" etc. from the viewer's own clock, and their first name */
  greeting: string;
  deals: KnownDeal[];
  /** GET /api/pipeline/deals rows (already filtered by realPipelineDeals) */
  pipeline?: PipelineDealRow[];
  open: number;
  inbound: InboundWindow | { unavailable: string };
  inboundSpan: number;
  meetings: Meeting[];
  ask: TodaySummaryData["ask"];
};

const WAITING: WaitingItem[] = [
  { id: "wt_review", label: "Decisions to review", kind: "review", href: "/review" },
  { id: "wt_memo", label: "Memos to open", kind: "memo" },
  { id: "wt_pass", label: "Screened out", kind: "pass" },
];

export function toTodaySummary(x: TodayInputs): TodaySummaryData {
  const known = new Set(x.deals.map((k) => k.domain));
  const rows = [...x.deals.map((k) => toWorkRow(k, x.now)), ...(x.pipeline ?? []).filter((d) => !known.has(d.domain)).map((d) => pipelineWorkRow(d, x.now))];
  const unscored = x.deals.filter((k) => !fitOf(k.decisions)).length;
  const parts = [
    x.open ? `${x.open} decision${x.open === 1 ? "" : "s"} wait for you in Review.` : "Nothing waits for you in Review.",
    unscored ? `${unscored} researched deal${unscored === 1 ? " has" : "s have"} no fit score yet.` : "",
  ].filter(Boolean);
  return {
    date: fmtWeekdayDate(x.now.toISOString()),
    greeting: x.greeting,
    sub: parts.join(" "),
    hero: { value: x.open, label: "waiting in Review" },
    ask: x.ask,
    metric: inboundMetric(x.inbound, x.inboundSpan),
    waiting: { label: "Waiting on you", items: WAITING.filter((w) => rows.some((r) => r.action.kind === w.kind)) },
    rows,
    meetings: x.meetings.map((m) => toMeetingItem(m, x.now)).filter((m): m is MeetingItem => !!m),
  };
}

/** Same bands as src/lib/voice/greeting.ts `salutation` (that module is server-side), from the viewer's own clock. */
export const salutation = (hour: number) => (hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 17 ? "Good afternoon" : hour >= 17 && hour < 22 ? "Good evening" : "Working late");
