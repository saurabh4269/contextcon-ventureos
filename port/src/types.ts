/**
 * Deal Desk UI — shared types.
 * Every screen in ./screens takes one `…ScreenProps` object built from these types.
 * Fixtures in ./fixtures satisfy them exactly; the backend mapping lives in PORTING.md.
 * Fields marked  @assumed  are guessed names — check them against the real API before wiring.
 */

/* ───────────── primitives ───────────── */
export type ID = string;
export type Mode = "invest" | "bank";
export type Nav = "today" | "pipeline" | "portfolio" | "mandates" | "brain" | "settings" | "agents" | "runs" | "review" | "assistant";
/** v3.2 · "warm" = Deal Desk (off-white, serif, sienna alerts). "mono" = near-monochrome comparison variant. */
export type Tone2 = "warm" | "mono";
export type Tone = "ok" | "warn" | "rust" | "neutral" | "ink";
export type SrcKind = "pdf" | "xlsx" | "crust" | "web" | "cal" | "mail" | "bank" | "call" | "deck" | "memo" | "db";
export type StepState = "done" | "running" | "queued" | "warn";
export type FlagLevel = "high" | "mid" | "low";
export type ConfidenceLevel = "High" | "Medium" | "Low";
/** Ready = render data. The other three render the shared state blocks (see components/states.tsx). */
export type LoadStatus = "ready" | "loading" | "empty" | "error";
export interface ScreenStatus { status?: LoadStatus; error?: string; onRetry?: () => void }

/** A headline with one highlighted fragment: pre + <hl> + post. */
export interface Headline { pre: string; hl?: string; post?: string }

/** Logo square for a company / project. */
/** v3.2 · `logoUrl` is optional; <CompanyLogo> falls back to a monogram tile coloured from a hash of `domain` (or the name). */
export interface CompanyRef { id: ID; name: string; initial: string; line?: string; dark?: boolean; logoUrl?: string; domain?: string }
/** Anything with a name that can show a company mark. */
export interface LogoLike { name: string; initial?: string; dark?: boolean; logoUrl?: string; domain?: string }
export interface PersonRef { id?: ID; initials: string; name: string; title?: string }
export interface User { id: ID; name: string; firstName: string; initials: string; /** v5 · photo URL (initials are the fallback). */ avatarUrl?: string; /** v5 · GitHub handle, linked from the account menu. */ github?: string; /** v5 · e.g. "Partner". */ role?: string }

/** Exact text behind a source chip (opens in SrcPop). */
export interface Excerpt { where: string; quote: string; highlight: string; href?: string }
/** A citation chip. `n` = citation number in a memo. */
export interface SourceRef { kind: SrcKind; label: string; n?: number; href?: string; excerpt?: Excerpt; /** v3.3 · where the data came from when it is a live signal (e.g. "crustdata"); shown as a small provider chip. */ provider?: ToolId; /** v3.3 · freshness of a provider signal, e.g. "updated 2h ago" */ asOf?: string }

/* ───────────── shell ───────────── */
export interface NavBadge { count: number; alert?: boolean }
export interface ShellData {
  user: User;
  /** v3.2 · the firm, shown in the sidebar footer (the user's avatar lives in the top bar). */
  firm?: { name: string; sub: string; initial: string };
  /** Badge per nav item (Today = needs-you count, Pipeline = active deals …). */
  badges: Partial<Record<Nav, NavBadge>>;
  /** Absent when no agent runtime reports it (nothing is shown). */
  agentsWorking?: number;
  /** Shows the red dot on the bell. */
  unreadNotifications?: boolean;
  /** v3.2 · what the dock shows when opened with ⌘J on a page that brings no dock of its own. */
  assistant?: AssistantData;
  /** v3.3 · page-aware dock content (suggestions follow the page you are on); used when `assistant` is absent. */
  assistantByPage?: Partial<Record<Nav, AssistantData>>;
}
export interface Crumb { label: string; href?: string }

/* ───────────── valuation (/api/deals/[id]/valuation) ───────────── */
export interface ValuationMethod { label: string; low: number; high: number }
export interface Valuation {
  /** "pre-money" in invest mode, "EV" in banking. Never mix them. */
  basis: "pre-money" | "EV";
  currency: "USD";
  unit: "M";
  low: number;
  high: number;
  cap: number;
  ask?: number;
  /** One sentence shown in the cap tooltip. */
  capRationale: string;
  source: SourceRef;
  /** Axis for range bars, in `unit`. */
  axis: { min: number; max: number };
  methods?: ValuationMethod[];
}

/* ───────────── shared deal header ───────────── */
export interface DealHeader {
  company: CompanyRef;
  stageLabel: string;
  subtitle: string;
  files: { reviewed: number; total: number };
  icLabel: string;
  flags: FlagLevel[];
  /** Absent when no valuation exists yet (live research before a data room): the Range row is omitted, never invented. */
  valuation?: Valuation;
}

/* ───────────── bridge / waterfall ───────────── */
export interface BridgePart { label: string; value: number; kind: "start" | "down" | "up" | "end" | "ghost" }

/* ───────────── Today ───────────── */
export interface Meeting { id: ID; time: string; title: string; sub: string; next?: boolean }
export interface Draft { id: ID; to: string; subject: string; time: string; /** deep link into Gmail/Outlook drafts */ href: string; /** v3: first line of the body, shown as a preview. */ preview?: string; /** v3: what the draft is grounded in. */ basis?: string }
export interface CardAction { id: ID; label: string }
interface DecisionBase { id: ID; company: CompanyRef; tag: { label: string; tone: Tone }; time: string; title: Headline; action: CardAction; sources: SourceRef[] }
export type DecisionCard =
  | (DecisionBase & { kind: "arrGap"; bridge: BridgePart[] })
  | (DecisionBase & { kind: "personMove"; person: PersonRef; to: CompanyRef; date: string; metric: { label: string; before: string; after: string; trend: number[] } })
  | (DecisionBase & { kind: "tieOut"; rows: { label: string; value: number }[]; scaleMax: number; note: string })
  | (DecisionBase & { kind: "quietBuyer"; trendLabel: string; trend: number[]; countdown: { value: number; unit: string; caption: string } })
  /** v3 (optional variant): inbound pitch matched to a thesis. */
  | (DecisionBase & { kind: "inboundFit"; founder: PersonRef; thesis: string; chips: { label: string; ok: boolean }[]; fit: number; via: string; ask: string });

interface TileBase { id: ID; company: CompanyRef; title?: string; pill?: string; pillTone?: Tone; sources: SourceRef[] }
export type InsightTile =
  | (TileBase & { kind: "runway"; months: number; trend: number[]; link: { label: string; href: string } })
  | (TileBase & { kind: "quietContact"; activeBars: number; totalBars: number; caption: string; value: string })
  | (TileBase & { kind: "secondLook"; before: string; after: string })
  | (TileBase & { kind: "rangeBars"; ranges: [number, number][]; emphasis: number; axisLabels: [string, string] })
  | (TileBase & { kind: "progress"; done: number; total: number })
  | (TileBase & { kind: "personMove"; person: PersonRef; caption: string });

export interface TodayData {
  mode: Mode;
  dateLabel: string;
  greeting: string;
  needYou: number;
  doneWithoutYou: { count: number; breakdown: string; batchId: ID };
  eveningBrief: string;
  briefSent: { at: string; channels?: string };
  ask: { placeholder: string; chips: string[] };
  decisions: DecisionCard[];
  meetings: { dayLabel: string; app: string; items: Meeting[]; freeAfter: string };
  drafts: { app: "Gmail" | "Outlook"; items: Draft[] };
  worthALook: { sourceNote: string; items: InsightTile[] };
  closingLine: string;
  /** Outbound hold queue: approved sends wait `holdMinutes` before leaving. */
  outbound?: OutboundItem[];
  /** v3: ledger strip of 4 numbers under the greeting (v1-style number tiles). */
  pulse?: PulseTile[];
}
/** v3 · One number tile. `viz` is a small visual so the number reads in context. */
export interface PulseTile {
  id: ID;
  label: string;
  value: string;
  /** v3.1: optional change chip next to the label ("+4 wk", "−0.8 mo"). */
  delta?: { label: string; tone?: "ok" | "rust" | "neutral" };
  unit?: string;
  note: string;
  tone?: Tone;
  viz?: { kind: "bars"; d: number[]; hl?: number } | { kind: "gauge"; v: number; center: string } | { kind: "spark"; d: number[] };
}

