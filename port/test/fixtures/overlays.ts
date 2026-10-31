import type { AgentRun, AskData, PaletteData } from "../types";

/** GET /api/runs/[id] (@assumed) — never exposes raw reasoning, only plan + evidence. */
export const agentRun: AgentRun = {
  id: "run_nexa_room", title: "NexaFlow data room review", status: "running", since: "02:10", trigger: "triggered by new files",
  stats: [{ value: "31/40", label: "files" }, { value: "5", label: "red flags" }, { value: "47", label: "citations" }],
  plan: [
    { id: "p1", state: "done", label: "Read data room", result: "40 files" },
    { id: "p2", state: "done", label: "Check deck claims", result: "12 claims · 4 off" },
    { id: "p3", state: "done", label: "Check team on Crustdata", result: "3 people" },
    { id: "p4", state: "warn", label: "Scanned PDF", result: "re-read with OCR" },
    { id: "p5", state: "running", label: "Read legal files", result: "31 / 40" },
    { id: "p6", state: "queued", label: "Update IC memo", result: "draft 4" },
    { id: "p7", state: "queued", label: "Brief partners", result: "Sat 2 PM" },
  ],
  graph: {
    root: "40 data room files",
    branches: [
      { title: "Deck vs model", source: { kind: "xlsx", label: "claims.csv" } },
      { title: "Bank statements", source: { kind: "bank", label: "svb_apr-sep.csv" } },
      { title: "People", source: { kind: "crust", label: "Crustdata" } },
    ],
    result: "5 red flags · IC memo draft 3",
  },
  didOnItsOwn: [{ id: "a1", label: "Drafted 2 founder emails" }, { id: "a2", label: "Moved to Due diligence" }],
  neverDoes: ["Send email", "Share files", "Sign"],
  primary: { id: "open_memo", label: "Open IC memo" },
};

/** GET /api/search?q= (@assumed). Results are already filtered by the caller's walls. */
export const palette: PaletteData = {
  query: "nexa",
  selectedId: "k1",
  groups: [
    { title: "Pipeline", items: [{ id: "k1", icon: "deal", label: "NexaFlow", meta: "IC Mon 2 Nov", href: "/deal" }, { id: "k2", icon: "file", label: "NexaFlow · Data room", meta: "31/40", href: "/deal/room" }] },
    { title: "Actions", items: [{ id: "k3", icon: "file", label: "Open IC memo", meta: "draft 3", href: "/memo" }, { id: "k4", icon: "ask", label: "Ask about NexaFlow" }, { id: "k5", icon: "person", label: "Warm intro to Maya Chen", meta: "via Priya" }] },
    { title: "Files", items: [{ id: "k6", icon: "file", label: "CIM.pdf", meta: "p.42 · ARR" }, { id: "k7", icon: "sheet", label: "model.xlsx", meta: "row 18" }] },
  ],
};
/** Same endpoint, query hits a walled deal: only a codename and a request path come back. */
export const paletteDenied: PaletteData = {
  query: "falcon",
  groups: [{ title: "Actions", items: [{ id: "kd1", icon: "ask", label: "Ask about “falcon”", meta: "searches what you can see" }] }],
  denied: { codename: "Project Falcon", reason: "This deal is behind a wall and you’re not on its team.", requestable: true },
};

/** POST /api/concierge/ask */
export const askAnswer: AskData = {
  question: "What changed at NexaFlow this week?",
  scope: "NexaFlow · data room, mail, Crustdata",
  answer: {
    kind: "answer",
    paragraphs: [
      { text: "Verified ARR is $14.6M, not the $18.2M in the deck. $2.1M is prepaid multi-year contracts booked as ARR and $1.0M is signed but not live.", cites: [3, 21] },
      { text: "Jordan Lee, head of engineering, left for Stripe on 9 Oct. Engineering went from 48 to 44 since.", cites: [18] },
      { text: "Our range is $117–149M pre-money with a cap of $133M. The ask is $180M.", cites: [12] },
    ],
    sources: [
      { kind: "xlsx", label: "model.xlsx · row 18", n: 3 },
      { kind: "xlsx", label: "Valuation model · Our case", n: 12 },
      { kind: "crust", label: "Crustdata · people", n: 18 },
      { kind: "pdf", label: "CIM.pdf p.42", n: 21 },
    ],
    followUps: ["Draft the IC question on engineering", "Show the ARR bridge", "Who could replace Jordan?"],
  },
};
/** Ask about a walled deal → 403 shape, rendered only to the asker. */
export const askDenied: AskData = {
  question: "What’s the valuation on Falcon?",
  scope: "All deals you can see",
  answer: { kind: "denied", denial: { codename: "Project Falcon", reason: "This deal is behind a wall and you’re not on its team.", requestable: true } },
};
