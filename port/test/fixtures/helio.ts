/**
 * v3 · Helio Sensors (seed) — the film's Act 2–4 company, now first-class in the port bundle.
 * Every animated moment is a pure function of a frame number so Remotion/Playwright can screenshot it (?frame=1..n).
 */
import type { BrainData, DealData, DataRoomData, DealSection, DiligenceAlert, FitSignal, PersonRef, GrowthComparison, MemoData, PipelineBoardData, PortfolioData, PortfolioHandoff, SlackMessage, SourceRef, ThesisLine, Valuation, DealHeader, Claim, TodayData, DecisionCard, LiveRun } from "../../src/types";
import { deal, dealTeamOpen, memo } from "./deal";
import { portfolio } from "./portfolio";
import { brain, firmThesis as thesisBase } from "./brain";
import { pipelineBoard, stages } from "./pipeline";
import { todayInvest } from "./today";
import { ROUTES } from "../../src/routes";

export const helioCo = { id: "helio", name: "Helio Sensors", initial: "H", line: "Industrial IoT sensors", dark: true };

export const helioValuation: Valuation = {
  basis: "pre-money", currency: "USD", unit: "M", low: 9, high: 12, cap: 11, ask: 14,
  capRationale: "14× verified run-rate of $0.78M, the top of what the firm has paid at seed for hardware plus software. Above it we’d be paying for the deck’s 40%.",
  source: { kind: "xlsx", label: "Valuation model · Our case", n: 9 },
  axis: { min: 6, max: 16 },
  methods: [{ label: "Seed comps", low: 8, high: 13 }, { label: "Revenue multiple", low: 9, high: 12 }, { label: "Ownership math", low: 10, high: 12 }],
};
/** Fit, owner and founder: one source for Today's work list, the person page and the deal page. */
export const helioFit: { score: number; signals: FitSignal[] } = { score: 72, signals: [{ label: "eng headcount +31% 6mo", effect: "up" }, { label: "web traffic flat 3mo", effect: "down" }] };
export const helioOwner: PersonRef = { id: "u_sg", initials: "SG", name: "Saurabh Gupta", title: "Partner" };
export const helioFounder = { name: "Ananya Rao", initials: "AR", email: "ananya@heliosensors.in", personId: "ananya-rao" };
/** The round as the deal header shows it (S2_B metric row). */
const helioRound = { size: "$1.5M", raised: "$500K", lead: "Northbeam · proposed" };
export const helioHeader: DealHeader = {
  company: helioCo, stageLabel: "Diligence", subtitle: "Industrial IoT sensors · Seed · Pune", files: { reviewed: 6, total: 9 }, icLabel: "IC vote · Today 3:00 pm", flags: ["mid", "low"], valuation: helioValuation,
  fit: helioFit, owner: helioOwner,
  metrics: [
    { id: "round", label: "Round", value: helioRound.size, sub: "Seed" },
    { id: "raised", label: "Raised", value: helioRound.raised, sub: `of ${helioRound.size}` },
    { id: "lead", label: "Lead", value: helioRound.lead, sub: "us" },
    { id: "stage", label: "Stage", value: "Diligence", sub: "IC today 3:00 pm" },
    { id: "status", label: "Status", value: "At risk", sub: "growth mismatch", tone: "rust" },
  ],
};
export const helioGrowthSource: SourceRef = { kind: "crust", label: "Crustdata · signals", n: 4, excerpt: { where: "Crustdata › Helio Sensors › signals", quote: "Paid pilots grew from 9 to 14 plants (Jun–Oct). Implied revenue growth ~22% a month.", highlight: "~22% a month" } };
/** MRR in $K, from bank deposits (HDFC), Jun–Oct. Oct = $65K MRR = $0.78M run-rate. */
export const helioGrowth: GrowthComparison = {
  metric: "MRR", unit: "K", months: ["Jun", "Jul", "Aug", "Sep", "Oct"],
  verified: [29.4, 36.5, 43.4, 53.4, 65.0],
  claimedRate: 0.4, verifiedRate: 0.22,
  claimedSource: { kind: "pdf", label: "Helio_deck.pdf p.4" },
  verifiedSource: { kind: "bank", label: "Bank deposits · HDFC" },
};
const claims: Claim[] = [
  { id: "c1", label: "MoM growth", reported: { value: "40%", source: "Deck p.4" }, verified: { value: "22%", source: "HDFC" }, variance: "−18 pts", status: { label: "Doesn’t match", tone: "rust" }, source: helioGrowthSource },
  { id: "c2", label: "Paying plants", reported: { value: "14", source: "Deck p.6" }, verified: { value: "14", source: "Invoices" }, variance: "0", status: { label: "Matches", tone: "neutral" }, source: { kind: "pdf", label: "invoices.pdf" } },
  { id: "c3", label: "Monthly burn", reported: { value: "$38K", source: "Founder" }, verified: { value: "$41K", source: "Bank Oct" }, variance: "+$3K", status: { label: "Close enough", tone: "neutral" }, source: { kind: "bank", label: "HDFC · Sep–Oct" } },
  { id: "c4", label: "Headcount", reported: { value: "30", source: "Deck p.2" }, verified: { value: "31", source: "Crustdata" }, variance: "+1", status: { label: "Matches", tone: "neutral" }, source: { kind: "crust", label: "Crustdata · people" } },
];
/** GET /api/deals/helio — seed deal: no ARR bridge, growth comparison instead. */
export const helioLive: LiveRun = {
  title: "Diligence agent", href: "/agent?frame=5",
  steps: [
    { id: "l1", label: "Read 14 files from the data room", state: "done" },
    { id: "l2", label: "Checked deck claims against HDFC deposits", state: "done" },
    { id: "l3", label: "Rebuilding revenue from bank deposits", state: "running" },
    { id: "l4", label: "Check the founding team", state: "queued" },
    { id: "l5", label: "Draft the IC memo", state: "queued" },
  ],
};

