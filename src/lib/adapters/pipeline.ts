// Live Pipeline (port PipelineTableScreen) from the same real rows as live Today (src/lib/adapters/today.ts liveRows):
// deals worked on this server (fit from decisions, name/sector from research) and GET /api/pipeline/deals companies
// (researched, named in a pitch-like email, or moved by a person or the deal workflow). Stages and owners come from the
// deal-stage store (src/lib/deals/stages.ts): a deal nobody moved is Sourced and Unassigned. Portfolio and Passed deals
// leave the table (Passed counts in the header). Values with no source (next date, conversion) are "—" or absent.
import type { PipelineDeal, PipelineStat, PipelineTableData, Stage, StageId, WorkRow } from "@port/types";
import { isClosed, type DealStage } from "@/lib/deals/stage";
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
const VIA: Record<LiveRow["source"], string> = { worked: "Deal Desk", inbound: "Inbox", opened: "Deal Desk", researched: "Research", tracked: "Deal workflow" };
/** Store stage → the table's stage column (the firm's vocabulary above). */
const TABLE_STAGE: Record<Exclude<DealStage, "portfolio" | "passed">, StageId> = { sourced: "sourced", screening: "review", diligence: "dd", ic: "ic" };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

export function toPipelineDeal({ row, at, source, stage, owner }: LiveRow, now: Date): PipelineDeal {
  const days = daysSince(at, now);
  return {
    id: row.id,
    company: { ...row.company, line: row.company.domain ?? row.id },
    stage: isClosed(stage) ? "sourced" : TABLE_STAGE[stage as keyof typeof TABLE_STAGE],
    nextStep: nextStep(row),
    // "" = Unassigned (the table says so); a name only once a person acted and DEALDESK_USER_NAME is set
    owner: owner ? initials(owner) : "",
    ownerName: owner ?? "",
    thesisFit: row.fit.score / 100, // NaN when unscored: the fit pill reads "—"
    fitSignals: row.fit.signals,
    intro: { strength: 0, via: VIA[source] },
    lastTouch: { label: touchLabel(days), days },
    sector: row.company.sector === "—" ? undefined : row.company.sector,
    decision: { label: row.action.label, recommended: row.action.recommended },
  };
}

const nextStep = (r: WorkRow) => (r.action.kind === "review" && r.href === "/review" ? "Decisions wait in Review" : r.action.kind === "memo" ? "Read the IC memo" : r.action.kind === "pass" ? "Screened out" : "Open the deal");

export function toLivePipeline(all: LiveRow[], now: Date, opts: { storageNote?: string } = {}): PipelineTableData {
  const rows = all.filter((r) => !isClosed(r.stage));
  const passed = all.filter((r) => r.stage === "passed" && new Date(r.at).getUTCFullYear() === now.getUTCFullYear()).length;
  const deals = rows.map((r) => toPipelineDeal(r, now));
  const recent = rows.filter((r) => daysSince(r.at, now) < WEEK);
  const count = (id: StageId) => deals.filter((d) => d.stage === id).length;
  const inbound = recent.filter((r) => r.source === "inbound").length;
  const scored = deals.filter((d) => Number.isFinite(d.thesisFit)).length;
  const sectors = new Map<string, number>();
  for (const d of deals) sectors.set(d.sector ?? "Not researched", (sectors.get(d.sector ?? "Not researched") ?? 0) + 1);
  const stats: PipelineStat[] = [
    { id: "active", label: "Active deals", value: String(deals.length), delta: `+${recent.length}`, dir: "up", good: true, foot: `Active in the last ${WEEK} days`, icon: "deals" },
    { id: "inbound", label: "New inbound", value: String(inbound), delta: "—", dir: "up", good: true, foot: `Pitch-like email, last ${WEEK} days`, icon: "inbound" },
    { id: "dd", label: "In diligence", value: String(count("dd")), delta: "—", dir: "up", good: true, foot: "Deals at the Diligence stage", icon: "diligence" },
    { id: "ttd", label: "Avg time to decision", value: "—", delta: "—", dir: "down", good: true, foot: "Not computed in this build", icon: "clock" },
  ];
  return {
    header: { active: deals.length, newThisWeek: recent.length, scope: "All deals", view: "Newest first", passedThisYear: passed },
    stages: STAGES.map((s) => ({ ...s, count: count(s.id) })),
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
    footnote: `Fit from the mandate criteria on Crustdata data · ${scored} of ${deals.length} scored${opts.storageNote ? ` · Stages: ${opts.storageNote}` : ""}`,
    states: {
      emptyTitle: "No deals yet", emptyBody: "Research a company, or a pitch email that names its website appears here.", emptyAction: "New deal",
      errorTitle: "Couldn’t load the pipeline", errorBody: "", errorAction: "Try again",
    },
  };
}
