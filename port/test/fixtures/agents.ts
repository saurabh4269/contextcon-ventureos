/**
 * v3.2 · Agents, calm Today and the docked assistant. Helio Sensors (seed, Pune) and Northwind Capital (Halyard sell-side buyer).
 * The run is a pure function of a frame number (agentRunAt) so Playwright/Remotion can screenshot any moment (?frame=1..n).
 */
import type { AgentData, AgentFlowData, AgentRunState, AssistantData, TodayCalmData } from "../types";
import { ROUTES } from "../routes";
import { pipelineDeals } from "./pipeline";
import { workRows, todaySummary } from "./todaysummary";

export const helioAgent: AgentData = {
  id: "ag_helio_dd",
  name: "Helio diligence",
  company: { id: "helio", name: "Helio Sensors", initial: "H", dark: true },
  meta: "Seed · Industrial IoT · runs on every data-room upload",
  trigger: { title: "Trigger", when: "When", chip: "new files", where: "land in the Helio Sensors data room" },
  steps: [
    { id: "files", icon: "files", title: "Read the data room", short: "Read files", desc: "Parse the deck, model, HDFC statements, invoices and cap table.", on: true, result: "9 files · 212 pages" },
    { id: "claims", icon: "claims", title: "Check deck claims", short: "Check claims", desc: "Test each number in the deck against invoices and bank deposits.", on: true, issues: { count: 1, note: "Deck p.4 says 40% a month; deposits show 22%" }, result: "4 claims · 1 off" },
    { id: "bank", icon: "bank", title: "Rebuild revenue from the bank", short: "Rebuild revenue", desc: "Rebuild MRR from HDFC deposits, June to October.", on: true, result: "$65K MRR · $0.78M run-rate" },
    { id: "team", icon: "team", title: "Check the team", short: "Check team", desc: "Match all 11 people on Crustdata and flag departures.", on: true, result: "11 of 11 · no departures" },
    { id: "value", icon: "value", title: "Value against seed comps", short: "Value", desc: "Range from comps, revenue multiple and ownership math.", on: true, result: "$9–12M pre · cap $11M" },
    { id: "memo", icon: "memo", title: "Draft the IC memo", short: "Draft memo", desc: "Write the Growth and Valuation sections and cite every number.", on: true, result: "Draft 3 · 47 citations" },
    { id: "brief", icon: "brief", title: "Brief the partners", short: "Brief partners", desc: "Summarise for Thursday’s partner meeting. Waits for your approval.", on: true, approval: true },
  ],
  flow: {
    w: 800, h: 556,
    nodes: [
      { stepId: "trigger", x: 16, y: 36 },
      { stepId: "files", x: 16, y: 212 },
      { stepId: "claims", x: 300, y: 36 },
      { stepId: "bank", x: 300, y: 212 },
      { stepId: "team", x: 300, y: 388 },
      { stepId: "value", x: 584, y: 124 },
      { stepId: "memo", x: 584, y: 300 },
      { stepId: "brief", x: 584, y: 448 },
    ],
    edges: [
      { from: "trigger", to: "files", label: "on upload" },
      { from: "files", to: "claims", label: "deck" },
      { from: "files", to: "bank", label: "statements" },
      { from: "files", to: "team", label: "people" },
      { from: "bank", to: "value", label: "MRR" },
      { from: "claims", to: "memo", label: "mismatch" },
      { from: "value", to: "memo", label: "range" },
      { from: "team", to: "memo" },
      { from: "memo", to: "brief", label: "for approval" },
    ],
  },
  runId: "run_7f3a91",
  neverDoes: ["Email founders", "Share files", "Sign anything"],
};

/** Frames: 1 = step 1 running. Even frames = the dot travelling into the next step (previous step just checked). */
export const AGENT_FRAMES = helioAgent.steps.length * 2 - 1;
export function agentRunAt(frame: number): AgentRunState {
  const f = Math.max(1, Math.min(AGENT_FRAMES, Math.round(frame)));
  return f % 2 === 1 ? { active: (f - 1) / 2, t: 1 } : { active: f / 2, t: 0.5 };
}
/** The default still: step 3 (bank) running, claims flagged. */
export const helioAgentRun: AgentRunState = { active: 2, t: 1 };