const months5 = helioGrowth.months;
const deckFile = (file: string) => `${ROUTES.dataRoom(helioCo.id)}&file=${file}`;
const invoices: SourceRef = { kind: "pdf", label: "invoices.pdf" };
const crustPeople: SourceRef = { kind: "crust", label: "Crustdata · people", provider: "crustdata", asOf: "updated 2h ago" };
const mo = (s: string) => ({ id: s.toLowerCase().replace(/[^a-z]+/g, "-"), name: s, initial: s[0] });

/** The agent's alert on the Growth section (S2_B). Verify drafts an email to the founder; nothing sends from here. */
export const helioAlert: DiligenceAlert = {
  id: "al_growth",
  eyebrow: "Diligence alert",
  title: "Claimed growth mismatch",
  period: "Jul–Oct",
  lines: [
    { id: "deck", label: "Deck claims", value: `${Math.round(helioGrowth.claimedRate * 100)}% MoM`, rate: helioGrowth.claimedRate, source: { kind: "pdf", label: "Helio_deck.pdf p.4" }, tone: "rust" },
    { id: "bank", label: "HDFC deposits show", value: `${Math.round(helioGrowth.verifiedRate * 100)}% MoM`, rate: helioGrowth.verifiedRate, source: { kind: "bank", label: "HDFC · Jul–Oct" }, tone: "ink" },
  ],
  reviewed: { text: "Agent reviewed deck & bank data", at: "3h ago" },
  verify: {
    label: "Verify with founder",
    draft: {
      to: { name: helioFounder.name, email: helioFounder.email, initials: helioFounder.initials }, from: "saurabh@northbeam.vc", app: "Gmail",
      subject: "Quick check on growth before today’s IC",
      body: ["Hi Ananya,", "Before the IC at 3 pm: the deck shows 40% month on month, while HDFC deposits for Jul–Oct show about 22%. Could you walk us through the gap? Paid plants vs pilots would help most.", "Thanks,\nSaurabh"],
      savedLabel: "Draft saved to Gmail · not sent",
    },
  },
  request: { label: "Request raw data", done: "Requested · data room link sent" },
};

