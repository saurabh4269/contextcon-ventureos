import type { PipelineBoardData, PipelineDeal, PipelineHeader, Stage, WatchlistData } from "../types";

const co = (id: string, name: string, line: string, dark?: boolean) => ({ id, name, initial: name[0], line, ...(dark ? { dark } : {}) });

export const stages: Stage[] = [
  { id: "sourced", label: "Sourced", count: 12, tone: "neutral" },
  { id: "review", label: "Initial review", short: "Review", count: 5, tone: "warn" },
  { id: "partner", label: "Partner meeting", short: "Partner mtg", count: 3, tone: "warn" },
  { id: "dd", label: "Due diligence", short: "Diligence", count: 3, tone: "rust" },
  { id: "ic", label: "IC", count: 1, tone: "ink" },
  { id: "ts", label: "Term sheet", count: 1, tone: "ok" },
];
export const pipelineHeader: PipelineHeader = { active: 25, newThisWeek: 4, scope: "My deals", view: "Monday pipeline", passedThisYear: 31 };

const up = (label: string) => ({ label, effect: "up" as const }), down = (label: string) => ({ label, effect: "down" as const });

/** GET /api/deals?view=monday-pipeline (@assumed). Walled rows come back masked: restricted.codeName only. */
export const pipelineDeals: PipelineDeal[] = [
  { id: "nexaflow", company: co("nexaflow", "NexaFlow", "Month-end close", true), sector: "Finance ops", founders: ["Ana Ruiz"], stage: "dd", nextStep: "IC vote", nextDate: { label: "Mon 2 Nov" }, owner: "SG", ownerName: "Saurabh Gupta", thesisFit: 0.92, fitSignals: [up("headcount +41% 12mo"), up("eng hiring 3× peers")], intro: { strength: 5, via: "Direct" }, lastTouch: { label: "Today", days: 0 }, flags: ["high", "high", "mid", "mid", "low"], decision: { label: "Open memo", recommended: true } },
  { id: "keel", company: co("keel", "Keel", "Startup treasury"), sector: "Fintech", founders: ["Tom Okafor"], stage: "ic", nextStep: "Partner vote", nextDate: { label: "Thu 5 Nov" }, owner: "MK", ownerName: "Maya Kapoor", thesisFit: 0.81, fitSignals: [up("headcount +38% 6mo"), up("ex-Stripe founder")], intro: { strength: 4, via: "Dana" }, lastTouch: { label: "Yesterday", days: 1 }, decision: { label: "Prep IC", recommended: true } },
  { id: "ledgerly", company: co("ledgerly", "Ledgerly", "AP automation"), sector: "Fintech", founders: ["Leo Park"], stage: "partner", nextStep: "Partner meeting", nextDate: { label: "Today 13:30", due: true }, owner: "SG", ownerName: "Saurabh Gupta", thesisFit: 0.86, fitSignals: [up("headcount +38% 12mo"), up("CFO hired ex-Brex")], signal: { label: "Hiring fast", tone: "ok" }, intro: { strength: 4, via: "Priya" }, lastTouch: { label: "3 d", days: 3 }, decision: { label: "Review" } },
  { id: "falcon", company: { id: "falcon", name: "Project Falcon", initial: "F" }, stage: "dd", nextStep: "—", owner: "—", thesisFit: 0, intro: { strength: 0, via: "—" }, lastTouch: { label: "—", days: 99 }, restricted: { codeName: "Project Falcon", note: "Deal team only", request: "Request" } },
  { id: "vantage", company: co("vantage", "Vantage", "Trial data"), sector: "Health data", founders: ["Mo Haddad"], stage: "dd", nextStep: "Model review", nextDate: { label: "Wed 4 Nov" }, owner: "AR", ownerName: "Arjun Rao", thesisFit: 0.7, fitSignals: [up("web traffic +22% 3mo"), down("2 senior exits 90d")], intro: { strength: 2, via: "Mo" }, lastTouch: { label: "4 d", days: 4 }, flags: ["mid"], decision: { label: "Review" } },
  { id: "orbital", company: co("orbital", "Orbital", "Fleet insurance"), sector: "Insurtech", founders: ["Kai Lindqvist"], stage: "review", nextStep: "Founder call", nextDate: { label: "Tue 3 Nov" }, owner: "MK", ownerName: "Maya Kapoor", thesisFit: 0.64, fitSignals: [up("ex-Flexport founding team"), down("headcount flat 6mo")], intro: { strength: 3, via: "Arjun" }, lastTouch: { label: "6 d", days: 6 }, decision: { label: "Book call" } },
  { id: "harbor", company: co("harbor", "Harbor AI", "Port logistics"), sector: "Industrial", founders: ["Ines Duarte"], stage: "sourced", nextStep: "First screen", nextDate: { label: "Today", due: true }, owner: "", thesisFit: 0.77, fitSignals: [up("seed $4M closed Sep"), up("headcount +24% 6mo")], signal: { label: "New funding", tone: "ok" }, intro: { strength: 1, via: "—" }, lastTouch: { label: "Today", days: 0 }, decision: { label: "Claim", recommended: true } },
  { id: "pinecrest", company: co("pinecrest", "Pinecrest", "Clinic payroll"), sector: "Health data", founders: ["Ruth Abara"], stage: "sourced", nextStep: "Follow up", nextDate: { label: "Overdue 5 d", due: true }, owner: "SG", ownerName: "Saurabh Gupta", thesisFit: 0.58, fitSignals: [down("headcount 0% 12mo"), down("no job posts 60d")], signal: { label: "Founder quiet", tone: "warn" }, intro: { strength: 5, via: "Direct" }, lastTouch: { label: "19 d", stale: true, days: 19 }, decision: { label: "Pass" } },
  { id: "quarry", company: co("quarry", "Quarry", "Construction ERP"), sector: "Vertical SaaS", founders: ["Jonas Weber"], stage: "ts", nextStep: "Closing conditions", nextDate: { label: "Fri 6 Nov" }, owner: "SG", ownerName: "Saurabh Gupta", thesisFit: 0.83, fitSignals: [up("ARR est. +2.1× YoY"), up("headcount +29% 12mo")], intro: { strength: 4, via: "Direct" }, lastTouch: { label: "2 d", days: 2 }, decision: { label: "Sign off", recommended: true } },
];
const boardExtra: PipelineDeal[] = [
  { id: "tallow", company: co("tallow", "Tallow", "Payroll for SMBs"), stage: "sourced", nextStep: "Screen", owner: "MK", thesisFit: 0.61, intro: { strength: 2, via: "Arjun" }, lastTouch: { label: "2 d" } },
  { id: "relay", company: co("relay", "Relay", "Treasury APIs"), stage: "review", nextStep: "Deck review", owner: "SG", thesisFit: 0.72, signal: { label: "New funding", tone: "ok" }, intro: { strength: 3, via: "Dana" }, lastTouch: { label: "1 d" } },
  { id: "gridline", company: co("gridline", "Gridline", "Utility billing"), stage: "partner", nextStep: "Tue 3 Nov", owner: "AR", thesisFit: 0.69, intro: { strength: 3, via: "Mo" }, lastTouch: { label: "2 d" } },
];