export const helioAssistant: AssistantData = {
  title: "Assistant",
  context: "Helio Sensors",
  placeholder: "Ask about Helio Sensors…",
  messages: [
    { id: "m1", from: "user", text: "Is Helio really growing 40% a month?" },
    { id: "m2", from: "agent", text: "No. HDFC deposits show MRR going from $29.4K in June to $65K in October, which is about 22% a month. The 40% on deck p.4 counts two pilots that haven’t paid yet.", sources: [{ kind: "bank", label: "HDFC · Jun–Oct" }, { kind: "pdf", label: "Helio_deck.pdf p.4" }] },
  ],
  suggestions: [
    { id: "s1", title: "Ask Ananya about the 40%", desc: "Add it to Thursday’s partner-meeting questions.", action: "add_q" },
    { id: "s2", title: "Re-run valuation at 22%", desc: "Update the range and the $11M cap in the memo.", action: "rerun_value" },
  ],
};

export const todayAssistant: AssistantData = {
  title: "Assistant",
  context: "All deals",
  placeholder: "Ask about your deals…",
  messages: [
    { id: "t1", from: "agent", text: "Two things need you this morning: Helio’s growth claim and Northwind’s IOI questions on Halyard. Everything else ran without you." },
  ],
  suggestions: [
    { id: "s1", title: "Review Helio’s growth gap", desc: "Deck says 40% a month; the bank shows 22%.", action: "open_helio" },
    { id: "s2", title: "Answer Northwind’s questions", desc: "Customer concentration, top 10. Draft is ready.", action: "open_northwind" },
    { id: "s3", title: "Prep Thursday’s partner meeting", desc: "Memo draft 3, valuation and open questions.", action: "prep_pm" },
  ],
};

export const todayCalm: TodayCalmData = {
  greeting: "Morning, Saurabh.",
  dateLabel: "Fri 30 Oct",
  stats: [
    { id: "pipe", label: "Active pipeline", value: "25", unit: "deals", delta: { label: "+4 this week", tone: "ok" }, foot: { label: "View pipeline", href: ROUTES.pipeline } },
    { id: "ic", label: "Helio · Thursday", value: "3", unit: "of 4 ready", delta: { label: "valuation left", tone: "neutral" }, foot: { label: "View memo", href: ROUTES.memo("helio") } },
    { id: "saved", label: "Saved this week", value: "21.5", unit: "h", delta: { label: "+3.5 h", tone: "ok" }, foot: { label: "View agent runs", href: ROUTES.agents } },
    { id: "run", label: "Lowest runway", value: "8.4", unit: "mo", delta: { label: "Corvid", tone: "rust" }, foot: { label: "View portfolio", href: ROUTES.portfolio }, alert: true },
  ],
  live: {
    title: "Helio diligence",
    href: ROUTES.agents,
    steps: [
      { id: "l1", label: "Read 14 files from the data room", state: "done" },
      { id: "l2", label: "Checked deck claims against HDFC deposits", state: "done" },
      { id: "l3", label: "Rebuilding revenue from bank deposits", state: "running" },
      { id: "l4", label: "Check the founding team", state: "queued" },
      { id: "l5", label: "Draft the IC memo", state: "queued" },
    ],
  },
  chart: { title: "Deal flow", meta: "8 weeks", weeks: ["7 Sep", "14 Sep", "21 Sep", "28 Sep", "5 Oct", "12 Oct", "19 Oct", "26 Oct"], read: [31, 38, 35, 44, 41, 52, 48, 57], worth: [4, 6, 5, 7, 6, 9, 8, 11] },
  activity: [
    { id: "a1", company: { name: "Helio Sensors", initial: "H", dark: true }, title: "Growth is 22% a month, not 40%", detail: "Checked deck p.4 against HDFC deposits", status: { label: "Needs you", tone: "rust" }, time: "08:02", href: ROUTES.deal("helio") },
    { id: "a2", company: { name: "Northwind Capital", initial: "N" }, title: "IOI answers drafted for Halyard", detail: "Customer concentration, top 10", status: { label: "Draft", tone: "neutral" }, time: "06:40", href: ROUTES.mandates },
    { id: "a3", company: { name: "NexaFlow", initial: "N", dark: true }, title: "ARR is $14.6M, not $18.2M", detail: "Prepaid contracts booked as ARR", status: { label: "Added to memo", tone: "ok" }, time: "06:12", href: ROUTES.deal("nexaflow") },
    { id: "a4", company: { name: "Corvid", initial: "C" }, title: "Runway fell below 9 months", detail: "August KPIs · 8.4 months", status: { label: "Alert", tone: "rust" }, time: "05:30", href: ROUTES.portfolio },
    { id: "a5", company: { name: "Pinecrest", initial: "P" }, title: "Moved to Passed", detail: "Founder quiet for 19 days", status: { label: "Undo", tone: "neutral" }, time: "Thu", href: ROUTES.pipeline },
  ],
};