/** Every outline item renders real content (no placeholder sections). Numbers tie to the claims, signals and memo. */
export const helioSections: Record<string, DealSection> = {
  overview: {
    kind: "overview", id: "overview", eyebrow: "Overview",
    headline: { pre: "Fits the thesis, ", hl: "one claim to settle" },
    kpis: [
      { id: "arr", label: "Run-rate", value: "$0.78M", sub: "Oct MRR $65K", verified: true, trend: helioGrowth.verified },
      { id: "mom", label: "MoM growth", value: "22%", sub: "Deck says 40%", verified: true, trend: [1, 1.22, 1.49, 1.81, 2.21] },
      { id: "plants", label: "Paying plants", value: "14", sub: "9 in June", verified: true, trend: [9, 10, 11, 12, 14] },
      { id: "burn", label: "Monthly burn", value: "$41K", sub: "Founder said $38K", verified: true, trend: [33, 35, 36, 38, 41] },
    ],
    facts: [
      { k: "Founded", v: "2023 · Pune" }, { k: "Founders", v: "Ananya Rao, Vikram Iyer" }, { k: "Team", v: "31 people" },
      { k: "Ask", v: "$1.5M at $14M pre" }, { k: "Our cap", v: `$${helioValuation.cap}M pre` }, { k: "Sourced", v: "Inbound · 13 Oct" },
    ],
    thesis: [
      { id: "t1", label: "Seed", ok: true }, { id: "t2", label: "B2B industrial", ok: true }, { id: "t3", label: "Software-led hardware", ok: true },
      { id: "t4", label: "$1.5M ask in range", ok: true }, { id: "t5", label: "Growth verified", ok: false },
    ],
    timeline: [
      { id: "ev1", at: "13 Oct", label: "Pitch arrived at pitch@", detail: "Inbound agent scored fit 72", by: "agent", who: "Inbound agent" },
      { id: "ev2", at: "15 Oct", label: "Founder call with Ananya", detail: "45 min · Saurabh, Maya", by: "person", who: "SG" },
      { id: "ev3", at: "20 Oct", label: "Moved to Diligence", detail: "Data room opened · 9 files", by: "person", who: "SG", tone: "ok" },
      { id: "ev4", at: "Today 9:12", label: "Growth mismatch flagged", detail: "Deck 40% vs HDFC 22% a month", by: "agent", who: "Diligence agent", tone: "rust" },
      { id: "ev5", at: "Today 3:00 pm", label: "IC vote", detail: "Memo draft 3 · Saurabh, Maya, Dana", by: "person", who: "SG" },
    ],
  },
  team: {
    kind: "team", id: "team", eyebrow: "Team", source: crustPeople,
    headline: { pre: "31 people, ", hl: "no departures", post: " in 90 days" },
    stats: [{ id: "hc", label: "Headcount", value: "31" }, { id: "g", label: "6-mo growth", value: "+41%" }, { id: "open", label: "Open roles", value: "9" }, { id: "dep", label: "Departures · 90d", value: "0" }],
    people: [
      { id: "p1", name: "Ananya Rao", initials: "AR", role: "Founder & CEO", prev: "Bosch · IoT platforms lead", tenure: "11 yrs in IoT · IIT Bombay", check: { label: "Crustdata match 0.98", ok: true }, href: ROUTES.person("ananya-rao"), founder: true },
      { id: "p2", name: "Vikram Iyer", initials: "VI", role: "Co-founder & CTO", prev: "Bosch · embedded", tenure: "9 yrs", check: { label: "Verified", ok: true }, founder: true },
      { id: "p3", name: "Rohan Kulkarni", initials: "RK", role: "Head of Hardware", prev: "Ather Energy · BMS lead", tenure: "Joined Mar", check: { label: "Verified", ok: true } },
      { id: "p4", name: "Meera Nair", initials: "MN", role: "Head of Sales", prev: "Siemens · process", tenure: "Joined Jun", check: { label: "Verified", ok: true } },
      { id: "p5", name: "Sana Qureshi", initials: "SQ", role: "Field operations", prev: "JSW Steel · maintenance", tenure: "Joined Aug", check: { label: "Reference pending", ok: false } },
    ],
    hiring: { months: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"], series: [
      { id: "eng", label: "Engineering", values: [13, 14, 15, 16, 16, 17] },
      { id: "ops", label: "Field ops", values: [5, 5, 6, 7, 9, 10] },
      { id: "gtm", label: "Sales", values: [4, 4, 4, 4, 4, 4] },
    ] },
  },
  customers: {
    kind: "customers", id: "customers", eyebrow: "Customers", source: invoices, unit: "K",
    headline: { pre: "14 paying plants; ", hl: "top 3 are 41%", post: " of revenue" },
    stats: [{ id: "n", label: "Paying plants", value: "14" }, { id: "avg", label: "Avg MRR / plant", value: "$4.6K" }, { id: "conv", label: "Pilot → contract", value: "6 of 9" }],
    plants: { months: months5, values: [9, 10, 11, 12, 14] },
    rows: [
      { id: "k1", company: mo("Kaveri Steel"), plant: "Bellary hot strip mill", since: "Jan", mrr: 11.2, share: 0.17, status: { label: "Contract", tone: "ok" }, source: { kind: "pdf", label: "invoices.pdf p.3" } },
      { id: "k2", company: mo("Deccan Cement"), plant: "Kurnool kiln line 2", since: "Mar", mrr: 8.4, share: 0.13, status: { label: "Contract", tone: "ok" }, source: { kind: "pdf", label: "invoices.pdf p.5" } },
      { id: "k3", company: mo("Sahyadri Auto Parts"), plant: "Chakan press shop", since: "Apr", mrr: 7.1, share: 0.11, status: { label: "Contract", tone: "ok" }, source: { kind: "pdf", label: "invoices.pdf p.6" } },
      { id: "k4", company: mo("Narmada Paper"), plant: "Vapi pulp line", since: "Jun", mrr: 6.0, share: 0.09, status: { label: "Paid pilot", tone: "warn" }, source: { kind: "pdf", label: "invoices.pdf p.8" } },
      { id: "k5", company: mo("Konkan Chemicals"), plant: "Roha reactor bay", since: "Aug", mrr: 5.2, share: 0.08, status: { label: "Paid pilot", tone: "warn" }, source: { kind: "pdf", label: "invoices.pdf p.9" } },
      { id: "k6", company: mo("Vindhya Glass"), plant: "Rewa float line", since: "Sep", mrr: 4.8, share: 0.07, status: { label: "Paid pilot", tone: "warn" }, source: { kind: "pdf", label: "invoices.pdf p.11" } },
    ],
    note: "8 more plants · $22.3K MRR",
  },
  market: {
    kind: "market", id: "market", eyebrow: "Market", source: { kind: "web", label: "Crustdata web search · 6 reports" },
    headline: { pre: "A $620M wedge; ", hl: "comps at 9–15×", post: " run-rate" },
    sizes: [
      { id: "tam", label: "TAM", value: 2400, display: "$2.4B", note: "Industrial condition monitoring, India" },
      { id: "sam", label: "SAM", value: 620, display: "$620M", note: "Steel, cement and auto plants" },
      { id: "som", label: "SOM", value: 38, display: "$38M", note: "Reachable by 2029 at today’s sales pace" },
    ],
    comps: [
      { id: "m0", company: helioCo, stage: "Seed", raised: "$1.5M ask", multiple: "14×", note: "At our $11M cap", us: true },
      { id: "m1", company: mo("Gridline"), stage: "Series A", raised: "$8M", multiple: "9×", note: "Vibration sensors, US steel" },
      { id: "m2", company: mo("Fathom"), stage: "Seed", raised: "$2M", multiple: "12×", note: "Predictive maintenance SaaS" },
      { id: "m3", company: mo("Quarry"), stage: "Series A", raised: "$12M", multiple: "10×", note: "Mining asset monitoring" },
      { id: "m4", company: mo("Sable"), stage: "Seed", raised: "$1.8M", multiple: "15×", note: "Thermal IoT, EU cement" },
    ],
  },
  cap: {
    kind: "cap", id: "cap", eyebrow: "Cap table", source: { kind: "xlsx", label: "Cap_table.xlsx" },
    headline: { pre: "Founders keep ", hl: "67%", post: " after the round" },
    note: "ESOP lands at 8.8% post, under the 10% we ask for at seed. Top-up before close.",
    round: [{ label: "Round", value: "$1.5M seed" }, { label: "Pre-money", value: `$${helioValuation.cap}M our cap` }, { label: "Northbeam", value: "$1.0M · 8.0%" }, { label: "Angels", value: "$500K · 4.0%" }],
    rows: [
      { id: "r1", holder: "Ananya Rao", kind: "founder", pre: 46, post: 40.5 },
      { id: "r2", holder: "Vikram Iyer", kind: "founder", pre: 30, post: 26.4 },
      { id: "r3", holder: "Pre-seed angels", kind: "angel", pre: 14, post: 12.3 },
      { id: "r4", holder: "ESOP pool", kind: "esop", pre: 10, post: 8.8, note: "Below 10% target" },
      { id: "r5", holder: "Northbeam Fund III", kind: "new", pre: 0, post: 8.0, us: true },
      { id: "r6", holder: "Seed angels", kind: "new", pre: 0, post: 4.0 },
    ],
  },
  valuation: {
    kind: "valuation", id: "valuation", eyebrow: "Valuation", source: helioValuation.source,
    headline: { pre: "Worth ", hl: `$${helioValuation.low}–${helioValuation.high}M pre`, post: `, not the $${helioValuation.ask}M ask` },
    note: helioValuation.capRationale,
    valuation: helioValuation,
    stats: [
      { id: "range", label: "Our range", value: `$${helioValuation.low}–${helioValuation.high}M`, sub: "pre-money" },
      { id: "cap", label: "Our cap", value: `$${helioValuation.cap}M`, sub: "14× run-rate" },
      { id: "ask", label: "Founder ask", value: `$${helioValuation.ask}M`, sub: "18× run-rate" },
      { id: "own", label: "Our ownership", value: "8.0%", sub: "$1.0M at cap" },
    ],
  },
};

