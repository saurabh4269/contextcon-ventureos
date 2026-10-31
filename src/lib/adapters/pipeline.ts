// Live Pipeline (port PipelineTableScreen) from the same real rows as live Today (src/lib/adapters/today.ts liveRows):
// deals worked on this server (fit from decisions, name/sector from research) and GET /api/pipeline/deals companies
// (researched, or named in a pitch-like email). No deal-stage store exists in this build, so every deal is Sourced and
// the later stages count 0; values with no source (owner, next date, time to decision, conversion) are "—" or absent.
import type { PipelineDeal, PipelineStat, PipelineTableData, Stage, WorkRow } from "@port/types";
import type { LiveRow } from "./today";

const DAY_MS = 86_400_000;
const WEEK = 7;

/** The firm's stage vocabulary (labels only; counts come from the rows). */
const STAGES: Omit<Stage, "count">[] = [
  { id: "sourced", label: "Sourced", tone: "neutral" },
  { id: "review", label: "Initial review", short: "Review", tone: "warn" },
  { id: "partner", label: "Partner meeting", short: "Partner mtg", tone: "warn" },
  { id: "dd", label: "Due diligence", short: "Diligence", tone: "rust" },
  { id: "ic", label: "IC", tone: "ink" },
  { id: "ts", label: "Term sheet", tone: "ok" },
];

const daysSince = (iso: string, now: Date) => Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / DAY_MS));
const touchLabel = (days: number) => (days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} d`);
const VIA: Record<LiveRow["source"], string> = { worked: "Deal Desk", inbound: "Inbox", opened: "Deal Desk", researched: "Research" };

export function toPipelineDeal({ row, at, source }: LiveRow, now: Date): PipelineDeal {
  const days = daysSince(at, now);
  return {
    id: row.id,
    company: { ...row.company, line: row.company.domain ?? row.id },
    stage: "sourced",
    nextStep: nextStep(row),
    owner: "",
    ownerName: "",
    thesisFit: row.fit.score / 100, // NaN when unscored: the fit pill reads "—"
    fitSignals: row.fit.signals,
    intro: { strength: 0, via: VIA[source] },
    lastTouch: { label: touchLabel(days), days },
    sector: row.company.sector === "—" ? undefined : row.company.sector,
    decision: { label: row.action.label, recommended: row.action.recommended },
  };
}

const nextStep = (r: WorkRow) => (r.action.kind === "review" && r.href === "/review" ? "Decisions wait in Review" : r.action.kind === "memo" ? "Read the IC memo" : r.action.kind === "pass" ? "Screened out" : "Open the deal");

export function toLivePipeline(rows: LiveRow[], now: Date): PipelineTableData {
  const deals = rows.map((r) => toPipelineDeal(r, now));
  const recent = rows.filter((r) => daysSince(r.at, now) < WEEK);
  const inbound = recent.filter((r) => r.source === "inbound").length;
  const scored = deals.filter((d) => Number.isFinite(d.thesisFit)).length;
  const sectors = new Map<string, number>();
  for (const d of deals) sectors.set(d.sector ?? "Not researched", (sectors.get(d.sector ?? "Not researched") ?? 0) + 1);
  const stats: PipelineStat[] = [
    { id: "active", label: "Active deals", value: String(deals.length), delta: `+${recent.length}`, dir: "up", good: true, foot: `Active in the last ${WEEK} days`, icon: "deals" },
    { id: "inbound", label: "New inbound", value: String(inbound), delta: "—", dir: "up", good: true, foot: `Pitch-like email, last ${WEEK} days`, icon: "inbound" },
    { id: "dd", label: "In diligence", value: "—", delta: "—", dir: "up", good: true, foot: "No deal stages recorded yet", icon: "diligence" },
    { id: "ttd", label: "Avg time to decision", value: "—", delta: "—", dir: "down", good: true, foot: "No decisions recorded yet", icon: "clock" },
  ];
  return {
    header: { active: deals.length, newThisWeek: recent.length, scope: "All deals", view: "Newest first", passedThisYear: 0 /* no pass decisions are recorded in this build */ },
    stages: STAGES.map((s) => ({ ...s, count: s.id === "sourced" ? deals.length : 0 })),
    deals,
    savedViews: [{ id: "all", label: "Newest first" }],
    conversion: [],
    activity: [],
    stats,
    sectors: [...sectors].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 5),
    filters: [
      { id: "all", label: "All", stages: [] },
      { id: "sourced", label: "Sourced", stages: ["sourced"] },
      { id: "screening", label: "Screening", stages: ["review", "partner"] },
      { id: "diligence", label: "Diligence", stages: ["dd"] },
      { id: "ic", label: "IC", stages: ["ic"] },
      { id: "ts", label: "Term sheet", stages: ["ts"] },
    ],
    mix: { title: "Stage mix", sub: "Active deals by stage", sectorTitle: "Sector mix", sectorSub: "Active deals", benchmark: "firm" },
    search: "Search companies…",
    footnote: `Fit from the mandate criteria on Crustdata data · ${scored} of ${deals.length} scored`,
    states: {
      emptyTitle: "No deals yet", emptyBody: "Research a company, or a pitch email that names its website appears here.", emptyAction: "New deal",
      errorTitle: "Couldn’t load the pipeline", errorBody: "", errorAction: "Try again",
    },
  };
}