/* ───────────── Outbound hold queue (undo window) ───────────── */
export interface OutboundItem {
  id: ID;
  to: string;
  subject: string;
  app: "Gmail" | "Outlook";
  status: "holding" | "sent" | "undone";
  /** Seconds left in the hold window (server computes from hold_until − now). @assumed name */
  secondsLeft: number;
  holdSeconds: number;
  approvedBy: string;
}

/* ───────────── Ask (⌘J) — /api/concierge/ask ───────────── */
export type AskAnswer =
  | { kind: "answer"; paragraphs: { text: string; cites: number[] }[]; sources: SourceRef[]; followUps: string[] }
  | { kind: "denied"; denial: AccessDenial };
export interface AskData { question: string; scope: string; answer: AskAnswer }

/* ───────────── Slack / Teams approval card (Block Kit preview) ───────────── */
export interface SlackButton { id: ID; label: string; style?: "primary" | "danger" }
export interface SlackMessage {
  id: ID;
  channel: string;
  time: string;
  ephemeral?: boolean;
  title: string;
  lines: string[];
  chips?: { label: string; ok?: boolean }[];
  suggest?: string;
  buttons: SlackButton[];
  footer: string;
  /** v3: emoji reactions under the card (👍 votes). */
  reactions?: { emoji: string; count: number; mine?: boolean }[];
  /** v3: vote tally rendered as a Block Kit context row. */
  votes?: { needed: number; voters: { initials: string; name: string; at: string }[] };
  /** v3: once acted on, buttons are replaced by this context line (Block Kit message update). */
  resolved?: { icon: "check" | "clock" | "arrow"; text: string; tone?: Tone };
  /** v3: thread reply count + last reply preview. */
  thread?: { replies: number; last: string };
  /** v3: Block Kit image block (rendered server-side as PNG); here a small chart preview. */
  metric?: { label: string; value: string; note?: string; series: number[]; plan?: number[] };
}

/* agent run panel */
export interface PlanStep { id: ID; state: StepState; label: string; result: string }
export interface AgentRun {
  id: ID;
  title: string;
  status: "running" | "paused" | "done" | "failed";
  since: string;
  trigger: string;
  stats: { value: string; label: string }[];
  plan: PlanStep[];
  graph: { root: string; branches: { title: string; source: SourceRef }[]; result: string };
  didOnItsOwn: { id: ID; label: string }[];
  neverDoes: string[];
  primary: CardAction;
}

/* ⌘K palette */
export type PaletteIcon = "deal" | "file" | "sheet" | "ask" | "person";
export interface PaletteItem { id: ID; icon: PaletteIcon; label: string; meta?: string; href?: string }
/** Denial is ephemeral: rendered only for the asker, never logged to shared views (it IS logged to access_denied_log). */
export interface AccessDenial { codename: string; reason: string; requestable: boolean }
export interface PaletteData { query: string; groups: { title: string; items: PaletteItem[] }[]; selectedId?: ID; denied?: AccessDenial }

/* ───────────── Pipeline ───────────── */
export type StageId = string;
/** `short` fits the table's stage pill; `tone` colours it (same language as Today's stage pills). */
export interface Stage { id: StageId; label: string; count: number; short?: string; tone?: "neutral" | "warn" | "rust" | "ink" | "ok" }
/** v4 · One Crustdata signal behind a fit score; `effect` = whether it pushed the score up or down. */
export interface FitSignal { label: string; effect: "up" | "down" }
export interface PipelineDeal {
  id: ID;
  company: CompanyRef;
  stage: StageId;
  nextStep: string;
  owner: string; // initials
  thesisFit: number; // 0..1
  signal?: { label: string; tone: Tone };
  intro: { strength: 0 | 1 | 2 | 3 | 4 | 5; via: string };
  lastTouch: { label: string; stale?: boolean; /** days since, for sorting */ days?: number };
  flags?: FlagLevel[];
  focus?: boolean;
  /** Restricted deal shown to someone outside the wall → render code name, mask fields. */
  restricted?: { codeName: string; note?: string; request?: string };
  /** v4 table: full owner name ("" owner = unassigned), founders (searchable), sector, the top Crustdata signals behind the fit, a dated next step and the inline decision. */
  ownerName?: string;
  founders?: string[];
  sector?: string;
  fitSignals?: FitSignal[];
  nextDate?: { label: string; due?: boolean };
  decision?: { label: string; recommended?: boolean };
}
/** v4 · Pipeline stat card: `good` decides the delta pill colour (green good, sienna bad), `dir` its arrow. */
export interface PipelineStat { id: ID; label: string; value: string; unit?: string; delta: string; dir: "up" | "down"; good: boolean; foot: string; icon: "deals" | "inbound" | "diligence" | "clock"; /** v4.1 · which direction is good; when set it decides the pill colour (e.g. time to decision: "down") */ better?: "up" | "down" }
/** v4 · Table filter pill: one label over one or more pipeline stages. */
export interface StageFilter { id: ID; label: string; stages: StageId[] }
export interface PipelineHeader { active: number; newThisWeek: number; scope: string; view: string; passedThisYear: number }
export interface ConversionRow { label: string; rate: number; firmAvg: number }
export interface ActivityItem { id: ID; label: string; at: string; undoable?: boolean }
export interface PipelineTableData {
  header: PipelineHeader;
  stages: Stage[];
  deals: PipelineDeal[];
  savedViews: { id: ID; label: string }[];
  conversion: ConversionRow[];
  activity: ActivityItem[];
  /** v4 */
  stats?: PipelineStat[];
  sectors?: { label: string; count: number }[];
  filters?: StageFilter[];
  mix?: { title: string; sub: string; sectorTitle: string; sectorSub: string; benchmark: string };
  search?: string;
  footnote?: string;
  /** v4.1 · bulk bar (slides up on selection), snooze popover options, and empty / error copy. */
  bulkActions?: { id: "assign" | "move" | "pass" | "export"; label: string }[];
  snoozeOptions?: { id: string; label: string; hint?: string }[];
  states?: { emptyTitle: string; emptyBody: string; emptyAction: string; errorTitle: string; errorBody: string; errorAction: string };
}
export interface PipelineBoardData {
  header: PipelineHeader; stages: Stage[]; deals: PipelineDeal[];
  /** v3: a closed deal moving into Portfolio. Phases are screenshot-able frames (film Act 4). */
  handoff?: PortfolioHandoff;
}
export interface PortfolioHandoff {
  dealId: ID;
  phase: "closed" | "moving" | "filling" | "done";
  /** What gets copied into the Portfolio page; `done` flips as each lands. */
  filled: { label: string; done: boolean }[];
  closedLabel: string; // "Wire sent · 2 Dec"
}

export interface WatchRow {
  id: ID;
  company: CompanyRef;
  headcount: number[];
  growth: string; // "+38%"
  estArr: string;
  signal?: { label: string; tone: Tone };
  intro: { strength: 0 | 1 | 2 | 3 | 4 | 5; via: string };
  selected?: boolean;
}
export interface IntroPath {
  you: string; // initials
  via: { initials: string; name: string; context: string };
  alt?: { initials: string; label: string };
  target: string; // initials
}
export interface WatchPanel {
  person: PersonRef;
  company: CompanyRef;
  path: IntroPath;
  stats: { value: string; label: string }[];
  sources: SourceRef[];
  glance: { headcount: [string, string]; thesisFit: number; lastRaise: string };
  action: CardAction;
  actionNote: string;
}
export interface WatchlistData { count: number; worthACall: number; rows: WatchRow[]; refreshNote: string; panel: WatchPanel }