export const helioDeal: DealData = {
  live: helioLive,
  ...deal,
  header: helioHeader,
  outline: [
    { id: "overview", label: "Overview", state: "done" },
    { id: "revenue", label: "Growth", state: "warn", count: 1, selected: true },
    { id: "team", label: "Team", state: "done" },
    { id: "customers", label: "Customers", state: "done" },
    { id: "market", label: "Market", state: "done" },
    { id: "cap", label: "Cap table", state: "warn", count: 1 },
    { id: "valuation", label: "Valuation", state: "done" },
  ],
  section: {
    eyebrow: "Growth", confidence: "High",
    headline: { pre: "Growing ", hl: "22% a month", post: ", not 40%" },
    bridgeNote: "", bridge: [], claims,
    ask: { text: "Ask Ananya why the deck says 40%", action: { id: "add_q", label: "Add to IC questions" } },
    growth: helioGrowth,
  },
  alert: helioAlert,
  sections: helioSections,
  evidence: {
    agreeNote: "3 sources agree",
    items: [
      { id: "e1", kind: "doc", source: { kind: "pdf", label: "Helio_deck.pdf" }, where: "page 4", highlight: "Growing 40% month on month since launch.", href: deckFile("deck"),
        page: { title: "Traction", before: ["14 paying plants across steel, cement and auto parts.", "Average contract $4.6K a month after a 60-day pilot."], after: ["22 more plants in pilot talks.", "Next: a thermal line for cement kilns in Q2."] } },
      { id: "e3", kind: "bars", source: { kind: "bank", label: "Bank deposits" }, where: `${months5[0]}–${months5[months5.length - 1]}`, values: [1, 1.22, 1.49, 1.81, 2.21], labels: months5, caption: "Cash in grows ~22% a month", href: deckFile("bank") },
    ],
  },
  team: {
    members: [
      { id: helioOwner.id!, initials: helioOwner.initials, name: helioOwner.name, role: "lead", title: "Partner" },
      { id: "u_mk", initials: "MK", name: "Maya Kapoor", role: "team", title: "Associate" },
      { id: "u_ps", initials: "PS", name: "Priya Shah", role: "partner", title: "IC partner" },
    ],
    sourcedBy: { initials: "DD", name: "Deal Desk", via: "Inbound · Gmail", at: "13 Oct", locked: true },
    suggestion: { userId: "u_ar", initials: "AR", name: "Arjun Rao", reasons: ["Ran diligence on 2 hardware seeds"], confidence: 0.78 },
    canClaim: false, ownerRule: "ask_first",
  },
};