export const pipelineTable = {
  header: pipelineHeader,
  stages,
  deals: pipelineDeals,
  savedViews: [{ id: "mine", label: "My deals" }, { id: "watch", label: "Watchlist · 42" }, { id: "passed", label: "Passed · 31" }, { id: "monday", label: "Monday pipeline" }],
  conversion: [
    { label: "Sourced → Initial review", rate: 0.42, firmAvg: 0.35 },
    { label: "Initial review → Partner mtg", rate: 0.31, firmAvg: 0.28 },
    { label: "Partner mtg → Due diligence", rate: 0.58, firmAvg: 0.52 },
    { label: "Due diligence → IC", rate: 0.55, firmAvg: 0.6 },
    { label: "IC → Term sheet", rate: 0.48, firmAvg: 0.44 },
  ],
  stats: [
    { id: "active", label: "Active deals", value: "25", delta: "+19%", dir: "up", good: true, foot: "From last 7 days", icon: "deals" },
    { id: "inbound", label: "New inbound", value: "41", delta: "+33%", dir: "up", good: true, foot: "From last 7 days", icon: "inbound" },
    { id: "dd", label: "In diligence", value: "3", delta: "+1 deal", dir: "up", good: true, foot: "From last 7 days", icon: "diligence" },
    { id: "ttd", label: "Avg time to decision", value: "9.4", unit: "days", delta: "+0.8 d", dir: "up", good: false, better: "down", foot: "From last 7 days", icon: "clock" },
  ],
  mix: { title: "Stage mix", sub: "Conversion, last 12 months", sectorTitle: "Sector mix", sectorSub: "Active deals", benchmark: "firm" },
  sectors: [{ label: "Fintech", count: 9 }, { label: "Vertical SaaS", count: 6 }, { label: "Health data", count: 4 }, { label: "Industrial", count: 3 }, { label: "Other", count: 3 }],
  filters: [
    { id: "all", label: "All", stages: [] },
    { id: "sourced", label: "Sourced", stages: ["sourced"] },
    { id: "screening", label: "Screening", stages: ["review", "partner"] },
    { id: "diligence", label: "Diligence", stages: ["dd"] },
    { id: "ic", label: "IC", stages: ["ic"] },
    { id: "ts", label: "Term sheet", stages: ["ts"] },
  ],
  search: "Search companies, founders…",
  footnote: "Fit scored from Crustdata signals · refreshed 06:00",
  bulkActions: [{ id: "assign", label: "Assign" }, { id: "move", label: "Move stage" }, { id: "pass", label: "Pass" }, { id: "export", label: "Export" }],
  snoozeOptions: [{ id: "tomorrow", label: "Tomorrow", hint: "Fri 08:00" }, { id: "week", label: "Next week", hint: "Mon 2 Nov" }, { id: "pick", label: "Pick date…" }],
  states: {
    emptyTitle: "No deals in this view yet", emptyBody: "Forward a deck to deals@northbeam.vc or add a company by hand.", emptyAction: "New deal",
    errorTitle: "Couldn’t load the pipeline", errorBody: "The deals service didn’t answer. Your filters are kept.", errorAction: "Try again",
  },
  activity: [
    { id: "ac1", label: "Moved NexaFlow to Due diligence", at: "02:14", undoable: true },
    { id: "ac2", label: "Added Harbor AI from inbound", at: "03:40", undoable: true },
    { id: "ac3", label: "Logged Ledgerly call notes", at: "Yesterday", undoable: true },
    { id: "ac4", label: "Moved Tallyfi to Passed", at: "Yesterday", undoable: true },
  ],
} satisfies import("../types").PipelineTableData;