/* ───────────── Portfolio ───────────── */
export interface PortfolioCompany {
  id: ID;
  company: CompanyRef;
  arr: string;
  arrTrend: number[];
  burn: string;
  runwayMonths: number;
  lastUpdate: { label: string; late?: boolean };
  alert?: { label: string; tone: Tone; /** v4 · matches a PortfolioFilter id (runway, growth, raising, late) */ kind?: string };
  selected?: boolean;
  /** v4 · "Fleet payments · Series A" line under the name. */
  line?: string;
  /** v4 · on track and folded under "+N on track" until expanded. */
  onTrack?: boolean;
  /** v4 · months of runway, oldest first (per-company detail chart). */
  runwayHistory?: { month: string; months: number }[];
  /** v4 · cash on hand, e.g. "$5.1M". */
  cash?: string;
  founder?: string;
}
/** v4 · a drafted document a report tile or decision opens in a side sheet. */
export interface PortfolioDoc {
  title: string;
  sub: string;
  status: string;
  sections: { id: ID; title: string; body?: string; items?: { label: string; value?: string; tone?: Tone; done?: boolean }[] }[];
  primary: { id: ID; label: string; done: string };
  source?: SourceRef;
}
export type ReportTile =
  | { id: ID; kind: "lpUpdate"; title: string; progress: number; caption: string; right: string }
  | { id: ID; kind: "boardDeck"; title: string; date: string; caption: string }
  | { id: ID; kind: "kpiRequests"; title: string; received: number; total: number; caption: string };
/** v4 · what a report tile opens. Keyed by ReportTile id. */
export type ReportDocs = Record<ID, PortfolioDoc>;
export interface PortfolioPanel {
  company: CompanyRef;
  alert: { label: string; tone: Tone };
  runwayMonths: number;
  history: { month: string; months: number }[];
  projection: number;
  facts: { label: string; value: string; source: SourceRef }[];
  pattern: string;
  action: CardAction;
  /** v3: just-onboarded company, page filled from the deal (memo, model, data room, call notes). */
  onboarded?: { label: string; from: string[]; at: string };
  /** v4 · the drafted decision the action opens. */
  decision?: PortfolioDoc & { options: { id: ID; label: string; sub: string }[]; recommended: ID };
}
export interface PortfolioData {
  fundLabel: string;
  companyCount: number;
  view: string;
  alertLineMonths: number;
  runwayAxisMax: number;
  companies: PortfolioCompany[];
  hiddenOnTrack: number;
  reports: ReportTile[];
  panel: PortfolioPanel;
  /** v4 · filter tabs over the table (ids: all, attention, or an alert kind). */
  filters?: { id: ID; label: string }[];
  /** v4 · documents the report tiles open. */
  docs?: ReportDocs;
  /** v4 · the portfolio watch agent's current run. */
  live?: LiveRun;
  /** v4 · CSV export file name, without extension. */
  exportName?: string;
  /** v4 · one-line page subtitle. */
  sub?: string;
}

/* ───────────── Mandates (banking) ───────────── */
export type MilestoneState = "done" | "active" | "todo";
export interface Buyer { id: ID; name: string; type: "Sponsor" | "Strategic"; milestones: MilestoneState[]; vdrViews: number[]; lastTouch: string; quiet?: boolean }
export type QaItem =
  | { id: ID; status: "tieOut"; buyer: string; question: string; sources: SourceRef[] }
  | { id: ID; status: "draftReady" | "needsClient"; buyer: string; question: string };
export interface MandatesData {
  mandates: { id: ID; name: string; sub: string; progress: number; selected?: boolean; walled?: boolean; gatesOpen?: number }[];
  sections: { id: ID; label: string; meta: string; selected?: boolean }[];
  selectedName: string;
  eyebrow: string;
  title: string;
  process: { steps: string[]; currentIndex: number };
  countdown: { days: number; label: string; due: string };
  funnel: { label: string; n: number }[];
  milestoneLabels: string[];
  buyers: Buyer[];
  moreBuyers: number;
  sync: { sources: SourceRef[]; at: string };
  qa: { answered: number; total: number; items: QaItem[] };
  footballField: Valuation;
  gates: MandateGate[];
  walled?: boolean;
  /** The wall = this mandate's member list. */
  wall: { members: { initials: string; name: string; role: string }[]; approver: string; crossings: number };
}

/* ───────────── Deal page ───────────── */
export interface OutlineItem { id: ID; label: string; state: StepState; count?: number; selected?: boolean }
export interface Claim {
  id: ID;
  label: string;
  reported: { value: string; source: string };
  verified: { value: string; source: string };
  variance: string;
  status: { label: string; tone: "rust" | "warn" | "neutral" };
  source: SourceRef;
}
export type EvidenceItem =
  | { id: ID; kind: "doc"; source: SourceRef; where: string; highlight: string; page?: EvidencePage; href?: string }
  | { id: ID; kind: "sheet"; source: SourceRef; where: string; rows: { row: string; label: string; value: string; highlight?: boolean }[]; href?: string }
  | { id: ID; kind: "bars"; source: SourceRef; where: string; values: number[]; caption: string; labels?: string[]; href?: string };
export interface DealData {
  header: DealHeader;
  /** v3.2 · optional live agent run, shown as a step list (shimmer on current, checks on done) */
  live?: LiveRun;
  outline: OutlineItem[];
  section: {
    eyebrow: string;
    confidence: ConfidenceLevel;
    headline: Headline;
    bridgeNote: string;
    bridge: BridgePart[];
    claims: Claim[];
    ask: { text: string; action: CardAction };
    /** v3: seed deals with no bridge show deck-claimed vs verified growth instead. */
    growth?: GrowthComparison;
  };
  evidence: { agreeNote: string; items: EvidenceItem[] };
  team: DealTeam;
  walled?: boolean;
}

/* Deal team panel — roster, claim (POST /api/deals/[id]/claim), owner suggestion (GET …/owner-suggestion), sourced-by credit */
export type DealRole = "lead" | "team" | "contributor" | "partner";
export interface DealMember { id: ID; initials: string; name: string; role: DealRole; title: string }
export interface OwnerSuggestion { userId: ID; initials: string; name: string; reasons: string[]; confidence: number }
export interface DealTeam {
  members: DealMember[];
  sourcedBy: { initials: string; name: string; via: string; at: string; locked: boolean };
  /** null when the deal already has a lead and you're on it. */
  suggestion: OwnerSuggestion | null;
  canClaim: boolean;
  /** firm owner_rule: assign_directly | ask_first */
  ownerRule: "assign_directly" | "ask_first";
}

/** GET /api/deals/[id] → 403 { restricted, codename, reason } */
export interface RestrictedDeal { restricted: true; codename: string; reason: string; stageLabel?: string; requested?: boolean; approverRole: string }

/* ───────────── Data room ───────────── */
export interface RoomFile { id: ID; name: string; state: StepState; selected?: boolean }
export interface RoomFolder { id: ID; name: string; total: number; reviewed: number; open?: boolean; files?: RoomFile[] }
export interface RoomFact { id: ID; label: string; value: string; tone: Tone; impact: string; source: SourceRef }
export interface DataRoomData {
  header: DealHeader;
  missingCount: number;
  totalFiles: number;
  folders: RoomFolder[];
  preview: { folder: string; file: string; page: number; pages: number; docType: string; clauses: string[]; /** v4 · real page text before each clause (replaces the placeholder lines). */ context?: string[][] };
  facts: RoomFact[];
  feeds: Headline;
}

/* ───────────── IC memo ───────────── */
export interface MemoData {
  company: CompanyRef;
  outline: OutlineItem[];
  meta: { draft: string; citations: number; unsupported: number };
  title: string;
  recommendation: { verdict: string; valuation: Valuation; valuationCite: number; verifiedArr: { value: string; cite: number }; flags: FlagLevel[] };
  conditions: { id: ID; text: string; cite: number; showValuation?: boolean }[];
  bridge: BridgePart[];
  disagreement?: { you: string; agent: string; cite: number };
  questions: string[];
  sources: SourceRef[];
  activity: { id: ID; label: string; at: string }[];
  exportNote: string;
  priors?: ValuationPriors;
  /** v3: seed memos show the growth comparison when there is no ARR bridge. */
  growth?: GrowthComparison;
  /** v4 · document-first memo (S3_B): numbered prose sections, footnoted sources, Memo companion rail. */
  doc?: MemoDoc;
}
/** v4 · memo prose. `[n]` = footnote to source n, `**x**` = bold. Plain text otherwise, so it round-trips through Edit memo and the .md export. */
export type MemoText = string;
export type MemoBlock =
  | { kind: "p"; text: MemoText }
  | { kind: "list"; ordered?: boolean; items: MemoText[] }
  /** The recommendation box (verdict, valuation, verified revenue, flags). */
  | { kind: "recommendation" }
  | { kind: "figure"; figure: "growth" | "valuation"; caption: string; cites: number[] }
  | { kind: "facts"; rows: { k: string; v: MemoText }[] }
  /** `agentLevel` = the agent's rating where the analyst disagrees; the Analyst override decides which one the memo shows. */
  | { kind: "risks"; rows: { id: ID; risk: MemoText; level: FlagLevel; agentLevel?: FlagLevel; mitigant: MemoText }[] }
  | { kind: "questions"; items: { id: ID; q: string; answer: MemoText }[] }
  | { kind: "disagreement" };
