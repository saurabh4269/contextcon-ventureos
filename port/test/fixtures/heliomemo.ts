/**
 * v4 · Helio Sensors IC memo, document-first (S3_B). Lives apart from helio.ts so the deal page fixtures stay untouched;
 * every number ties to the deal page (Growth view: MRR $65K verified vs $113K deck-implied, −$48K) and to Today (IC 3:00 pm, fit 72).
 */
import type { MemoData, MemoDoc, MemoSection, MemoSourceDoc, SlackMessage } from "../../src/types";
import { helioMemo, helioFit, helioOwner, helioFounder, helioGrowth, helioValuation, helioCo } from "./helio";
import { ROUTES } from "../../src/routes";

const room = (file: string) => `${ROUTES.dataRoom(helioCo.id)}&file=${file}`;
const dealTab = (tab: string) => `${ROUTES.deal(helioCo.id)}&tab=${tab}`;
const v = helioValuation;
const pc = (r: number) => `${Math.round(r * 100)}%`;
const g = helioGrowth, n = g.verified.length;
const mrr = g.verified[n - 1], mrrJun = g.verified[0];
const deckImplied = Math.round(mrrJun * Math.pow(1 + g.claimedRate, n - 1));
const gap = deckImplied - Math.round(mrr);
const runRate = `$${((mrr * 12) / 1000).toFixed(2)}M`;
const icWhen = "Today 3:00 pm";

const sources: MemoSourceDoc[] = [
  { n: 1, kind: "pdf", label: "Helio_deck.pdf", where: "Page 4 · Traction", quote: "Growing 40% month on month since launch. 14 paying plants across steel, cement and auto parts.", highlight: "Growing 40% month on month since launch.", href: room("deck") },
  { n: 2, kind: "bank", label: "HDFC_Jun-Oct.pdf", where: "Page 3 · customer credits", quote: "Customer credits, October: ₹54.0L ($65.0K), up from ₹24.4L ($29.4K) in June.", highlight: "₹54.0L ($65.0K)", href: room("bank") },
  { n: 3, kind: "pdf", label: "invoices.pdf", where: "Oct invoices · 14 plants", quote: "14 plants invoiced in October, average $4.6K a month. Kaveri Steel, Deccan Cement and Sahyadri Auto Parts are 41% of billing.", highlight: "average $4.6K a month", href: dealTab("customers") },
  { n: 4, kind: "crust", label: "Crustdata · signals", where: "Helio Sensors › signals", quote: "Paid pilots grew from 9 to 14 plants (Jun–Oct). Implied revenue growth ~22% a month.", highlight: "~22% a month", href: dealTab("signals"), provider: "crustdata", asOf: "updated 2h ago" },
  { n: 5, kind: "crust", label: "Crustdata · people", where: "Helio Sensors › people", quote: "31 employees, up 41% in six months. Engineering +31%. No departures in the last 90 days.", highlight: "No departures in the last 90 days.", href: dealTab("team"), provider: "crustdata", asOf: "updated 2h ago" },
  { n: 6, kind: "call", label: "Fireflies · founder call", where: "15 Oct · 00:31:12", quote: "Sensor BOM is up about 9% since June. Rohan has a second supplier quoted for Q1.", highlight: "up about 9% since June", href: ROUTES.person(helioFounder.personId), provider: "fireflies" },
  { n: 7, kind: "xlsx", label: "Valuation model · Our case", where: "Sheet ‘Our case’ · row 14", quote: `Pre-money cap $${v.cap}M = 14× verified run-rate of ${runRate}. Ask $${v.ask}M = 18×.`, highlight: `$${v.cap}M = 14× verified run-rate`, href: dealTab("valuation") },
  { n: 8, kind: "xlsx", label: "Cap_table.xlsx", where: "Post-money · after the round", quote: "Northbeam Fund III $1.0M · 8.0%. Seed angels $500K · 4.0%. ESOP pool 8.8%.", highlight: "ESOP pool 8.8%", href: dealTab("cap") },
  { n: 9, kind: "web", label: "Crustdata web search · 6 reports", where: "Market sizing · comps", quote: "Industrial condition monitoring, India: $2.4B. Steel, cement and auto plants: $620M. Seed comps price at 9–15× run-rate.", highlight: "9–15× run-rate", href: dealTab("market"), provider: "crustdata" },
];

