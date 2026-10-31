import type { AgentListRow, AgentRunRow, AgentsListData, CompanyRef } from "../types";
import { ROUTES } from "../routes";
import { helioLive } from "./helio";

const co = (id: string, name: string, line: string, dark?: boolean): CompanyRef => ({ id, name, initial: name[0], line, ...(dark ? { dark } : {}) });
const MAYA = { id: "maya", initials: "MK", name: "Maya Kapoor" }, SAURABH = { id: "saurabh", initials: "SG", name: "Saurabh Gupta" }, ARJUN = { id: "arjun", initials: "AR", name: "Arjun Rao" };
/** 14 days of runs per day, oldest first; `f` = indices of days with a failed run. */
const days = (runs: number[], f: number[] = []) => runs.map((r, i) => (f.includes(i) ? { runs: r, failed: true } : { runs: r }));

/**
 * GET /api/agents (@assumed). Ids are shared with fixtures/connectors.ts `agents[].id`, so "Used by" chips resolve to
 * ROUTES.agentInList(id) (or the flow canvas where one exists).
 */
export const agentRows: AgentListRow[] = [
  {
    id: "triage", name: "Inbound triage", job: "Reads and scores every pitch", icon: "inbox",
    trigger: { kind: "email", label: "New pitch email", sub: "deals@northbeam.vc" },
    tools: ["gmail", "crustdata", "anthropic", "slack"], status: "live",
    lastRun: { label: "2m ago", mins: 2 }, activity: days([9, 12, 8, 3, 2, 11, 14, 10, 13, 9, 4, 3, 12, 15]), success: 0.98, runsThisWeek: 86, owner: MAYA,
    steps: [
      { id: "t1", label: "Read the pitch email", tool: "gmail" }, { id: "t2", label: "Pull deck facts", tool: "anthropic" },
      { id: "t3", label: "Enrich company and founders", tool: "crustdata" }, { id: "t4", label: "Score against the thesis", tool: "anthropic" },
      { id: "t5", label: "Post to #deals", tool: "slack" }, { id: "t6", label: "Draft the reply", tool: "gmail" },
    ],
    flowHref: ROUTES.agentFlow("inbound"),
  },
  {
    id: "diligence", name: "Diligence", job: "Verifies deck claims on real data", icon: "scan",
    trigger: { kind: "stage", label: "Stage → Diligence", sub: "Any deal you lead" },
    tools: ["dataroom", "crustdata", "anthropic", "agentmail"], status: "live", running: { subject: "Helio Sensors", step: "Rebuilding revenue" },
    lastRun: { label: "Running", mins: 0 }, activity: days([1, 2, 1, 0, 0, 2, 3, 2, 1, 2, 0, 0, 3, 2]), success: 0.95, runsThisWeek: 14, owner: SAURABH,
    steps: [
      { id: "d1", label: "Read the data room", tool: "dataroom", state: "done" }, { id: "d2", label: "Check deck claims", tool: "anthropic", state: "done" },
      { id: "d3", label: "Rebuild revenue from deposits", tool: "anthropic", state: "running" }, { id: "d4", label: "Match the team", tool: "crustdata", state: "queued" },
      { id: "d5", label: "Ask the founder for gaps", tool: "agentmail", state: "queued" },
    ],
    flowHref: ROUTES.agentFlow("helio"), stepsHref: ROUTES.agent("helio"),
  },
  {
    id: "prep", name: "Meeting booker", job: "Books calls, files the notes", icon: "calendar",
    trigger: { kind: "stage", label: "Deal claimed", sub: "Fit 75+ in Slack" },
    tools: ["calendar", "gmail", "googlemeet", "fireflies"], status: "attention",
    attention: { hint: "Fireflies disconnected 2 days ago", action: "Reconnect", href: ROUTES.connectors },
    lastRun: { label: "1h ago", mins: 60 }, activity: days([3, 4, 2, 0, 0, 5, 4, 3, 4, 2, 0, 0, 3, 2], [12, 13]), success: 0.88, runsThisWeek: 21, owner: MAYA,
    steps: [
      { id: "p1", label: "Find three free slots", tool: "calendar" }, { id: "p2", label: "Send the invite", tool: "gmail" },
      { id: "p3", label: "Add the Meet link", tool: "googlemeet" }, { id: "p4", label: "File the call notes", tool: "fireflies" },
    ],
  },
  {
    id: "memo", name: "IC prep", job: "Drafts the IC memo and pre-read", icon: "memo",
    trigger: { kind: "meeting", label: "Meeting booked", sub: "IC on the calendar" },
    tools: ["calendar", "drive", "crustdata", "anthropic", "slack"], status: "live",
    lastRun: { label: "3h ago", mins: 180 }, activity: days([0, 1, 1, 0, 0, 0, 1, 1, 0, 2, 0, 0, 1, 1]), success: 1, runsThisWeek: 4, owner: SAURABH,
    steps: [
      { id: "m1", label: "Gather the deal file", tool: "drive" }, { id: "m2", label: "Refresh Crustdata signals", tool: "crustdata" },
      { id: "m3", label: "Draft the memo", tool: "anthropic" }, { id: "m4", label: "Ask #ic for sign-off", tool: "slack" },
    ],
  },
  {
    id: "watch", name: "Portfolio monitor", job: "Watches portfolio runway", icon: "radar",
    trigger: { kind: "schedule", label: "Every Monday 8:00", sub: "Plus Crustdata alerts" },
    tools: ["crustdata", "slack"], status: "live",
    lastRun: { label: "Today 8:00", mins: 300 }, activity: days([2, 1, 1, 1, 1, 6, 1, 2, 1, 1, 1, 1, 6, 2]), success: 1, runsThisWeek: 12, owner: ARJUN,
    steps: [
      { id: "w1", label: "Pull signals for 15 companies", tool: "crustdata" }, { id: "w2", label: "Flag drops past threshold" },
      { id: "w3", label: "Send the brief to #partners", tool: "slack" },
    ],
  },
  {
    id: "outreach", name: "Founder follow-up", job: "Drafts passes and nudges", icon: "reply",
    trigger: { kind: "signal", label: "No reply in 5 days", sub: "Open founder threads" },
    tools: ["gmail", "agentmail", "anthropic"], status: "paused",
    lastRun: { label: "3d ago", mins: 4320 }, activity: days([4, 3, 5, 1, 0, 4, 3, 2, 3, 0, 0, 0, 0, 0]), success: 0.97, runsThisWeek: 0, owner: ARJUN,
    steps: [
      { id: "o1", label: "Find quiet threads", tool: "gmail" }, { id: "o2", label: "Draft the nudge or pass", tool: "anthropic" },
      { id: "o3", label: "Hold for your sign-off" }, { id: "o4", label: "Send from the agent inbox", tool: "agentmail" },
    ],
  },
];