/** Something a person must decide before the memo is final. Drives the amber dot in the template rail. */
export interface MemoReview { id: ID; label: string; detail: MemoText; action: string; done: string; /** Acting on it appends this line to the `target` section's ordered list. */ adds?: { target: ID; text: MemoText } }
export interface MemoSection { id: ID; title: string; state: StepState; blocks: MemoBlock[]; review?: MemoReview }
export interface MemoSourceDoc { n: number; kind: SrcKind; label: string; where: string; quote: string; highlight: string; href: string; provider?: ToolId; asOf?: string }
export interface MemoAction { id: ID; at: string; label: string; detail?: string; by: "agent" | "person"; who: string; tone?: Tone }
export interface MemoVerdict { badge: string; verdict: string; flags: FlagLevel[]; note: MemoText }
export interface MemoDoc {
  eyebrow: string;
  author: PersonRef;
  preparedWith: string;
  date: string;
  status: string;
  savedAt: string;
  ic: { label: string; when: string };
  fit: { score: number; signals: FitSignal[] };
  /** Key numbers under the title (round, raised, founder, growth). */
  facts: { id: ID; label: string; value: string; sub?: string; tone?: Tone }[];
  sections: MemoSection[];
  sources: MemoSourceDoc[];
  actions: MemoAction[];
  override: { label: string; hint: string; by: PersonRef; agent: MemoVerdict; analyst: MemoVerdict; defaultOn: boolean };
  share: { url: string; access: string; people: PersonRef[] };
  vote: { message: SlackMessage; queue: string; queued: string; note: string };
  /** File name for the .md export, without extension. */
  exportName: string;
}
/** v3: deck-claimed vs verified monthly growth. `verified` is the metric per month (e.g. MRR in $K), oldest first. */
export interface GrowthComparison {
  metric: string; // "MRR"
  unit: "K" | "M";
  months: string[];
  verified: number[];
  claimedRate: number; // 0.40
  verifiedRate: number; // 0.22
  claimedSource: SourceRef;
  verifiedSource: SourceRef;
}
/** Firm priors behind the valuation (from Firm brain outcomes). @assumed shape */
export interface ValuationPriors {
  basisLabel: string; // "EV / ARR" or "Pre-money / ARR"
  /** ARR the multiples apply to (verified), in M. */
  arr: number;
  comparable: { company: string; multiple: number; outcome: string; tone: Tone }[];
  median: number;
  /** Interquartile band of past multiples. */
  band: { low: number; high: number };
  axis: { min: number; max: number };
  source: SourceRef;
  implied: { low: number; high: number };
  note: string;
}

/* ───────────── Firm brain ───────────── */
export interface Memory { id: ID; text: string; kind: string; usage: string; source: SourceRef; /** v4 · BrainData.kinds id */ kindId?: ID; at?: string }
export interface BrainData {
  kinds: { id: ID; label: string; count: string; selected?: boolean }[];
  since: string;
  total: number;
  weekDelta: number;
  trend: number[];
  /** v3.1: x-axis labels for `trend` (same length). Optional. */
  trendLabels?: string[];
  passReasons: { label: string; n: number }[];
  passCount: number;
  antiPortfolio: { company: CompanyRef; outcome: string }[];
  memories: Memory[];
  learnedOvernight: { id: ID; text: string };
  accessLog: { id: ID; who: string; what: string; at: string; /** v4 · opens a memory category */ kindId?: ID; href?: string }[];
  /** v3.1: optional agent-usage card in the right rail. reads = memories read per day, oldest first. */
  usage?: { reads: number[]; days?: string[]; delta: string; cited: number; stale: number };
  mcp: { url: string; note: string; /** v4 · setup sheet */ setup?: { clients: { id: ID; label: string; steps: string[] }[]; people: { initials: string; name: string; client: string }[]; scopes: string[] } };
  exportNote: string;
  outcomes: Outcome[];
  priors: { label: string; value: string; basis: string }[];
  proposals: ThesisProposal[];
  /** v3: optional thesis view (Firm brain "learned from this outcome" moment). */
  thesis?: ThesisLine[];
  /** v4 · "Northbeam Ventures · Fund III" scope line under the title. */
  scope?: string;
  /** v4 · export file name, without extension. */
  exportName?: string;
}
export interface Outcome { id: ID; date: string; company: string; decision: "invested" | "passed"; result: string; tone: Tone; /** v4 · logo ref */ co?: CompanyRef }
/** GET /api/firm/thesis-proposals · POST /api/firm/thesis-proposals/[id] {decision} */
export interface ThesisProposal { id: ID; field: string; from: string; to: string; why: string; evidence: string; proposedBy: string; /** v4 · thesis line it rewrites, and the line's new text */ lineId?: ID; next?: string }
/** v3: the firm thesis as lines, so an approved proposal can be shown landing (before → after highlight). */
export interface ThesisLine {
  id: ID;
  field: string;
  text: string;
  /** Previous wording, shown struck through while `state` is "updating". */
  before?: string;
  state?: "steady" | "updating" | "learned";
  /** "Learned from Helio · Jan" */
  learnedFrom?: string;
}

/* ───────────── Settings / Integrations ───────────── */
export interface Integration { id: ID; name: string; initial: string; scope: string; status: "on" | "fix" | "off" }
export type SettingsSection = "workflow" | "connectors" | "integrations" | "members" | "access" | "export";
export interface SettingsData {
  isAdmin: boolean;
  integrations: Integration[];
  /** v4 · Settings > Connectors. `integrations` is the legacy list; the Connectors page and its health banner read this. */
  connectors: ConnectorsData;
  mcp: { url: string };
  briefs: { id: ID; label: string; time: string; channels: ("email" | "slack" | "teams")[]; on: boolean }[];
  guardrails: { id: ID; label: string; on: boolean }[];
  config: FirmConfig;
  members: FirmMember[];
  wallGroups: WallGroup[];
  roles: { id: string; label: string; summary: string }[];
  audit: AccessDeniedRow[];
  export: ExportData;
}
/** GET/PATCH /api/firm/config */
export type Autonomy = 0 | 1 | 2 | 3;
export interface FirmConfig {
  mode: Mode;
  thesis: { sectors: string[]; stages: string[]; geos: string[]; checkSize: { min: number; max: number; unit: "K" | "M" | "B" }; ownershipTarget?: number };
  stages: { id: ID; label: string }[];
  passTemplates: { id: ID; reason: string; preview: string; uses: number }[];
  autonomy: Autonomy;
  holdMinutes: number;
  ownerRule: "assign_directly" | "ask_first";
}
/** firm_members */
export interface FirmMember { id: ID; name: string; initials: string; email: string; role: string; walls: string[]; status: "active" | "invited" }
export interface WallGroup { id: ID; codename: string; members: number; approver: string; restricted: boolean }
/** access_denied_log — admin only */
export interface AccessDeniedRow { id: ID; at: string; who: string; target: string; surface: "web" | "ask" | "cmdk" | "slack" | "mcp" | "api"; reason: string }
/** POST /api/firm/export · BYO LLM keys (masked; never returned after save) */
export interface ExportData { lastExport?: string; contents: string[]; keys: { id: ID; provider: string; masked: string | null; addedAt?: string }[] }

/* ───────────── Onboarding — POST /api/firm/onboarding ───────────── */
export interface OnboardingData {
  step: 1 | 2 | 3 | 4 | 5;
  steps: string[];
  firm: { name: string; website: string; mode: Mode; checkSize: { min: number; max: number; unit: "K" | "M" | "B" } };
  prefill?: { sectors: string[]; stages: string[]; geos: string[]; source: string };
  invites: { email: string; role: string; suggested?: boolean; why?: string }[];
  roles: string[];
  channel: "slack" | "teams";
  autonomy: Autonomy;
  holdMinutes: number;
  working: { id: ID; state: StepState; label: string; value: number | string }[];
}