/* ───────── Data room · Helio (the evidence "open" links land here, at the file) ───────── */
const roomFolders = (file: string): DataRoomData["folders"] => [
  { id: "pitch", name: "Pitch", total: 1, reviewed: 1, open: file === "deck", files: [{ id: "deck", name: "Helio_deck.pdf", state: "warn", selected: file === "deck" }] },
  { id: "fin", name: "Financials", total: 3, reviewed: 3, open: file === "bank", files: [{ id: "bank", name: "HDFC_Jun-Oct.pdf", state: "done", selected: file === "bank" }, { id: "model", name: "Model.xlsx", state: "done" }, { id: "burn", name: "Burn_Oct.xlsx", state: "done" }] },
  { id: "cust", name: "Customers", total: 3, reviewed: 2 },
  { id: "team", name: "Team", total: 1, reviewed: 0 },
  { id: "cap", name: "Cap table", total: 1, reviewed: 0 },
];
export const helioRoomFiles = ["deck", "bank"] as const;
export const helioRoom = (file: string = "deck"): DataRoomData => file === "bank" ? {
  header: helioHeader, missingCount: 2, totalFiles: helioHeader.files.total, folders: roomFolders("bank"),
  preview: { folder: "Financials", file: "HDFC_Jun-Oct.pdf", page: 3, pages: 12, docType: "HDFC Bank · current account statement", clauses: ["Customer credits, October: ₹54.0L ($65.0K), up from ₹24.4L ($29.4K) in June."],
    context: [["Account 5010 0087 4421 · Helio Sensors Pvt Ltd · Pune", "Statement period 1 Jun – 31 Oct 2026 · 412 transactions"], ["Five-month rise of 2.2×: about 22% a month compounded.", "Excludes the ₹42L pre-seed transfer on 14 Jul."]] },
  facts: [
    { id: "b1", label: "Oct customer credits", value: "$65.0K", tone: "ok", impact: "Matches MRR", source: { kind: "bank", label: "p.3 · Oct" } },
    { id: "b2", label: "Growth Jun–Oct", value: "22% a month", tone: "rust", impact: "Deck says 40%", source: { kind: "bank", label: "p.3 · Jun–Oct" } },
    { id: "b3", label: "Oct burn", value: "$41K", tone: "warn", impact: "+$3K vs founder", source: { kind: "bank", label: "p.9 · debits" } },
  ],
  feeds: { pre: "Feeds the growth check: ", hl: "verified 22% a month" },
} : {
  header: helioHeader, missingCount: 2, totalFiles: helioHeader.files.total, folders: roomFolders("deck"),
  preview: { folder: "Pitch", file: "Helio_deck.pdf", page: 4, pages: 18, docType: "Pitch deck · Traction", clauses: [helioDeal.evidence.items[0].kind === "doc" ? helioDeal.evidence.items[0].highlight : ""],
    context: [["14 paying plants across steel, cement and auto parts.", "Average contract $4.6K a month after a 60-day pilot."], ["22 more plants in pilot talks.", "Next: a thermal line for cement kilns in Q2."]] },
  facts: [
    { id: "d1", label: "Claimed growth", value: "40% a month", tone: "rust", impact: "−18 pts vs bank", source: { kind: "pdf", label: "p.4 ¶1" } },
    { id: "d2", label: "Paying plants", value: "14", tone: "ok", impact: "Matches invoices", source: { kind: "pdf", label: "p.4 ¶2" } },
    { id: "d3", label: "Pilot pipeline", value: "22 plants", tone: "warn", impact: "Not yet checked", source: { kind: "pdf", label: "p.4 ¶3" } },
  ],
  feeds: { pre: "Feeds the growth check: ", hl: "deck 40% vs HDFC 22%" },
};