const sections: MemoSection[] = [
  {
    id: "recommendation", title: "Recommendation", state: "done",
    blocks: [
      { kind: "recommendation" },
      { kind: "p", text: `We recommend Northbeam Fund III invest **$1.0M** of Helio Sensors’ **$1.5M seed** at a pre-money of no more than **$${v.cap}M**, against the founders’ $${v.ask}M ask [7]. Angels have committed $500K of the round [8].` },
      { kind: "p", text: `Helio is growing **${pc(g.verifiedRate)} a month** on bank deposits, not the ${pc(g.claimedRate)} the deck claims [1][2]. Even at ${pc(g.verifiedRate)} it is one of the fastest-growing seed hardware companies we have seen this year, and it fits our Seed B2B thesis on every line except verified growth [4].` },
    ],
  },
  {
    id: "overview", title: "Company overview", state: "done",
    blocks: [
      { kind: "p", text: "Helio Sensors makes vibration and thermal sensors that bolt onto motors, kilns and presses, and software that predicts a failure before a line goes down. Plants pay a monthly subscription after a 60-day paid pilot [1]." },
      { kind: "facts", rows: [
        { k: "Founded", v: "2023 · Pune" },
        { k: "Founders", v: `${helioFounder.name} (CEO, 11 years on Bosch IoT platforms) and Vikram Iyer (CTO, Bosch embedded) [5]` },
        { k: "Team", v: "31 people, no departures in 90 days [5]" },
        { k: "Customers", v: "14 paying plants in steel, cement and auto parts [3]" },
        { k: "Round", v: "$1.5M seed · $500K committed by angels [8]" },
        { k: "Sourced", v: `Inbound to pitch@ on 13 Oct · fit ${helioFit.score} [4]` },
      ] },
    ],
  },
  {
    id: "diligence", title: "Diligence findings", state: "warn",
    review: { id: "rv_burn", label: "Burn in the model", detail: "The valuation model still uses the founder’s $38K monthly burn; HDFC debits show $41K [2].", action: "Use $41K in the model", done: "Model updated to $41K burn · runway 6.4 months" },
    blocks: [
      { kind: "p", text: `**Growth is real but overstated.** The deck says revenue has grown ${pc(g.claimedRate)} a month since launch [1]. HDFC customer credits show MRR rising from $${mrrJun}K in ${g.months[0]} to **$${Math.round(mrr)}K in ${g.months[n - 1]}**, about **${pc(g.verifiedRate)} a month** compounded [2]. Crustdata’s paid-pilot signal agrees [4]. At ${pc(g.claimedRate)} the deck implies **$${deckImplied}K** of ${g.months[n - 1]} MRR, **$${gap}K** more than the bank shows.` },
      { kind: "figure", figure: "growth", caption: "Monthly revenue, deck claim vs bank deposits ($K)", cites: [1, 2] },
      { kind: "list", items: [
        "**Customers check out.** 14 paying plants on invoices, $4.6K a month on average; the top three are 41% of revenue [3].",
        "**Burn is $41K a month,** $3K above the $38K the founder emailed [2].",
        "**Team matches the deck within one person:** 31 on Crustdata against 30 claimed, with engineering hiring up 31% in six months [5].",
      ] },
    ],
  },
  {
    id: "risks", title: "Key risks & mitigants", state: "warn",
    review: { id: "rv_esop", label: "ESOP below target", detail: "The pool lands at 8.8% post-money, under the 10% we ask for at seed [8].", action: "Add top-up to closing conditions", done: "Added as a closing condition", adds: { target: "conditions", text: "ESOP pool topped up to 10% post-money before close [8]." } },
    blocks: [
      { kind: "risks", rows: [
        { id: "k1", risk: `Founder presented ${pc(g.claimedRate)} growth; verified is ${pc(g.verifiedRate)} [1][2]`, level: "mid", mitigant: "Deck restated before close (condition 1); Ananya answers it at IC." },
        { id: "k2", risk: "Sensor BOM up 9% since June [6]", level: "low", agentLevel: "mid", mitigant: "Second supplier quoted for Q1 [6]; the model holds plant pricing flat." },
        { id: "k3", risk: "Top three plants are 41% of revenue [3]", level: "low", mitigant: "All three on 12-month contracts; 22 more plants in pilot talks [1]." },
        { id: "k4", risk: "ESOP pool 8.8% post-money, under our 10% [8]", level: "low", mitigant: "Top-up before close; founders keep 67% after the round [8]." },
      ] },
      { kind: "disagreement" },
    ],
  },
  {
    id: "valuation", title: "Valuation", state: "done",
    blocks: [
      { kind: "p", text: `Our range is **$${v.low}–${v.high}M pre-money** across seed comps, a revenue multiple and ownership math [7]. We cap at **$${v.cap}M**: 14× the verified ${runRate} run-rate, the top of what the firm has paid at seed for hardware plus software [7].` },
      { kind: "figure", figure: "valuation", caption: "Pre-money by method ($M)", cites: [7] },
      { kind: "p", text: `The founders’ **$${v.ask}M** ask is 18× run-rate and only works at the deck’s ${pc(g.claimedRate)}. At our cap, **$1.0M buys 8.0%** post-money [8]; comparable seeds price at 9–15× run-rate [9].` },
    ],
  },
  {
    id: "questions", title: "Expected IC questions", state: "done",
    blocks: [
      { kind: "questions", items: [
        { id: "q1", q: `Why did the deck say ${pc(g.claimedRate)}?`, answer: "Our read: it counted pilot plants as revenue. Paid plants grew from 9 to 14 over the same months [3][4]." },
        { id: "q2", q: "What does a plant pay after the pilot?", answer: "$4.6K a month on average, after a 60-day paid pilot [1][3]." },
        { id: "q3", q: "Can margins hold if sensor costs keep rising?", answer: "BOM is up 9% since June; a second supplier is quoted for Q1 [6]." },
        { id: "q4", q: "Who builds the second product line?", answer: "Vikram Iyer leads it; the thermal line for cement kilns is planned for Q2 [1][5]." },
      ] },
    ],
  },
  {
    id: "conditions", title: "Closing conditions", state: "done",
    blocks: [
      { kind: "list", ordered: true, items: [
        `Deck and data room restated to **${pc(g.verifiedRate)} a month** verified growth [2].`,
        "Two more plant pilots signed before close [3].",
        `Pre-money at or below the **$${v.cap}M** cap; we do not move to the $${v.ask}M ask [7].`,
        "Monthly burn reported from bank statements, not founder email [2].",
      ] },
    ],
  },
];