/* ───────────── Banking gates (per mandate) ───────────── */
export type GateState = "cleared" | "pending" | "blocked" | "todo";
export interface MandateGate { id: "conflicts" | "engagement" | "kyc"; label: string; state: GateState; detail: string; owner: string; at?: string }


/* ---------------- v3.2 · Agents, calm Today, docked assistant ---------------- */
export type AgentStepIcon = "files" | "claims" | "bank" | "team" | "value" | "memo" | "brief" | "trigger";
export type AgentStepState = "done" | "running" | "queued" | "off";
export interface AgentStep {
  id: string;
  icon: AgentStepIcon;
  title: string;
  /** Short title for the flow canvas. */
  short?: string;
  /** One line, plain verbs. */
  desc: string;
  on: boolean;
  /** Shown on the step only when it needs attention. */
  issues?: { count: number; note: string };
  /** What the step produced, shown once it is done. */
  result?: string;
  /** Needs a person before anything leaves. */
  approval?: boolean;
}
export interface AgentFlowNode { stepId: string; x: number; y: number }
export interface AgentFlowEdge { from: string; to: string; label?: string }
export interface AgentData {
  id: string;
  name: string;
  company: { id: string; name: string; initial: string; dark?: boolean };
  /** Single quiet meta line under the title. */
  meta: string;
  trigger: { title: string; when: string; chip: string; where: string };
  steps: AgentStep[];
  flow: { nodes: AgentFlowNode[]; edges: AgentFlowEdge[]; w: number; h: number };
  runId: string;
  neverDoes: string[];
}
/** Run position: `active` is the running step index; `t` (0–1) is the glow dot travelling into it from the previous step. */
export interface AgentRunState { active: number; t: number }

/** v3.2 · small inline visuals inside an answer. */
export type AssistantVisual =
  | { kind: "growth"; growth: GrowthComparison }
  | { kind: "companies"; title: string; rows: { id: string; name: string; initial: string; dark?: boolean; value: string; note: string; tone?: "rust" | "warn" | "neutral"; href?: string }[] }
  | { kind: "deal"; name: string; initial: string; dark?: boolean; stage: string; facts: { k: string; v: string; tone?: "rust" | "ok" }[]; href?: string };
/** `text` may carry inline citations as [1], [2] … pointing into `sources` (1-based). */
export interface AssistantMsg { id: string; from: "user" | "agent"; text: string; sources?: SourceRef[]; visual?: AssistantVisual; /** v3.2 · thinking state: shimmer label + steps (done / current). */ thinking?: { label: string; steps?: { label: string; done?: boolean }[] } }
/** v3.3 · icon keys for suggestion chips and recent threads (mapped to glyphs in the UI). */
export type AssistantIcon = "growth" | "inbox" | "mail" | "runway" | "memo" | "people" | "valuation" | "search" | "agent" | "history" | "pass" | "calendar";
export interface AssistantSuggestion { id: string; title: string; desc: string; action: string; icon?: AssistantIcon; /** v3.3 · short chip label on the full page (falls back to title) */ short?: string }
/** v3.3 · a previous conversation, shown quietly under the full-page first run. */
export interface AssistantThread { id: string; title: string; meta: string; icon?: AssistantIcon; href?: string }
export interface AssistantData {
  title: string; context: string; messages: AssistantMsg[]; suggestions: AssistantSuggestion[]; placeholder: string;
  /** v3.2 · empty-state greeting (shown when there are no messages). */
  greeting?: { title: string; body: string };
  /** v3.2 · short follow-up questions shown under the last answer. */
  followups?: string[];
  /** v3.3 · scopes offered by the context chip in the composer (the active one is `context`). */
  scopes?: string[];
  /** v3.3 · previous threads (full page, empty state). */
  recent?: AssistantThread[];
}

export interface CalmStat { id: string; label: string; value: string; unit?: string; delta?: { label: string; tone: "ok" | "rust" | "neutral" }; foot: { label: string; href: string }; alert?: boolean }
export interface CalmActivity { id: string; company: { name: string; initial: string; dark?: boolean }; title: string; detail: string; status: { label: string; tone: "rust" | "ok" | "neutral" }; time: string; href?: string }
export interface TodayCalmData {
  greeting: string;
  dateLabel: string;
  stats: CalmStat[];
  chart: { title: string; meta: string; weeks: string[]; read: number[]; worth: number[] };
  activity: CalmActivity[];
  /** v3.2 · live agent rail in the dock (Gemini P1). Optional. */
  live?: LiveRun;
}
export interface LiveRun {
  title: string;
  href?: string;
  /** clock time the run started, shown in the rail's progress footer */
  startedAt?: string;
  steps: { id: string; label: string; state: "done" | "running" | "queued" }[];
}

/* ── v3.2 · tools, just-in-time connect, book a call ─────────────────────────── */
export type ToolId = "gmail" | "calendar" | "slack" | "drive" | "crustdata" | "dataroom"
  /* v4 · connector set (Settings > Connectors) */
  | "googlemeet" | "fireflies" | "agentmail" | "anthropic" | "openai"
  | "affinity" | "attio" | "hubspot" | "salesforce" | "dealcloud" | "carta" | "pitchbook" | "crunchbase" | "harmonic" | "docsend"
  | "notion" | "dropbox" | "outlook" | "teams" | "zoom" | "otter" | "granola" | "gong" | "linkedin" | "clay" | "airtable"
  | "excel" | "docusign" | "angellist" | "visible" | "plaid" | "quickbooks";
/** Asked for only when a task needs the tool. `why` is one line, in terms of the task at hand. */
export interface ConnectAsk {
  tool: ToolId; title: string; why: string; allowLabel: string; scope?: string;
  /** v4 · what the agent gets, listed plainly (read/write). */
  scopes?: { label: string; detail?: string }[];
  /** v4 · the step that waits if the user says "Not now", e.g. "Book Keel intro call". */
  step?: string;
}
export interface MeetSlot { id: string; day: string; time: string; note?: string }
export interface MeetPerson { name: string; email: string; role: string; initials: string; from?: string }
/** Everything pre-filled by the agent; the partner checks and sends. */
export interface BookCallData {
  company: CompanyRef & { stage: string; sector: string; ask: string };
  fit: string[];
  title: string;
  slots: MeetSlot[];
  slot: string;
  durations: number[];
  duration: number;
  meetLink: string;
  people: MeetPerson[];
  agenda: string[];
  /** Where it was opened from, shown quietly in the header */
  origin: string;
  /** Only when the partner's first choice clashes: the agent proposes better slots inline */
  conflict?: { with: string; found: string; /** the clashing first choice, e.g. "Tue 3 Nov · 3:00 pm" */ clash?: string; /** better slot ids, default all */ slots?: string[] };
  /** v4 · fit score (same band as Today's work list) and the signals behind it */
  fitScore?: number; fitSignals?: FitSignal[];
  /** v4 · round facts shown next to the fit chips, e.g. ["Seed", "$2.5M"] */
  round?: string[];
  /** v4 · placeholder hint for "Other time", e.g. "Fri 6 Nov, 2:00 pm" */
  otherHint?: string;
}
export type MeetingKind = "founder" | "ic" | "board" | "lp";
/** A row in Today's "Next meetings", and the details panel that opens on click. */
export interface MeetingItem {
  id: string; kind: MeetingKind; title: string; day: string; time: string; duration: string;
  company?: CompanyRef; founder?: MeetPerson; people: MeetPerson[];
  agenda: string[]; meetLink: string; prep?: { label: string; pages: number; ready: boolean; href?: string };
  href?: string;
}