/** Board = same deals + more per column. Moves: PATCH /api/deals/[id] {stage} (@assumed), logged + undoable. */
export const pipelineBoard: PipelineBoardData = { header: pipelineHeader, stages, deals: [...pipelineDeals, ...boardExtra] };

export const watchlist: WatchlistData = {
  count: 42,
  worthACall: 3,
  refreshNote: "people · headcount and ARR estimates · refreshed 06:00",
  rows: [
    { id: "w1", company: co("ledgerly", "Ledgerly", "AP automation"), headcount: [118, 124, 131, 138, 146, 152, 158, 163], growth: "+38%", estArr: "$9–11M", signal: { label: "Hiring fast", tone: "ok" }, intro: { strength: 4, via: "Priya · ex-Brex" }, selected: true },
    { id: "w2", company: co("closeloop", "Closeloop", "Sales comp"), headcount: [40, 44, 47, 52, 58, 61, 66, 71], growth: "+22%", estArr: "$13M", signal: { label: "Passed 2024", tone: "neutral" }, intro: { strength: 3, via: "Arjun · ex-Stripe" } },
    { id: "w3", company: co("pinecrest", "Pinecrest", "Clinic payroll"), headcount: [30, 31, 31, 32, 32, 32, 31, 31], growth: "0%", estArr: "$4M", signal: { label: "Founder quiet", tone: "warn" }, intro: { strength: 5, via: "Direct" } },
    { id: "w4", company: co("meridian", "Meridian", "Freight pay"), headcount: [60, 66, 70, 78, 85, 90, 96, 99], growth: "+31%", estArr: "$7M", signal: { label: "New CFO", tone: "ok" }, intro: { strength: 2, via: "Dana · ex-Ramp" } },
    { id: "w5", company: co("fathom", "Fathom", "Spend data"), headcount: [88, 86, 84, 80, 76, 74, 70, 66], growth: "−18%", estArr: "$12M", signal: { label: "Layoffs", tone: "rust" }, intro: { strength: 1, via: "—" } },
    { id: "w6", company: co("brightline", "Brightline", "Lending infra"), headcount: [22, 24, 27, 30, 33, 36, 40, 44], growth: "+46%", estArr: "$3M", signal: { label: "Raising soon", tone: "ok" }, intro: { strength: 3, via: "Priya · ex-Brex" } },
    { id: "w7", company: co("sable", "Sable", "Vendor risk"), headcount: [50, 52, 53, 55, 55, 56, 58, 59], growth: "+9%", estArr: "$6M", intro: { strength: 2, via: "Mo · ex-Plaid" } },
  ],
  panel: {
    person: { initials: "LP", name: "Leo Park", title: "CEO, Ledgerly" },
    company: co("ledgerly", "Ledgerly", "AP automation"),
    path: { you: "SG", via: { initials: "PS", name: "Priya Shah", context: "Brex 2019–22 with Leo" }, alt: { initials: "AK", label: "Arjun · Stripe · 1 email" }, target: "LP" },
    stats: [{ value: "2019–22", label: "shared employer" }, { value: "12", label: "emails w/ you" }, { value: "3 d", label: "last reply" }],
    sources: [{ kind: "crust", label: "Crustdata" }, { kind: "mail", label: "Gmail" }],
    glance: { headcount: ["118", "163"], thesisFit: 0.86, lastRaise: "Series A · 2024" },
    action: { id: "draft_intro", label: "Draft ask to Priya" },
    actionNote: "saved to Gmail",
  },
};