/** One count everywhere: every `[n]` in the prose. */
const citeCount = sections.flatMap((s) => s.blocks.flatMap((b) =>
  b.kind === "p" ? [b.text] : b.kind === "list" ? b.items : b.kind === "facts" ? b.rows.map((r) => r.v) : b.kind === "risks" ? b.rows.flatMap((r) => [r.risk, r.mitigant]) : b.kind === "questions" ? b.items.map((q) => q.answer) : b.kind === "figure" ? b.cites.map((c) => `[${c}]`) : [],
)).join(" ").match(/\[\d+\]/g)?.length ?? 0;

const voteMessage: SlackMessage = {
  id: "s_ic_helio", channel: "#ic", time: "3:00 PM",
  title: `IC vote: Helio Sensors · $1.5M seed at $${v.cap}M pre`,
  lines: [`Memo draft 3 · ${citeCount} citations · 0 unsupported. Recommendation: invest $1.0M, subject to 4 conditions.`, "Growth verified at 22% a month (deck said 40%). Term sheet goes out only after 3 of 3 partner votes."],
  chips: [{ label: "IC memo · draft 3", ok: true }, { label: "Valuation model", ok: true }, { label: "Deck 40% → 22%", ok: false }],
  buttons: [{ id: "yes", label: "👍 Invest", style: "primary" }, { id: "no", label: "Pass" }, { id: "q", label: "Ask a question" }],
  votes: { needed: 3, voters: [] },
  footer: "Deal Desk · IC votes · nothing leaves without the partners",
};