/* ── v3.2 · Today summary (the new Today) ─────────────────────────────────────── */
export type WorkStage = "new" | "screening" | "diligence" | "ic";
export type FitBand = "strong" | "maybe" | "weak";
/** Bands are derived from the score, never stored. */
export const fitBand = (score: number): FitBand => (score >= 75 ? "strong" : score >= 55 ? "maybe" : "weak");
export type WorkAction = "claim" | "book" | "review" | "memo" | "pass";
export interface WorkRow {
  id: string; company: CompanyRef & { sector: string; /** v3.3 · one short tag for narrow lists, e.g. "Fintech" */ sectorShort?: string }; stage: WorkStage;
  fit: { score: number; why: string; /** v4 · top Crustdata signals behind the score (fit pill tooltip) */ signals?: FitSignal[] }; owner?: PersonRef;
  /** `recommended` = the agent's suggested decision; it renders as the one filled button in its row. */
  action: { kind: WorkAction; label: string; recommended?: boolean }; href?: string; when: string;
}
/** One line in Today's "Waiting on you" card; the count is derived from the work rows with that action. */
export interface WaitingItem { id: string; label: string; kind: WorkAction; due?: string; href?: string }
export interface TodaySummaryData {
  /** Top bar date line, e.g. "Saturday, 31 October". */
  date: string;
  greeting: string; sub: string;
  hero: { value: number; label: string; delta?: string };
  ask: { prompt: string; chips: { id: string; label: string; icon: "search" | "pipeline" | "insight" }[]; placeholder: string };
  /** Inbound this week: `series` per day (labels in `days`), `value` the total, `delta` the pill text vs last week. */
  metric: { label: string; sub: string; value: string; unit: string; delta: string; up: boolean; days: string[]; series: number[]; href?: string };
  waiting?: { label: string; items: WaitingItem[] };
  rows: WorkRow[];
  live?: LiveRun;
  meetings: MeetingItem[];
}

/* ───────────── v4 · Signal graph: how Crustdata data drives the fit score (deal page › Signals) ─────────────
 * Every field name is a real Crustdata API field (docs.crustdata.com, x-api-version 2025-11-01); values are fixture data.
 * The live-research animation is driven only by `timeline`, so real API calls can stream the same events later. */
export type SignalCallIcon = "identify" | "company" | "person" | "job" | "web" | "watch";
/** One returned field: `field` is the exact response path, `value` its (display) value. */
export interface SignalChip {
  id: ID;
  /** Label shown on the chip: the field path, or a short notes-style label such as "past:". */
  field: string;
  value: string;
  tone?: "up" | "down" | "flat";
  /** Full response path when `field` is a short label (shown under fit contributions). */
  path?: string;
  /** Short human label for the graph canvas, e.g. "headcount" (the real path stays in the popover and the fit list). */
  short?: string;
}
/** A `*_timeseries` field drawn as an axis-less sparkline. `field` = full path (tooltip), `label` = short path shown. */
export interface SignalSpark { id: ID; field: string; label: string; points: { date: string; v: number }[]; value: string }
export interface SignalCall {
  id: ID;
  method: "GET" | "POST";
  /** Real endpoint path, e.g. "/company/enrich". */
  path: string;
  /** Small qualifier after the path, e.g. "founders". */
  note?: string;
  icon: SignalCallIcon;
  /** Request body as sent (shown while the call runs). */
  body: string;
  /** Observed latency in ms (live: identify ≈350, enrich ≈600, person ≈680, jobs ≈590, web/search/live 4–7 s, watch ≈800). */
  ms: number;
  chips: SignalChip[];
  sparks?: SignalSpark[];
  /** Raw response excerpt shown when the node is opened. */
  raw?: string;
  /** Slot on the ellipse around the hub: tl · l · bl (left), tr · br (right, either side of the exit to the fit tile), b (below). */
  place?: "tl" | "tr" | "l" | "bl" | "b" | "br";
  /** The one chip shown on the canvas (the most decision-relevant value); the rest live in the node popover. */
  lead?: ID;
}
/** One signal's push on the fit score. `chip` points at the SignalChip it was read from. */
export interface SignalContribution {
  id: ID; label: string; call: ID; chip: ID; weight: number;
  /** Evidence line when the signal is not a single Crustdata field, e.g. "HDFC deposits Jul–Oct + Crustdata web_traffic". */
  source?: string;
}
export type SignalEvent =
  | { at: number; type: "query" }
  | { at: number; type: "fanout" }
  | { at: number; type: "call"; call: ID }
  | { at: number; type: "chip"; call: ID; chip: ID }
  | { at: number; type: "done"; call: ID }
  | { at: number; type: "stream"; who: string; text: string }
  | { at: number; type: "score"; contribution: ID }
  | { at: number; type: "decide" };
export interface SignalGraphData {
  company: CompanyRef & { domain: string };
  provider: {
    name: string; graphLabel: string; apiVersion: string; markUrl: string;
    stats: { id: ID; label: string; icon: "people" | "companies" | "api" }[];
    /** Source chips that drift into the hub during fan-out (Crustdata's own vocabulary). */
    sources: string[];
  };
  eyebrow: string;
  headline: Headline;
  /** When this research ran (enrich has no company-level updated_at), and its relative form. */
  requestedAt: string;
  requestedAgo: string;
  calls: SignalCall[];
  fit: {
    label: string;
    /** No score can be computed (e.g. no firm thesis/scoring model): the tile shows "—" and this reason, never a number. */
    unscored?: { reason: string };
    /** `value` null when unscored (no thesis model) — rendered as "—". */
    base: { label: string; value: number | null };
    /** Firm's "strong" line; absent when there is no firm thesis to take it from. */
    threshold?: { value: number; label: string };
    /** Band names by fitBand(score), the same as Today’s fit pill. */
    bands: Record<FitBand, string>;
    contributions: SignalContribution[];
    recommendation: {
      label: string; why: string;
      /** Each action shows `done` once clicked (the host handles it via onAction). */
      actions: (CardAction & { done: string; primary?: boolean })[];
    };
  };
  timeline: SignalEvent[];
  /** Times (ms) for ?graph=0..N screenshot frames. */
  frames: number[];
}
/** Deal page · optional Signals section (merged into DealData). */
export interface DealData { signals?: SignalGraphData }

/* ---------------- v3.4 · Agent flow canvas ("How this agent works") ---------------- */
export type FlowKind = "trigger" | "step" | "tool" | "decision" | "action";
export type FlowIcon = "mail" | "extract" | "enrich" | "decision" | "slack" | "reply" | "calendar" | "files" | "claims" | "bank" | "team" | "value" | "memo" | "brief" | "inbox";
export type FlowTone = "ok" | "warn" | "neutral" | "rust";
/** A field a tool pulls live (Enrich). `hint` shows on the template; `value` arrives during a run. */
export interface FlowField { id: string; label: string; hint: string; value: string }
/** Plain-language rule: text runs and editable tokens, e.g. ["Fits if sector is", { token: "fintech" }]. */
export interface FlowRule { id: string; branch: string; tone: FlowTone; parts: (string | { token: string })[] }
export interface FlowThreshold { id: string; label: string; value: number; min: number; max: number; step?: number; prefix?: string; unit?: string; hint?: string }
export interface FlowOption { id: string; label: string; hint?: string; on: boolean; locked?: boolean }
export interface FlowNodeConfig {
  about: string;
  rules?: FlowRule[];
  thresholds?: FlowThreshold[];
  reads?: string[];
  writes?: string[];
  connection?: { status: "connected" | "attention"; account: string; synced: string };
  props?: { k: string; v: string }[];
  options?: FlowOption[];
  tip?: string;
}
export interface FlowNode {
  id: string;
  kind: FlowKind;
  icon: FlowIcon;
  /** Real brand mark shown on the node (tool and action nodes). */
  tool?: ToolId;
  /** Auto-layout: x comes from the column, `y` is the node's top inside the canvas. */
  col: number;
  y: number;
  w?: number;
  title: string;
  /** One line, written to fit the node. */
  sub: string;
  chips?: string[];
  /** Fields pulled live; the node expands to list them and they tick in during a run. */
  fields?: { title: string; items: FlowField[] };
  /** Shown once the node has run. */
  result?: string;
  config: FlowNodeConfig;
}
export interface FlowEdge { id: string; from: string; to: string; label?: string; tone?: FlowTone }
/** One beat of a run: a node working or the dot travelling an edge, for `ms`. `log` feeds the live activity rail. */
export interface FlowRunEvent { at: "node" | "edge"; ref: string; ms: number; log?: string; done?: string }
export interface FlowGuardrails {
  title: string;
  sub: string;
  toggles: FlowOption[];
  limits: { id: string; label: string; hint: string; value: string; /** choices offered by the value menu */ options: string[] }[];
}
export interface AgentFlowData {
  id: string;
  name: string;
  eyebrow: string;
  meta: string;
  icon: FlowIcon;
  company?: { id: string; name: string; initial: string; dark?: boolean };
  /** Link to the same agent as a numbered step list, when it has one. */
  stepsHref?: string;
  layout: { colW: number; gaps: number[]; h: number };
  nodes: FlowNode[];
  edges: FlowEdge[];
  run: {
    id: string;
    subject: string;
    when: string;
    events: FlowRunEvent[];
    /** The deal the run worked on, pulled from the pipeline fixture (logo, fit pill, owner). */
    deal?: { id: string; company: CompanyRef; fit: number; signals?: FitSignal[]; href?: string };
    /** Where the live rail's "Open" goes. */
    href?: string;
  };
  guardrails: FlowGuardrails;
}