/* ---------------- v3.4 · Agent flow canvas ---------------- */

/* The run works on Harbor AI, straight from the pipeline (Sourced, unassigned) and Today's work list (New, fit 77). */
const harborDeal = pipelineDeals.find((d) => d.id === "harbor")!;
const harborRow = workRows.find((r) => r.company.id === "harbor")!;
const HARBOR_FIT = Math.round(harborDeal.thesisFit * 100);
/** What the pitch states (deck + email), matching the Slack owner card. */
export const harborPitch = { founder: harborDeal.founders?.[0] ?? harborDeal.company.name, round: "Seed", arr: "$1.2M ARR est.", sector: harborDeal.sector ?? "" };
/** Crustdata record for Harbor AI: the one source for the Enrich node and the fit signals. */
export const crustdataRecords: Record<string, Record<string, string>> = {
  harbor: { hc: "31 · +24% 6mo", fund: "$4M seed · Sep", emp: "Flexport, Maersk", roles: "7 · 4 eng", web: "48K · +18%" },
};
const harborCrust = crustdataRecords.harbor;
/** Fund III thesis knobs; the decision chips, rules, sliders and the branch the run takes all read these. */
const THESIS = { fit: 75, maybe: 55, cheque: 2, stage: "Seed–A", sectors: ["fintech", "AI", "logistics"] };
const harborBranch = HARBOR_FIT >= THESIS.fit ? "e4" : HARBOR_FIT >= THESIS.maybe ? "e5" : "e6";
const branchNode = { e4: "claim", e5: "call", e6: "reply" }[harborBranch];
const branchLog = { e4: "Posting to #deal-flow", e5: "Finding three free slots", e6: "Drafting a kind pass" }[harborBranch];
const branchDone = { e4: "Claimed by Saurabh", e5: "Call held for Thursday", e6: "Pass drafted for you" }[harborBranch];

