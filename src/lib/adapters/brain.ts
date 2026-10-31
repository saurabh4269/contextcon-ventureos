// Live Firm brain (port BrainScreen) from real sources only:
//   · GET /api/memory/events → memories (one per event), categories, growth by month, outcomes (workflow.decision:
//     invested / passed, with "no outcome yet": nothing tracks what happened after), pass reasons (the partner's note on
//     a Pass, else "no reason recorded"), memos written (memo.drafted);
//   · GET /api/settings/mandate → the thesis lines and priors (what every memo and score is checked against).
// Not in this build, so empty: anti-portfolio, thesis proposals, agent reads, access log. No events → empty state.
import type { BrainData, Memory, Outcome, ThesisLine } from "@port/types";
import { fmtDate, fmtDateTime, fmtMoney, fmtMonth, istDay, money } from "@/lib/format";
import type { MemoryEvent } from "@/lib/memory/types";
import type { Mandate } from "@/lib/settings/mandate";
import type { StorageInfo } from "@/lib/store/docs";

const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;

/** Memory categories, by event kind. "pass" and "anti" are the ids the screen's cards open. */
const KIND: { id: string; label: string; match: (e: MemoryEvent) => boolean }[] = [
  { id: "decisions", label: "IC decisions", match: (e) => e.kind === "workflow.decision" },
  { id: "pass", label: "Pass reasons", match: (e) => e.kind === "workflow.decision" && verdictOf(e) === "pass" },
  { id: "anti", label: "Anti-portfolio", match: () => false },
  { id: "memos", label: "IC memos", match: (e) => e.kind === "memo.drafted" },
  { id: "research", label: "Research", match: (e) => /^(research|deal|signal|agent)\./.test(e.kind) },
];
const verdictOf = (e: MemoryEvent) => (e.data as { verdict?: unknown } | null)?.verdict;
const noteOf = (e: MemoryEvent) => {
  const n = (e.data as { note?: unknown } | null)?.note;
  return typeof n === "string" && n.trim() ? n.trim() : null;
};
const kindOf = (e: MemoryEvent) => KIND.find((k) => k.id !== "pass" && k.match(e)) ?? null;
/** Month of an instant in IST (the app shows IST; the server clock is UTC). */
const monthKey = (iso: string) => istDay(iso).slice(0, 7);

/** Cumulative memories per month, from the month before the first event (0) to `now`'s month. */
export function growth(events: MemoryEvent[], now: Date): { trend: number[]; labels: string[] } {
  if (!events.length) return { trend: [], labels: [] };
  const first = new Date(`${monthKey(events[0]!.at)}-01T00:00:00Z`);
  const months: string[] = [];
  const last = monthKey(now.toISOString());
  for (let d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 1, 1)); d.toISOString().slice(0, 7) <= last; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) months.push(d.toISOString().slice(0, 7));
  const trend = months.map((m) => events.filter((e) => monthKey(e.at) <= m).length);
  return { trend, labels: months.map((m) => fmtMonth(`${m}-01`)) };
}

const short = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function thesisLines(m: Mandate | null): ThesisLine[] {
  if (!m) return [];
  const check = m.checkSizeUsd.min != null || m.checkSizeUsd.max != null
    ? [m.checkSizeUsd.min != null ? fmtMoney(money(m.checkSizeUsd.min, "USD")) : "—", m.checkSizeUsd.max != null ? fmtMoney(money(m.checkSizeUsd.max, "USD")) : "—"].join(" – ")
    : null;
  return [
    m.sectors.length ? { id: "sectors", field: "Sectors", text: m.sectors.join(", ") } : null,
    m.stages.length ? { id: "stages", field: "Stages", text: m.stages.join(", ") } : null,
    m.geos.length ? { id: "geos", field: "Geographies", text: m.geos.join(", ") } : null,
    check ? { id: "check", field: "Check size", text: check } : null,
  ].filter((x): x is ThesisLine => !!x);
}