/** GET /api/agents/runs?since=24h (@assumed). */
export const agentRunRows: AgentRunRow[] = [
  { id: "r1", agent: "diligence", subject: co("helio", "Helio Sensors", "Industrial IoT"), outcome: "running", detail: "Rebuilding revenue from deposits", duration: "14m", steps: { done: 2, total: 5 }, started: "9:12", href: ROUTES.agent("helio") },
  { id: "r2", agent: "triage", subject: co("keel", "Keel", "Startup treasury"), outcome: "fits", detail: "Fit 81 · posted to #deals", duration: "1m 12s", steps: { done: 6, total: 6 }, started: "2m ago", href: ROUTES.deal("keel") },
  { id: "r3", agent: "triage", subject: co("harbor", "Harbor AI", "Port logistics"), outcome: "waiting", detail: "Fit 77 · claim or pass", duration: "58s", steps: { done: 5, total: 6 }, started: "26m ago", href: ROUTES.deal("harbor") },
  { id: "r4", agent: "memo", subject: co("keel", "Keel", "Startup treasury"), outcome: "waiting", detail: "IC memo ready for sign-off", duration: "6m 40s", steps: { done: 4, total: 4 }, started: "3h ago", href: ROUTES.memo("keel") },
  { id: "r5", agent: "triage", subject: co("tallow", "Tallow", "Payroll for SMBs"), outcome: "pass", detail: "Fit 31 · outside thesis", duration: "1m 04s", steps: { done: 6, total: 6 }, started: "41m ago", href: ROUTES.deal("tallow") },
  { id: "r6", agent: "prep", subject: co("orbital", "Orbital", "Fleet insurance"), outcome: "booked", detail: "Call Tue 3 Nov, 3:00 pm", duration: "2m 18s", steps: { done: 3, total: 4 }, started: "1h ago", href: ROUTES.deal("orbital") },
  { id: "r7", agent: "watch", subject: co("corvid", "Corvid", "Portfolio · Fund III"), outcome: "flagged", detail: "Headcount down 9% in 30 days", duration: "3m 02s", steps: { done: 3, total: 3 }, started: "Today 8:00", href: ROUTES.portfolio },
  { id: "r8", agent: "triage", subject: co("relay", "Relay", "Treasury APIs"), outcome: "maybe", detail: "Fit 72 · strong team, early revenue", duration: "1m 21s", steps: { done: 6, total: 6 }, started: "2h ago", href: ROUTES.deal("relay") },
  { id: "r9", agent: "diligence", subject: co("ledgerly", "Ledgerly", "AP automation"), outcome: "fits", detail: "11 of 11 claims verified", duration: "22m", steps: { done: 5, total: 5 }, started: "Yesterday", href: ROUTES.deal("ledgerly") },
  { id: "r10", agent: "prep", subject: co("vantage", "Vantage", "Trial data"), outcome: "failed", detail: "Notes not filed · Fireflies offline", duration: "48s", steps: { done: 3, total: 4 }, started: "Yesterday", href: ROUTES.connectors },
  { id: "r11", agent: "outreach", subject: co("pinecrest", "Pinecrest", "Clinic payroll"), outcome: "drafted", detail: "Nudge drafted · quiet 19 days", duration: "36s", steps: { done: 3, total: 4 }, started: "3d ago", href: ROUTES.deal("pinecrest") },
  { id: "r12", agent: "triage", subject: co("fathom", "Fathom", "Ocean data"), outcome: "maybe", detail: "Fit 63 · thin traction", duration: "1m 08s", steps: { done: 6, total: 6 }, started: "Yesterday", href: ROUTES.deal("fathom") },
  { id: "r13", agent: "triage", subject: co("sable", "Sable", "Consumer fintech"), outcome: "pass", detail: "Fit 28 · consumer, out of mandate", duration: "52s", steps: { done: 6, total: 6 }, started: "Yesterday", href: ROUTES.deal("sable") },
  { id: "r14", agent: "prep", subject: co("tidepool", "Tidepool", "Water analytics"), outcome: "booked", detail: "Call Mon 2 Nov, 11:00 am", duration: "1m 55s", steps: { done: 3, total: 4 }, started: "Yesterday", href: ROUTES.deal("tidepool") },
];