/** Inbound triage: pitch email → extract → Crustdata enrich → fits thesis? → claim / call / polite pass. */
export const inboundFlow: AgentFlowData = {
  id: "ag_inbound",
  name: "Inbound triage",
  eyebrow: "How this agent works",
  meta: "Reads every pitch to deals@northbeam.vc · 214 runs in October",
  icon: "inbox",
  layout: { colW: 208, gaps: [44, 44, 84], h: 560 },
  nodes: [
    {
      id: "trigger", kind: "trigger", icon: "mail", tool: "gmail", col: 0, y: 0, w: 244,
      title: "Pitch email arrives", sub: "Any new thread in deals@",
      chips: ["Has a deck", "Not a reply"],
      result: `${harborPitch.founder} · ${harborDeal.company.name}`,
      config: {
        about: "Starts a run for every new thread in the deals inbox that carries a deck or a DocSend link.",
        connection: { status: "connected", account: "deals@northbeam.vc", synced: "1 min ago" },
        reads: ["New threads in deals@", "PDF and DocSend links"],
        writes: [],
        options: [
          { id: "fwd", label: "Include forwarded pitches", hint: "Intros forwarded by partners", on: true },
          { id: "port", label: "Skip portfolio founders", hint: "They go to the portfolio inbox", on: true },
        ],
        tip: "Read only. The trigger never marks threads as read or moves them.",
      },
    },
    {
      id: "extract", kind: "step", icon: "extract", col: 0, y: 176, w: 244,
      title: "Extract deck and metrics", sub: "Round, ARR, growth and team",
      chips: ["Deck", "Metrics", "Round"],
      result: `${harborPitch.round} · ${harborPitch.arr}`,
      config: {
        about: "Reads the deck and the email body, then pulls the round and the numbers the founder states.",
        props: [{ k: "Reads", v: "Deck PDF, DocSend, email body" }, { k: "Pulls", v: "Sector, stage, round, ARR, growth" }, { k: "Cites", v: "Slide and line for every number" }],
        options: [{ id: "conf", label: "Ask a person below 80% confidence", hint: "Low-confidence numbers wait for review", on: true }],
      },
    },
    {
      id: "enrich", kind: "tool", icon: "enrich", tool: "crustdata", col: 1, y: 176, w: 272,
      title: "Enrich with Crustdata", sub: "Live company and people data",
      fields: {
        title: "Pulled live",
        items: [
          { id: "hc", label: "Headcount", hint: "count, growth", value: harborCrust.hc },
          { id: "fund", label: "Funding", hint: "last round", value: harborCrust.fund },
          { id: "emp", label: "Prior employers", hint: "founders", value: harborCrust.emp },
          { id: "roles", label: "Open roles", hint: "by function", value: harborCrust.roles },
          { id: "web", label: "Web traffic", hint: "visits, trend", value: harborCrust.web },
        ],
      },
      config: {
        about: "Looks the company up by its domain and the founders by LinkedIn, then adds live signals to the deal.",
        connection: { status: "connected", account: "Northbeam workspace", synced: "2h ago" },
        reads: ["Company by domain", "Founders by LinkedIn URL"],
        writes: ["Signals on the deal page", "Fit score inputs"],
        options: [
          { id: "hc", label: "Headcount", on: true }, { id: "fund", label: "Funding", on: true },
          { id: "emp", label: "Prior employers", hint: "Where the founders worked before", on: true }, { id: "roles", label: "Open roles", on: true }, { id: "web", label: "Web traffic", on: true },
        ],
        tip: "One credit per company. Results are cached for 7 days.",
      },
    },
    {
      id: "decide", kind: "decision", icon: "decision", col: 2, y: 176, w: 224,
      title: "Fits thesis?", sub: "Sector, stage, cheque and signals",
      chips: [THESIS.stage, `Fit ≥ ${THESIS.fit}`, `Cheque ≤ $${THESIS.cheque}M`],
      result: `${harborBranch === "e4" ? "Fits" : harborBranch === "e5" ? "Maybe" : "Pass"} · fit ${HARBOR_FIT}`,
      config: {
        about: "Scores the pitch against Fund III’s thesis and sends it down one branch.",
        rules: [
          { id: "fits", branch: "fits", tone: "ok", parts: ["Fits if sector is", { token: THESIS.sectors[0] }, ",", { token: THESIS.sectors[1] }, "or", { token: THESIS.sectors[2] }, ", stage is", { token: THESIS.stage }, "and fit is at least", { token: String(THESIS.fit) }] },
          { id: "maybe", branch: "maybe", tone: "warn", parts: ["Maybe if two of those match, or fit is", { token: `${THESIS.maybe}–${THESIS.fit - 1}` }] },
          { id: "pass", branch: "pass", tone: "neutral", parts: ["Pass if sector or stage is out, or fit is below", { token: String(THESIS.maybe) }] },
        ],
        thresholds: [
          { id: "fit", label: "Fit score for “fits”", value: THESIS.fit, min: 50, max: 95 },
          { id: "maybe", label: "Lowest “maybe”", value: THESIS.maybe, min: 30, max: 75 },
          { id: "cheque", label: "Largest first cheque", value: THESIS.cheque, min: 0.5, max: 5, step: 0.5, prefix: "$", unit: "M" },
        ],
        tip: "Rules read top to bottom. The first one that matches wins.",
      },
    },
    {
      id: "claim", kind: "action", icon: "slack", tool: "slack", col: 3, y: 0,
      title: "Claim in Slack", sub: "Posts to #deal-flow to claim",
      chips: ["#deal-flow", "Nudge after 4h"],
      result: "Claimed by Saurabh",
      config: {
        about: "Posts a card with the fit score, top signals and the deck. The first partner to claim it owns the deal.",
        connection: { status: "connected", account: "Northbeam · #deal-flow", synced: "just now" },
        reads: ["Partner list and sector leads"],
        writes: ["A claim card in #deal-flow", "Owner on the deal"],
        options: [{ id: "lead", label: "Mention the sector lead", on: true }, { id: "nudge", label: "Nudge if unclaimed after 4h", on: true }],
      },
    },
    {
      id: "call", kind: "action", icon: "calendar", tool: "calendar", col: 3, y: 176,
      title: "Book a call", sub: "A 20-min intro to fill gaps",
      chips: ["3 free slots", "Associate"],
      result: "Call held for Thursday",
      config: {
        about: "Finds three free slots on the associate’s calendar and drafts the invite with the open questions.",
        connection: { status: "connected", account: "saurabh@northbeam.vc", synced: "5 min ago" },
        reads: ["Free/busy for the deal team"],
        writes: ["A held slot and a draft invite"],
        options: [{ id: "review", label: "You send the invite", hint: "Nothing goes to the founder on its own", on: true, locked: true }],
      },
    },
    {
      id: "reply", kind: "action", icon: "reply", tool: "gmail", col: 3, y: 352,
      title: "Draft a reply", sub: "A kind pass, in your words",
      chips: ["Draft only", "Your tone"],
      result: "Pass drafted for you",
      config: {
        about: "Writes a short, specific pass that names the reason. It sits in your drafts until you send it.",
        connection: { status: "connected", account: "deals@northbeam.vc", synced: "1 min ago" },
        reads: ["Your last 50 sent replies, for tone"],
        writes: ["A draft in the thread"],
        options: [{ id: "review", label: "Never send without review", on: true, locked: true }, { id: "reason", label: "Name the reason", hint: "Sector, stage or size", on: true }],
      },
    },
  ],
  edges: [
    { id: "e1", from: "trigger", to: "extract" },
    { id: "e2", from: "extract", to: "enrich" },
    { id: "e3", from: "enrich", to: "decide" },
    { id: "e4", from: "decide", to: "claim", label: "fits", tone: "ok" },
    { id: "e5", from: "decide", to: "call", label: "maybe", tone: "warn" },
    { id: "e6", from: "decide", to: "reply", label: "pass", tone: "neutral" },
  ],
  run: {
    id: "run_c41e08",
    subject: `${harborDeal.company.name} · ${harborPitch.founder}`,
    when: harborRow.when,
    href: ROUTES.pipeline,
    deal: { id: harborDeal.id, company: harborDeal.company, fit: HARBOR_FIT, signals: harborDeal.fitSignals, href: ROUTES.pipeline },
    events: [
      { at: "node", ref: "trigger", ms: 1000, log: "Reading the pitch", done: `Pitch from ${harborPitch.founder}` },
      { at: "edge", ref: "e1", ms: 650 },
      { at: "node", ref: "extract", ms: 1600, log: "Extracting the deck", done: `${harborPitch.round} · ${harborPitch.arr}` },
      { at: "edge", ref: "e2", ms: 650 },
      { at: "node", ref: "enrich", ms: 3400, log: "Checking Crustdata", done: `${Object.keys(harborCrust).length} signals from Crustdata` },
      { at: "edge", ref: "e3", ms: 650 },
      { at: "node", ref: "decide", ms: 1500, log: "Scoring the fit", done: `Fit ${HARBOR_FIT} · thesis checked` },
      { at: "edge", ref: harborBranch, ms: 750 },
      { at: "node", ref: branchNode, ms: 1400, log: branchLog, done: branchDone },
    ],
  },
  guardrails: {
    title: "Flow settings",
    sub: "Guardrails for every run of Inbound triage. When one would be crossed, the agent stops and asks.",
    toggles: [
      { id: "approve", label: "Approvals before anything leaves", hint: "Replies, invites and Slack posts wait in your queue.", on: true },
      { id: "never", label: "Never email founders without review", hint: "Drafts only. A person presses send.", on: true, locked: true },
      { id: "conf", label: "Stop on low confidence", hint: "If a number is under 80% confidence, a person checks it.", on: true },
      { id: "dup", label: "Skip companies already in the pipeline", hint: "Adds the email to the existing deal instead.", on: false },
    ],
    limits: [
      { id: "spend", label: "Spend cap", hint: "Crustdata credits per month", value: "$40", options: ["$20", "$40", "$80", "$150"] },
      { id: "quiet", label: "Quiet hours", hint: "No messages go out", value: "20:00–08:00", options: ["None", "20:00–08:00", "19:00–09:00", "Weekends"] },
    ],
  },
};