export const helioMemo: MemoData = {
  ...memo,
  company: helioCo,
  meta: { draft: "Draft 2 · IC Thu 19 Nov", citations: 31, unsupported: 0 },
  title: "Helio Sensors · Seed",
  recommendation: { verdict: "Invest, subject to conditions", valuation: helioValuation, valuationCite: 9, verifiedArr: { value: "$0.78M", cite: 4 }, flags: ["mid", "low"] },
  conditions: [
    { id: "k1", text: "Deck growth restated to 22% a month", cite: 4 },
    { id: "k2", text: "Two more plant pilots signed before close", cite: 11 },
    { id: "k3", text: "Pre-money: ", cite: 9, showValuation: true },
  ],
  bridge: [],
  growth: helioGrowth,
  disagreement: { you: "Hardware margin risk: Low", agent: "Medium: sensor BOM up 9% since June", cite: 14 },
  questions: ["Why did the deck say 40%?", "What does a plant pay after the pilot?", "Who builds the second product line?"],
  sources: [helioGrowthSource, { kind: "xlsx", label: "Valuation model · Our case", n: 9 }, { kind: "crust", label: "Crustdata · people", n: 11 }, { kind: "pdf", label: "Fireflies · 3 Nov 14:32", n: 14 }],
  activity: [{ id: "a1", label: "Read 9 of 9 files", at: "Mon" }, { id: "a2", label: "Checked 7 deck claims", at: "Mon" }, { id: "a3", label: "Wrote draft 2", at: "Tue" }, { id: "a4", label: "You edited Risks", at: "Wed" }],
  priors: undefined,
};

/* ───────── Today: inbound-fit card (lower priority ask) ───────── */
export const helioInboundCard: DecisionCard = {
  id: "dc_helio", kind: "inboundFit", company: helioCo, tag: { label: "Inbound · fits thesis", tone: "ok" }, time: "08:02",
  title: { pre: "New pitch fits ", hl: "Seed B2B" },
  founder: { initials: "AR", name: "Ananya Rao", title: "Founder & CEO" }, thesis: "Seed B2B", via: "Gmail · pitch@",
  chips: [{ label: "Seed", ok: true }, { label: "B2B", ok: true }, { label: "Software-led hardware", ok: true }, { label: "$1.5M ask in range", ok: true }, { label: "Deck growth unverified", ok: false }],
  fit: 0.88, ask: "Raising $1.5M at $14M pre · 14 paying plants",
  action: { id: "claim", label: "Claim it" },
  sources: [{ kind: "pdf", label: "Helio_deck.pdf" }, helioGrowthSource],
};