export function priorsFrom(m: Mandate | null, basis: string): BrainData["priors"] {
  if (!m) return [];
  const p = m.priors;
  return [
    p.dilutionPct ? { label: "Dilution per round", value: `${p.dilutionPct.low}–${p.dilutionPct.high}%`, basis } : null,
    p.returnMultiple ? { label: "Target return multiple", value: `${p.returnMultiple.low}–${p.returnMultiple.high}×`, basis } : null,
  ].filter((x): x is BrainData["priors"][number] => !!x);
}

export type BrainInputs = { events: MemoryEvent[]; storage: StorageInfo | null; mandate: Mandate | null; mandateNote?: string; now: Date };

export function toLiveBrain(x: BrainInputs): BrainData {
  const events = [...x.events].sort((a, b) => Number(a.id) - Number(b.id));
  const newest = [...events].reverse();
  const storageLabel = x.storage?.label ?? "Memory store";
  const decisions = events.filter((e) => e.kind === "workflow.decision");
  const passes = decisions.filter((e) => verdictOf(e) === "pass");
  const reasons = new Map<string, number>();
  for (const e of passes) reasons.set(short(noteOf(e) ?? "No reason recorded", 40), (reasons.get(short(noteOf(e) ?? "No reason recorded", 40)) ?? 0) + 1);
  const memories: Memory[] = newest.map((e) => {
    const k = kindOf(e);
    return { id: e.id, text: e.summary, kind: k?.label ?? e.kind, usage: "—", source: { kind: "db", label: storageLabel }, ...(k ? { kindId: verdictOf(e) === "pass" ? "pass" : k.id } : {}), at: fmtDateTime(e.at) };
  });
  const outcomes: Outcome[] = [...decisions].reverse().map((e) => ({
    id: e.id,
    date: fmtDate(e.at),
    company: e.subject?.label ?? e.subject?.id ?? "—",
    co: { id: e.subject?.id ?? e.id, name: e.subject?.label ?? e.subject?.id ?? "—", initial: (e.subject?.label ?? e.subject?.id ?? "—")[0]!.toUpperCase() },
    decision: verdictOf(e) === "pass" ? "passed" : "invested",
    result: "no outcome tracked yet",
    tone: "neutral",
  }));
  const { trend, labels } = growth(events, x.now);
  const week = events.filter((e) => x.now.getTime() - Date.parse(e.at) < WEEK_DAYS * DAY_MS).length;
  const count = (id: string) => (id === "pass" ? passes.length : events.filter((e) => KIND.find((k) => k.id === id)!.match(e)).length);
  return {
    kinds: [{ id: "all", label: "All memories", count: String(events.length), selected: true }, ...KIND.map((k) => ({ id: k.id, label: k.label, count: String(count(k.id)) }))],
    since: events.length ? `Since ${fmtDate(events[0]!.at)}` : "",
    total: events.length,
    weekDelta: week,
    trend,
    trendLabels: labels,
    passReasons: [...reasons].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
    passCount: passes.length,
    antiPortfolio: [],
    memories,
    learnedOvernight: { id: "", text: "" },
    accessLog: [],
    mcp: {
      url: "",
      note: "Local MCP server (stdio): npm run mcp",
      setup: {
        clients: [{ id: "stdio", label: "Claude Desktop · Cursor", steps: ["Clone the Deal Desk repo and run npm install", "Add a stdio MCP server: npx tsx src/mcp/server.ts", "Set DEALDESK_URL to this site's address", "Ask for deal_workflow_get, get_decisions or list_review_queue"] }],
        people: [],
        scopes: ["Deal workflows and their cited facts", "Deal decisions: fit, verdict, valuation", "The review queue (approve is a dry run unless allowed)"],
      },
    },
    exportNote: "Export the memory events",
    outcomes,
    priors: priorsFrom(x.mandate, x.mandateNote ?? "Firm mandate"),
    proposals: [],
    thesis: thesisLines(x.mandate),
    scope: x.storage && !x.storage.durable ? `Deal Desk · ${x.storage.label.toLowerCase()}` : "Deal Desk",
    exportName: "firm-brain",
    intro: `What Deal Desk recorded from deal work: IC decisions, memos and research (${storageLabel}).`,
  };
}