const helioRow = workRows.find((r) => r.company.id === "helio")!;
const helioFit = helioRow.fit.score;

/** Helio diligence on the same canvas (the step list stays at /agent). */
export const helioFlow: AgentFlowData = {
  id: helioAgent.id,
  name: helioAgent.name,
  eyebrow: "How this agent works",
  meta: helioAgent.meta,
  icon: "files",
  company: helioAgent.company,
  stepsHref: "/agent?agent=helio",
  layout: { colW: 200, gaps: [112, 64, 88], h: 520 },
  nodes: [
    { id: "trigger", kind: "trigger", icon: "files", tool: "dataroom", col: 0, y: 0, w: 240, title: "New files", sub: "Any upload to the data room", chips: ["Helio Sensors"], result: "3 new files", config: { about: "Starts a run whenever the founders upload to the Helio data room.", connection: { status: "connected", account: "Helio Sensors data room", synced: "just now" }, reads: ["New uploads"], writes: [] } },
    { id: "files", kind: "step", icon: "files", col: 0, y: 170, w: 240, title: "Read files", sub: "Deck, model, bank, cap table", result: "9 files · 212 pages", config: { about: "Parses every file and indexes each page for citations.", props: [{ k: "Reads", v: "PDF, XLSX, CSV" }] } },
    { id: "claims", kind: "step", icon: "claims", col: 1, y: 0, w: 216, title: "Check claims", sub: "Deck numbers against invoices", chips: ["1 off"], result: "4 claims · 1 off", config: { about: "Tests each number in the deck against invoices and bank deposits." } },
    { id: "bank", kind: "step", icon: "bank", col: 1, y: 170, w: 216, title: "Rebuild revenue", sub: "MRR from HDFC deposits", result: "$65K MRR", config: { about: "Rebuilds MRR from HDFC deposits, June to October." } },
    { id: "team", kind: "tool", icon: "team", tool: "crustdata", col: 1, y: 340, w: 216, title: "Check the team", sub: "All 11 people on Crustdata", result: "11 of 11 · no departures", config: { about: "Matches every person on Crustdata and flags departures.", connection: { status: "connected", account: "Northbeam workspace", synced: "2h ago" }, reads: ["People by LinkedIn URL"], writes: ["Team signals on the deal"] } },
    { id: "value", kind: "step", icon: "value", col: 2, y: 85, title: "Value", sub: "Comps, multiple, ownership", result: "$9–12M pre", config: { about: "Range from seed comps, revenue multiple and ownership math." } },
    { id: "memo", kind: "step", icon: "memo", col: 2, y: 255, title: "Draft memo", sub: "Growth and valuation, cited", result: "Draft 3 · 47 citations", config: { about: "Writes the Growth and Valuation sections and cites every number." } },
    { id: "brief", kind: "action", icon: "brief", tool: "slack", col: 3, y: 255, title: "Brief partners", sub: "Waits for your approval", chips: ["Thursday PM"], config: { about: "Summarises for Thursday’s partner meeting.", options: [{ id: "ok", label: "Needs your approval", on: true, locked: true }] } },
  ],
  edges: [
    { id: "h1", from: "trigger", to: "files" },
    { id: "h2", from: "files", to: "claims", label: "deck" },
    { id: "h3", from: "files", to: "bank", label: "statements" },
    { id: "h4", from: "files", to: "team", label: "people" },
    { id: "h5", from: "bank", to: "value" },
    { id: "h6", from: "claims", to: "memo" },
    { id: "h7", from: "value", to: "memo" },
    { id: "h8", from: "memo", to: "brief", label: "for you", tone: "warn" },
  ],
  run: {
    id: helioAgent.runId,
    subject: "Helio Sensors · 3 new files",
    deal: { id: "helio", company: helioRow.company, fit: helioFit, signals: helioRow.fit.signals, href: ROUTES.deal("helio") },
    href: ROUTES.deal("helio"),
    when: todaySummary.live?.startedAt ?? "",
    events: [
      { at: "node", ref: "trigger", ms: 900, log: "Watching the data room", done: "3 new files uploaded" },
      { at: "edge", ref: "h1", ms: 600 },
      { at: "node", ref: "files", ms: 1400, log: "Reading the data room", done: "Read 9 files · 212 pages" },
      { at: "edge", ref: "h2", ms: 600 },
      { at: "node", ref: "claims", ms: 1400, log: "Checking deck claims", done: "1 claim is off" },
      { at: "edge", ref: "h3", ms: 600 },
      { at: "node", ref: "bank", ms: 1400, log: "Rebuilding revenue", done: "$65K MRR" },
      { at: "edge", ref: "h4", ms: 600 },
      { at: "node", ref: "team", ms: 1400, log: "Checking the team", done: "11 of 11, no departures" },
      { at: "edge", ref: "h5", ms: 600 },
      { at: "node", ref: "value", ms: 1400, log: "Valuing against comps", done: "$9–12M pre" },
      { at: "edge", ref: "h7", ms: 600 },
      { at: "node", ref: "memo", ms: 1600, log: "Drafting the IC memo", done: "Draft 3 · 47 citations" },
      { at: "edge", ref: "h8", ms: 600 },
      { at: "node", ref: "brief", ms: 1400, log: "Waiting for approval", done: "Brief sent to partners" },
    ],
  },
  guardrails: { ...inboundFlow.guardrails, sub: "Guardrails for every run of Helio diligence. When one would be crossed, the agent stops and asks." },
};

export const agentFlows: Record<string, AgentFlowData> = { inbound: inboundFlow, helio: helioFlow };