/* ───────── Slack ───────── */
export const slackDealflow: SlackMessage = {
  id: "s_helio", channel: "#dealflow", time: "09:12",
  title: "Helio Sensors · fits Seed B2B · suggested: Priya",
  lines: ["Industrial IoT sensors · Pune · raising $1.5M seed.", "Deck says 40% a month. Crustdata and bank deposits say 22%."],
  chips: [{ label: "Helio_deck.pdf p.4", ok: false }, { label: "Crustdata · signals", ok: true }],
  suggest: "Suggested: Priya. Led 2 industrial IoT seeds and met Ananya at Nasscom.",
  buttons: [{ id: "claim", label: "Claim it", style: "primary" }, { id: "suggest_other", label: "Suggest Arjun" }, { id: "skip", label: "Not now" }],
  footer: "Sourced by Deal Desk from inbound · owner rule: ask first",
};
/** After "Claim it": the card updates in place (buttons → context line) and an ephemeral confirmation follows. */
export const slackClaimed: SlackMessage[] = [
  { ...slackDealflow, buttons: [], resolved: { icon: "check", text: "Claimed by Priya Shah · 09:14 · lead on Helio Sensors", tone: "ok" } },
  { id: "s_helio_ok", channel: "#dealflow", time: "09:14", ephemeral: true, title: "You’re lead on Helio Sensors", lines: ["It’s in your pipeline as Initial review. Partner meeting Thu; 3 questions drafted.", "Credit for sourcing stays with Deal Desk inbound."], buttons: [{ id: "open", label: "Open deal", style: "primary" }, { id: "undo", label: "Undo claim" }], footer: "Only you can see this" },
];
const voters = [{ initials: "MK", name: "Maya Kapoor", at: "16:44" }, { initials: "SG", name: "Saurabh Gupta", at: "16:51" }, { initials: "PS", name: "Priya Shah", at: "16:58" }];
const icBase: SlackMessage = {
  id: "s_ic", channel: "#ic", time: "16:40",
  title: "IC vote: Helio Sensors · $1.5M seed at $11M pre",
  lines: ["Memo draft 2 · 31 citations · 0 unsupported.", "Term sheet goes out only after 3 of 3 partner votes."],
  chips: [{ label: "IC memo · draft 2", ok: true }, { label: "Valuation model", ok: true }],
  buttons: [{ id: "yes", label: "👍 Invest", style: "primary" }, { id: "no", label: "Pass" }, { id: "q", label: "Ask a question" }],
  footer: "Deal Desk · IC votes · nothing leaves without the partners",
};
/** Frames: 1 posted · 2–4 votes arrive one by one · 5 stage change. */
export const slackIcVoteFrame = (frame: number): SlackMessage[] => {
  const n = Math.max(0, Math.min(3, frame - 1));
  const card: SlackMessage = { ...icBase, votes: { needed: 3, voters: voters.slice(0, n) }, reactions: n ? [{ emoji: "👍", count: n, mine: n >= 2 }] : undefined };
  if (n < 3) return [card];
  const done: SlackMessage = { ...card, buttons: [], resolved: { icon: "clock", text: "3 of 3 approved · term sheet in hold queue · leaves 17:03 unless undone", tone: "ok" }, thread: { replies: 2, last: "Maya: clean memo, ship it" } };
  if (frame < 5) return [done];
  return [done, { id: "s_ic_stage", channel: "#ic", time: "17:03", title: "Helio Sensors moved to Term sheet", lines: ["Term sheet sent to Ananya Rao from Priya’s Gmail. Pipeline updated."], buttons: [{ id: "open", label: "Open Helio", style: "primary" }], resolved: { icon: "arrow", text: "IC → Term sheet · logged to the audit trail" }, footer: "Deal Desk · pipeline" }];
};
export const slackMilestone: SlackMessage = {
  id: "s_arr", channel: "#portfolio", time: "09:05",
  title: "Helio crossed $1M ARR, ahead of memo plan",
  lines: ["$1.04M run-rate in January. The IC memo planned $1M by April.", "Firm brain: growth checks via bank deposits held up. Proposing a thesis note."],
  chips: [{ label: "Bank deposits · Jan", ok: true }, { label: "IC memo · plan", ok: true }],
  metric: { label: "ARR run-rate · $K", value: "$1.04M", note: "3 months ahead of plan", series: [260, 330, 410, 520, 640, 790, 1040], plan: [260, 340, 430, 530, 650, 800, 900] },
  buttons: [{ id: "open", label: "Open Helio", style: "primary" }, { id: "brain", label: "Review in Firm brain" }],
  footer: "Deal Desk · portfolio watcher",
};