/* ───────────── v4 · Person / founder page (/person?id=) ─────────────
 * Header facts, a tabbed activity timeline (This week / History) with nested events and from → to changes,
 * agent actions marked "AI drafted" / "Escalated", Crustdata-sourced events, and a right panel with details,
 * deal team, AI insights and queue navigation. Tab counts are derived from the events, never stored. */
export type PersonTab = "activity" | "emails" | "meetings" | "notes" | "files";
/** Which tab an event also files under (activity shows everything). */
export type PersonEventKind = "email" | "meeting" | "note" | "file" | "stage" | "fit" | "signal" | "intro" | "call" | "claim";
export type PersonChipTone = "neutral" | "warn" | "rust" | "ink" | "ok";
export interface PersonChip { label: string; tone?: PersonChipTone }
/** A run of text; `b` = emphasised (names, companies, subjects). */
export interface RichSeg { t: string; b?: boolean }
export interface PersonEvent {
  id: ID;
  kind: PersonEventKind;
  when: string;
  /** Who did it: a teammate, the founder, or one of our agents (`agent` = its name, e.g. "Inbound agent"). */
  by: { person: PersonRef } | { agent: string };
  text: RichSeg[];
  /** "<chip> → <chip>" (stage moves, fit changes) with an optional trailing note, e.g. "because …", "in 90 days". */
  change?: { from: PersonChip; to: PersonChip; note?: string };
  /** Agent actions say what they did: drafted for a human to send, or escalated to a human. */
  agentMark?: "drafted" | "escalated";
  /** Where the data came from; `provider: "crustdata"` shows the Crustdata chip with the field path. */
  source?: SourceRef;
  /** A diligence alert raised by an agent: a titled card with its evidence and two small next steps. */
  alert?: { title: string; sources: SourceRef[]; actions: PersonAlertAction[] };
  /** Nested sub-events (e.g. a thread, a diligence run). Collapsed past `PersonData.nestedPreview`. */
  children?: PersonEvent[];
}
/** An email the agent pre-wrote; the partner checks it in the compose panel and sends. */
export interface PersonDraft { subject: string; body: string; /** e.g. "Drafted by the diligence agent" */ by?: string }
/** A diligence alert's next step: open a pre-written email, or draft a request that is held for you (toast + Undo). */
export interface PersonAlertAction { id: ID; label: string; kind: "compose" | "request"; draft?: PersonDraft; toast?: string }
export interface PersonGroup { id: ID; label: string; events: PersonEvent[] }
export interface PersonQueue { label: string; index: number; total: number; prevId?: ID; nextId?: ID }
export interface PersonData {
  id: ID;
  person: PersonRef & { email: string; phone?: string; location?: string; linkedin?: string };
  company: CompanyRef & { dealId?: ID };
  relationship: PersonChip;
  stage: PersonChip;
  /** Deal-level status (e.g. "At risk" when a claim doesn’t tie out). */
  status?: PersonChip;
  fit?: { score: number; signals?: FitSignal[] };
  /** Deal owner; shown as "You" for the signed-in user. */
  owner?: PersonRef;
  lastTouched: string;
  round?: string;
  /** The next thing on the calendar for this deal (header fact + "Next up" row on the timeline). */
  next?: { label: string; when: string; detail?: string; href?: string };
  details: { k: string; v: string }[];
  team: { role: string; person?: PersonRef; agent?: string }[];
  insights: { status: PersonChip; summary: string; points: string[]; /** what the summary rests on; provider chips show compact, field in the tooltip */ sources: SourceRef[]; updated: string };
  queue: PersonQueue;
  groups: PersonGroup[];
  /** Nested events show this many children before "View all". */
  nestedPreview: number;
  /** Prefilled invite for "Book meeting" (opens the shared book-call flow). */
  book?: BookCallData;
  /** What the header's Email button opens: the agent's current draft to this founder. */
  email: PersonDraft;
  /** Why this founder is in your queue, e.g. "IC vote today". */
  waitingFor?: string;
}

/* ───────────── v4 · Connectors (Settings > Connectors) — GET /api/firm/connectors (@assumed) ───────────── */
export type ConnectorCategoryId = "data" | "email" | "meetings" | "crm" | "docs" | "finance" | "messaging";
/** Only tier "core" may be connected or need attention; tier "available" is always offered with Connect. */
export type ConnectorTier = "core" | "available";
export type ConnectorStatus = "connected" | "attention" | "available";
/** An agent that uses a connector. `icon` reuses the flow-step glyph set; `href` opens the agent. */
export interface ConnectorAgent { id: ID; name: string; icon: FlowIcon; href: string }
/** A permission the connector was granted. Toggling one off narrows what agents may do with it. */
export interface ConnectorScope { id: ID; label: string; detail: string; access: "read" | "write"; on: boolean }
export interface ConnectorEvent { id: ID; at: string; agent: ID; text: string }
/** For API connectors (Crustdata): the endpoints our agents call and the pinned API version. */
export interface ConnectorApi { version: string; header: string; endpoints: { id: ID; method: "GET" | "POST"; path: string; label: string; calls: string }[] }
export interface Connector {
  id: ID;
  tool: ToolId;
  /** Card title when it isn't the brand name ("AI model"). */
  title?: string;
  /** Second line under the title when it isn't the category ("Claude Opus 5.5 · Anthropic"). */
  detail?: string;
  category: ConnectorCategoryId;
  tier: ConnectorTier;
  status: ConnectorStatus;
  /** One line: what OUR agents do with it. */
  does: string;
  /** Access requested, shown in the connect modal and on available cards. */
  scope: string;
  /** Agent ids (ConnectorsData.agents) or "all". */
  usedBy?: ID[] | "all";
  lastSynced?: string;
  /** "Synced" by default; e.g. "Last call" for a model. */
  lastLabel?: string;
  syncing?: boolean;
  /** Needs attention: what broke, in terms of the work it holds up. */
  issue?: string;
  /** Manage sheet. Missing scopes fall back to the single `scope` line. */
  scopes?: ConnectorScope[];
  activity?: ConnectorEvent[];
  api?: ConnectorApi;
  /** Catalogue tile for a tool Deal Desk does not integrate yet: no Connect/test/status, just what it would do. */
  catalogueOnly?: boolean;
}
export interface ConnectorUse { id: ID; label: string; detail: string; stat: string }
export interface ConnectorsData {
  categories: { id: ConnectorCategoryId; label: string }[];
  agents: ConnectorAgent[];
  items: Connector[];
  /** The wide card at the top (Crustdata). */
  /** `mark`: optional vector mark file in /logos/tools/ for the large tile (falls back to the tool logo). */
  featured?: { id: ID; headline: string; mark?: string; uses: ConnectorUse[] };
}