export const agentsList: AgentsListData = {
  header: { scope: "Northbeam · Fund III" },
  stats: [
    { id: "runs", label: "Runs this week", value: "214", delta: "18%", dir: "up", better: "up", foot: "From last 7 days", icon: "runs" },
    { id: "waiting", label: "Waiting on you", value: "3", unit: "decisions", delta: "2", dir: "down", better: "down", foot: "Oldest 3h ago", icon: "waiting" },
    { id: "time", label: "Analyst time saved", value: "31.5", unit: "hrs", delta: "4.2 h", dir: "up", better: "up", foot: "From last 7 days", icon: "time" },
    { id: "success", label: "Success rate", value: "97.2", unit: "%", delta: "0.8 pt", dir: "up", better: "up", foot: "Runs that finished clean", icon: "success" },
  ],
  agents: agentRows,
  runs: agentRunRows,
  statusLabels: { live: "Live", paused: "Paused", attention: "Needs attention" },
  outcomeLabels: { running: "Running", waiting: "Waiting on you", fits: "Fits", maybe: "Maybe", pass: "Pass", booked: "Booked", drafted: "Drafted", flagged: "Flagged", failed: "Failed" },
  runFilters: [
    { id: "all", label: "All", outcomes: [] },
    { id: "waiting", label: "Waiting on you", outcomes: ["waiting"] },
    { id: "fits", label: "Fits", outcomes: ["fits"] },
    { id: "maybe", label: "Maybe", outcomes: ["maybe"] },
    { id: "pass", label: "Pass", outcomes: ["pass"] },
    { id: "booked", label: "Booked", outcomes: ["booked"] },
    { id: "issues", label: "Issues", outcomes: ["failed", "flagged"] },
  ],
  search: { agents: "Search agents, triggers, tools…", runs: "Search companies, agents…" },
  running: { ...helioLive, title: "Diligence · Helio Sensors", href: ROUTES.agent("helio"), startedAt: "9:12" },
  waiting: [
    { id: "w1", company: co("keel", "Keel", "Startup treasury"), agent: "memo", label: "IC memo ready for sign-off", sub: "IC prep · 3h ago", action: "Sign off", href: ROUTES.memo("keel") },
    { id: "w2", company: co("harbor", "Harbor AI", "Port logistics"), agent: "triage", label: "Fit 77 · claim or pass", sub: "Inbound triage · 26m ago", action: "Claim", href: ROUTES.deal("harbor") },
    { id: "w3", company: co("vantage", "Vantage", "Trial data"), agent: "prep", label: "Call notes need Fireflies", sub: "Meeting booker · yesterday", action: "Reconnect", href: ROUTES.connectors },
  ],
  footnote: "412 companies enriched this week",
  runsWindow: "the last 24 hours",
  states: {
    emptyTitle: "No agents yet", emptyBody: "Start with Inbound triage: it reads every pitch, enriches it with Crustdata and scores it against your thesis.", emptyAction: "New agent",
    errorTitle: "Couldn’t load your agents", errorBody: "Your agents are still running. We just can’t show them right now.", errorAction: "Try again",
  },
};