/* ───────── Pipeline → Portfolio handoff (frames 1–4) ───────── */
const filledAll = ["IC memo", "Valuation model", "Data room", "Call notes", "KPI plan"];
export const helioHandoff = (frame: number): PortfolioHandoff => {
  const phase = (["closed", "moving", "filling", "done"] as const)[Math.max(0, Math.min(3, frame - 1))];
  const landed = phase === "closed" || phase === "moving" ? 0 : phase === "filling" ? 3 : 5;
  return { dealId: "helio", phase, closedLabel: "Wire sent · 2 Dec", filled: filledAll.map((label, i) => ({ label, done: i < landed })) };
};
export const pipelineHandoff = (frame: number): PipelineBoardData => ({
  ...pipelineBoard,
  header: { ...pipelineBoard.header, scope: "My deals" },
  stages,
  deals: [
    { id: "helio", company: helioCo, stage: "ts", nextStep: "Closed · wire sent", owner: "PS", thesisFit: 0.88, intro: { strength: 4, via: "Inbound" }, lastTouch: { label: "Today" }, signal: { label: "22% MoM verified", tone: "ok" }, focus: true },
    ...pipelineBoard.deals.filter((d) => d.id !== "nexaflow" && d.stage !== "ts").map((d) => ({ ...d, focus: false })),
  ],
  handoff: helioHandoff(frame),
});

/* ───────── Portfolio: Helio just onboarded ───────── */
export const portfolioWithHelio: PortfolioData = {
  ...portfolio,
  companyCount: 15,
  view: "All companies",
  companies: [
    { id: "helio", company: { id: "helio", name: "Helio Sensors", initial: "H" }, arr: "$0.78M", arrTrend: [0.35, 0.43, 0.53, 0.64, 0.78], burn: "$41K", runwayMonths: 30, lastUpdate: { label: "Dec" }, alert: { label: "New", tone: "ok" }, selected: true },
    ...portfolio.companies.map((c) => ({ ...c, selected: false })),
  ],
  panel: {
    company: { id: "helio", name: "Helio Sensors", initial: "H" },
    alert: { label: "On plan", tone: "ok" },
    runwayMonths: 30,
    // Post-close: $1.5M in → runway jumps; only 2 real months so far, then projection. No fake history.
    history: [{ month: "Oct", months: 6.4 }, { month: "Nov", months: 5.6 }, { month: "Dec", months: 30 }],
    projection: 29,
    facts: [
      { label: "Cash", value: "$1.62M", source: { kind: "bank", label: "HDFC · 2 Dec" } },
      { label: "Burn", value: "$54K / mo", source: { kind: "xlsx", label: "Model · after 3 hires" } },
      { label: "Plan", value: "$1M ARR by Apr", source: { kind: "pdf", label: "IC memo · plan" } },
    ],
    pattern: "Filled in from the deal. Seed hardware companies in this fund hit plan 3 of 4 times when burn stayed under $60K.",
    action: { id: "kpis", label: "Set monthly KPI request" },
    onboarded: { label: "Filled from the deal", from: filledAll, at: "2 Dec" },
  },
};

/* ───────── Firm brain: learned from this outcome (frames 1–3) ───────── */
const helioProposal = { id: "tp_helio", field: "Seed checks", from: "Deck metrics + founder call", to: "Deck metrics + founder call + growth verified from bank deposits", why: "Helio’s deck said 40%; deposits said 22%. The 22% plan was the one that held: $1M ARR in January.", evidence: "Helio · 3 months", proposedBy: "Deal Desk · from outcomes" };
export const brainLearnedFrame = (frame: number): BrainData => {
  const f = Math.max(1, Math.min(3, frame));
  const thesis = thesisBase.map((t) => t.id !== "t3" ? t : f === 1 ? t : f === 2
    ? { ...t, text: helioProposal.to, before: helioProposal.from, state: "updating" as const, learnedFrom: "Learned from Helio · Jan" }
    : { ...t, text: helioProposal.to, state: "learned" as const, learnedFrom: "Learned from Helio · Jan" });
  return {
    ...brain,
    // v3.1: one count everywhere — header, nav "All memories", trend end and Patterns (+1 learned pattern).
    total: 1285, weekDelta: 9,
    trend: [...brain.trend.slice(0, -1), 1285],
    kinds: brain.kinds.map((k) => (k.id === "all" ? { ...k, count: "1,285" } : k.id === "pattern" ? { ...k, count: String(Number(k.count) + 1) } : k)),
    learnedOvernight: { id: "l_helio", text: "Bank deposits beat deck growth at seed" },
    proposals: f === 1 ? [helioProposal, brain.proposals[0]] : [brain.proposals[0]],
    thesis,
  };
};
export const todayWithInbound: TodayData = { ...todayInvest, needYou: todayInvest.needYou + 1, decisions: [helioInboundCard, ...todayInvest.decisions] };