/* ── v4 · Agents list (/agents) and Runs (/agents?tab=runs) ─────────────────── */
export type AgentStatusId = "live" | "paused" | "attention";
/** What wakes an agent up; picks the small trigger icon. */
export type AgentTriggerKind = "email" | "stage" | "schedule" | "meeting" | "signal";
export type AgentIconId = "inbox" | "scan" | "calendar" | "memo" | "radar" | "reply";
export interface AgentListStep { id: ID; label: string; tool?: ToolId; state?: "done" | "running" | "queued" }
export interface AgentListRow {
  /** Stable id, shared with the connectors fixture's `agents[].id` ("Used by" chips). */
  id: ID;
  name: string;
  /** One line on the job, in the partner's words. */
  job: string;
  icon: AgentIconId;
  trigger: { kind: AgentTriggerKind; label: string; sub: string };
  /** Tools it touches, in the order it uses them. */
  tools: ToolId[];
  status: AgentStatusId;
  /** Needs attention: what broke and the one fix. */
  attention?: { hint: string; action: string; href: string };
  /** Live right now on this subject (pulsing dot, shimmering step). */
  running?: { subject: string; step: string };
  lastRun: { label: string; mins: number };
  /** Runs per day, oldest first; `failed` marks days with a failed run. */
  activity: { runs: number; failed?: boolean }[];
  success: number;
  runsThisWeek: number;
  owner: PersonRef;
  steps: AgentListStep[];
  /** "How this agent works" canvas, where one exists. */
  flowHref?: string;
  /** Step-by-step run view, where one exists. */
  stepsHref?: string;
}
export type AgentRunOutcome = "running" | "waiting" | "fits" | "maybe" | "pass" | "booked" | "drafted" | "flagged" | "failed";
export interface AgentRunRow { id: ID; agent: ID; subject: CompanyRef; outcome: AgentRunOutcome; detail: string; duration: string; steps: { done: number; total: number }; started: string; href?: string }
export interface AgentListStat { id: ID; label: string; value: string; unit?: string; delta: string; dir: "up" | "down"; better: "up" | "down"; foot: string; icon: "runs" | "waiting" | "time" | "success" }
export interface AgentWaitingItem { id: ID; company: CompanyRef; agent: ID; label: string; sub: string; action: string; href: string }
export interface AgentsListData {
  header: { scope: string };
  stats: AgentListStat[];
  agents: AgentListRow[];
  runs: AgentRunRow[];
  statusLabels: Record<AgentStatusId, string>;
  outcomeLabels: Record<AgentRunOutcome, string>;
  /** Runs tab filter pills: one label over one or more outcomes (empty = all). */
  runFilters: { id: ID; label: string; outcomes: AgentRunOutcome[] }[];
  search: { agents: string; runs: string };
  running?: LiveRun;
  waiting: AgentWaitingItem[];
  footnote?: string;
  /** Runs tab footnote: the window the list covers. */
  runsWindow: string;
  states: { emptyTitle: string; emptyBody: string; emptyAction: string; errorTitle: string; errorBody: string; errorAction: string };
}

/* ---------------- v4 · Deal page (round 1): header metrics, diligence alert, sections ---------------- */
/** One quiet metric in the deal header (label over value, S2_B). */
export interface DealMetric { id: ID; label: string; value: string; sub?: string; tone?: "rust" | "ok"; /** hover: how the number was computed and where it came from */ hint?: string }
export interface DealHeader {
  metrics?: DealMetric[];
  /** Same fit score + Crustdata signals as Today's work list. */
  fit?: { score: number; signals?: FitSignal[] };
  owner?: PersonRef;
}
/** A drafted email the user reviews; nothing leaves Deal Desk from the deal page. */
export interface EmailDraft { to: { name: string; email: string; initials: string }; from: string; subject: string; body: string[]; app: "Gmail" | "Outlook"; savedLabel: string }
export interface DiligenceAlert {
  id: ID;
  eyebrow: string;
  title: string;
  /** "Deck claims 40% MoM" / "HDFC deposits show 22% MoM": each with its source and a value bar. */
  lines: { id: ID; label: string; value: string; rate: number; source: SourceRef; tone: "rust" | "ink" }[];
  period: string;
  reviewed: { text: string; at: string };
  verify: { label: string; draft: EmailDraft };
  request: { label: string; done: string };
}
/** Evidence "doc" items can carry the page text around the highlighted claim, and a link into the data room. */
export interface EvidencePage { title: string; before: string[]; after: string[] }
export interface DealSectionBase { id: ID; eyebrow: string; headline: Headline; source?: SourceRef; note?: string }
export interface DealKpi { id: ID; label: string; value: string; sub: string; verified: boolean; trend?: number[]; /** hover explanation */ hint?: string }
export interface DealEvent { id: ID; at: string; label: string; detail?: string; by: "agent" | "person"; who?: string; tone?: "rust" | "ok" }
export interface TeamPerson { id: ID; name: string; initials: string; role: string; prev: string; tenure: string; check: { label: string; ok: boolean }; href?: string; founder?: boolean; /** hover on the check pill: where the profile came from */ hint?: string }
export interface CustomerRow { id: ID; company: CompanyRef; plant: string; since: string; mrr: number; share: number; status: { label: string; tone: "ok" | "warn" | "neutral" | "rust" }; source: SourceRef }
export interface MarketSize { id: ID; label: string; value: number; display: string; note: string }
export interface CompRow { id: ID; company: CompanyRef; stage: string; raised: string; multiple: string; note: string; us?: boolean }
export interface CapRow { id: ID; holder: string; kind: "founder" | "esop" | "angel" | "safe" | "new"; pre: number; post: number; note?: string; us?: boolean }
export type DealSection =
  | (DealSectionBase & { kind: "overview"; kpis: DealKpi[]; facts: { k: string; v: string }[]; thesis: { id: ID; label: string; ok: boolean }[]; timeline: DealEvent[] })
  | (DealSectionBase & { kind: "team"; stats: { id: ID; label: string; value: string; hint?: string }[]; people: TeamPerson[]; hiring: { months: string[]; series: { id: ID; label: string; values: number[] }[] } })
  | (DealSectionBase & { kind: "customers"; stats: { id: ID; label: string; value: string }[]; plants: { months: string[]; values: number[] }; rows: CustomerRow[]; unit: "K" })
  | (DealSectionBase & { kind: "market"; sizes: MarketSize[]; comps: CompRow[] })
  | (DealSectionBase & { kind: "cap"; round: { label: string; value: string }[]; rows: CapRow[] })
  /** `valuation` absent ⇒ the football field is unavailable; `unavailable` says why (shown instead of the chart). */
  | (DealSectionBase & { kind: "valuation"; valuation?: Valuation; unavailable?: string; stats: { id: ID; label: string; value: string; sub?: string; hint?: string }[] });
export interface DealData {
  /** v4 · diligence alert card at the top of the main section. */
  alert?: DiligenceAlert;
  /** v4 · every outline item except the default section (and Signals) renders from here. */
  sections?: Record<string, DealSection>;
}

/* ── v4 · Landing page (/landing) ─────────────────────────────────────────────── */
/** A heading with one italic accent word: `before` *accent* `after`. */
export interface AccentLine { before: string; accent: string; after?: string }
export interface LandingLink { id: ID; label: string; href: string }
/** A row inside a landing answer or fragment: a company (logo) or a tool mark, a title, and a fit score or a pill. */
export interface LandingRow {
  id: ID; title: string; sub: string;
  company?: CompanyRef; tool?: ToolId;
  fit?: number; fitSignals?: FitSignal[];
  pill?: { label: string; tone: "neutral" | "warn" | "rust" | "ink" | "ok" };
}
/** One hero question: its chip on the left, the answer it opens in the card, and its result chip on the right. */
export interface LandingQuestion {
  id: ID; label: string; result: string;
  /** answer text with [n] citation markers into `sources` */
  answer: string; sources: SourceRef[]; rows: LandingRow[];
}
export interface LandingSignal { id: ID; label: string; value: string; field: string; effect: "up" | "down" | "flat" }
export type LandingFeature = { id: ID; title: string; body: string; link: LandingLink } & (
  | { kind: "triage"; head: string; counts: { label: string; tone: "ok" | "neutral" }[]; rows: LandingRow[] }
  | { kind: "diligence"; company: CompanyRef; domain: string; provider: ToolId; asOf: string; calls: string; signals: LandingSignal[]; weights: { id: ID; label: string; weight: number }[]; fit: number; fitLabel: string; recommendation: string }
  | { kind: "meetings"; company: CompanyRef; meeting: string; fit: number; found: string; slots: { id: ID; label: string; sub: string }[]; slot: ID; other: string; durations: number[]; duration: number; people: { initials: string; name: string; role: string }[]; meetLink: string; prep: { label: string; sub: string }; send: string; sent: string }
  | { kind: "agent"; run: string; startedAt: string; steps: { id: ID; label: string; sub: string; tool?: ToolId; state: "done" | "running" | "queued" }[]; gate: { label: string; sub: string } }
);
export interface LandingData {
  brand: string;
  nav: LandingLink[];
  signIn: LandingLink;
  hero: { eyebrow: string; headline: [AccentLine, AccentLine]; sub: string; demo: string; access: string };
  assistant: { title: string; sub: string; expand: string; placeholder: string; questions: LandingQuestion[] };
  /** the product shown in the "Watch the demo" frame */
  demo: { title: string; src: string; caption: string };
  features: { eyebrow: string; title: AccentLine; sub: string; items: LandingFeature[] };
  closing: { title: AccentLine; sub: string; placeholder: string; cta: string; done: string };
  footer: string;
}