export const helioMemoDocData: MemoDoc = {
  eyebrow: "Investment memo · Seed",
  author: helioOwner, preparedWith: "Deal Desk", date: "Thu 29 Oct", status: "Draft 3 for IC", savedAt: "Saved 11:32",
  ic: { label: "IC vote", when: icWhen },
  fit: helioFit,
  facts: [
    { id: "round", label: "Round", value: "$1.5M", sub: "Seed" },
    { id: "raised", label: "Raised", value: "$500K", sub: "of $1.5M" },
    { id: "mrr", label: "MRR · Oct", value: `$${Math.round(mrr)}K`, sub: `deck $${deckImplied}K`, tone: "ok" },
    { id: "growth", label: "Growth", value: `${pc(g.verifiedRate)}/mo`, sub: `${pc(g.claimedRate)} claimed`, tone: "rust" },
  ],
  sections,
  sources,
  actions: [
    { id: "a1", at: "13 Oct 08:02", label: `Inbound agent scored fit ${helioFit.score}`, detail: "Seed B2B · software-led hardware", by: "agent", who: "Inbound agent" },
    { id: "a2", at: "Today 9:12", label: "Cross-checked deck claims against HDFC deposits", detail: `Growth ${pc(g.claimedRate)} → ${pc(g.verifiedRate)} a month`, by: "agent", who: "Diligence agent", tone: "rust" },
    { id: "a3", at: "Today 9:40", label: "Pulled team and hiring from Crustdata", detail: "31 people · 0 departures in 90 days", by: "agent", who: "Diligence agent" },
    { id: "a4", at: "Today 10:05", label: `Drafted memo v3 with ${sources.length} sources`, detail: `${citeCount} citations · 0 unsupported`, by: "agent", who: "Memo agent" },
    { id: "a5", at: "Today 11:20", label: `${helioOwner.name} rated hardware margin Low`, detail: "Agent rated it Medium", by: "person", who: helioOwner.initials },
    { id: "a6", at: "Today 11:32", label: `Scheduled the IC vote for ${icWhen.replace("Today ", "")}`, detail: "#ic · Saurabh, Maya, Priya", by: "agent", who: "Memo agent" },
  ],
  override: {
    label: "Analyst override", hint: "Your rating wins where you and the agent disagree", by: helioOwner, defaultOn: true,
    agent: { badge: "Deal Desk recommendation", verdict: "Invest, subject to conditions", flags: ["mid", "mid"], note: "Hardware margin risk rated Medium: sensor BOM up 9% since June [6]." },
    analyst: { badge: `Analyst override · ${helioOwner.name}`, verdict: "Invest, subject to conditions", flags: ["mid", "low"], note: "Hardware margin risk held at Low: a second supplier is quoted for Q1 [6]." },
  },
  share: { url: "desk.northbeam.vc/m/helio-seed-d3", access: "Investment team can view · IC partners can comment", people: [helioOwner, { initials: "MK", name: "Maya Kapoor", title: "Associate" }, { initials: "PS", name: "Priya Shah", title: "IC partner" }] },
  vote: { message: voteMessage, queue: "Queue for 3:00 pm IC", queued: "Queued for 3:00 pm IC · posts to #ic when voting opens", note: "Preview · nothing is sent from the demo" },
  exportName: "Helio-Sensors-IC-memo-draft-3",
};

/** GET /api/deals/helio/memo · the document-first memo. */
export const helioMemoDoc: MemoData = {
  ...helioMemo,
  meta: { draft: `Draft 3 · IC ${icWhen.toLowerCase()}`, citations: citeCount, unsupported: 0 },
  title: "Helio Sensors: $1.5M seed",
  recommendation: { ...helioMemo.recommendation, verifiedArr: { value: runRate, cite: 2 }, valuationCite: 7 },
  disagreement: { you: "Hardware margin risk: Low", agent: "Medium: sensor BOM up 9% since June", cite: 6 },
  outline: sections.map((s, i) => ({ id: s.id, label: s.title, state: s.state, selected: i === 0 })),
  doc: helioMemoDocData,
};
