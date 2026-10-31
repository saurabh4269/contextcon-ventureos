import type { DataRoomData, DealData, DealTeam, MemoData, RestrictedDeal, SourceRef } from "../../src/types";
import { nexaHeader, nexaValuation } from "./valuation";

export const arrExcerptSource: SourceRef = {
  kind: "xlsx", label: "model.xlsx · row 18", n: 3,
  excerpt: { where: "model.xlsx › ARR › row 18", quote: "3-year prepaid contracts booked as 3× ARR in Q3. Adjusted ARR: $14.6M.", highlight: "Adjusted ARR: $14.6M" },
};
const bridge: DealData["section"]["bridge"] = [
  { label: "Oct update", value: 19.1, kind: "ghost" },
  { label: "Deck", value: 18.2, kind: "start" },
  { label: "Prepaid", value: 2.1, kind: "down" },
  { label: "Not live", value: 1.0, kind: "down" },
  { label: "Churned", value: 0.5, kind: "down" },
  { label: "Verified", value: 14.6, kind: "end" },
];

/** GET /api/deals/[id]/team (@assumed) + GET …/owner-suggestion */
export const dealTeam: DealTeam = {
  members: [
    { id: "u_sg", initials: "SG", name: "Saurabh Gupta", role: "lead", title: "Partner" },
    { id: "u_ar", initials: "AR", name: "Arjun Rao", role: "team", title: "Associate" },
    { id: "u_mk", initials: "MK", name: "Maya Kapoor", role: "partner", title: "IC partner" },
  ],
  sourcedBy: { initials: "PS", name: "Priya Shah", via: "Intro from Brex network", at: "14 Aug", locked: true },
  suggestion: null,
  canClaim: false,
  ownerRule: "ask_first",
};
/** No lead yet → Claim (POST /api/deals/[id]/claim) + suggestion. */
export const dealTeamOpen: DealTeam = {
  members: [{ id: "u_ar", initials: "AR", name: "Arjun Rao", role: "team", title: "Associate" }],
  sourcedBy: { initials: "PS", name: "Priya Shah", via: "Intro from Brex network", at: "14 Aug", locked: true },
  suggestion: { userId: "u_sg", initials: "SG", name: "Saurabh Gupta", reasons: ["Led 3 finance-ops deals", "Knows the CFO from Brex"], confidence: 0.82 },
  canClaim: true,
  ownerRule: "ask_first",
};

/** GET /api/deals/[id] */
export const deal: DealData = {
  header: nexaHeader,
  outline: [
    { id: "overview", label: "Overview", state: "done" },
    { id: "revenue", label: "Revenue", state: "warn", count: 2, selected: true },
    { id: "team", label: "Team", state: "warn", count: 1 },
    { id: "customers", label: "Customers", state: "done" },
    { id: "contracts", label: "Contracts", state: "warn", count: 1 },
    { id: "legal", label: "Legal", state: "running" },
    { id: "cap", label: "Cap table", state: "warn", count: 1 },
    { id: "valuation", label: "Valuation", state: "done" },
    { id: "icq", label: "IC questions", state: "queued", count: 4 },
  ],
  section: {
    eyebrow: "Revenue",
    confidence: "High",
    headline: { pre: "Verified ARR is ", hl: "$14.6M", post: ", not $18.2M" },
    bridgeNote: "Oct update said $19.1M",
    bridge,
    claims: [
      { id: "c1", label: "ARR", reported: { value: "$18.2M", source: "Deck p.9" }, verified: { value: "$14.6M", source: "model r.18" }, variance: "−$3.6M", status: { label: "Doesn’t match", tone: "rust" }, source: arrExcerptSource },
      { id: "c2", label: "Gross margin", reported: { value: "78%", source: "Deck p.11" }, verified: { value: "76.4%", source: "P&L p.2" }, variance: "−1.6 pts", status: { label: "Close enough", tone: "neutral" }, source: { kind: "pdf", label: "P&L FY25 p.2" } },
      { id: "c3", label: "Net retention", reported: { value: "131%", source: "Deck p.11" }, verified: { value: "128%", source: "cohorts.xlsx" }, variance: "−3 pts", status: { label: "Close enough", tone: "neutral" }, source: { kind: "xlsx", label: "cohorts.xlsx" } },
      { id: "c4", label: "Monthly burn", reported: { value: "$420K", source: "Deck p.14" }, verified: { value: "$478K", source: "SVB Sep" }, variance: "+$58K", status: { label: "Higher than stated", tone: "warn" }, source: { kind: "bank", label: "SVB · Aug–Sep" } },
      { id: "c5", label: "Customers", reported: { value: "230", source: "Deck p.6" }, verified: { value: "212", source: "billing.csv" }, variance: "−18", status: { label: "Doesn’t match", tone: "rust" }, source: { kind: "pdf", label: "CIM p.12" } },
    ],
    ask: { text: "Ask Maya to bridge $18.2M → $14.6M", action: { id: "add_ic_question", label: "Add to IC questions" } },
  },
  evidence: {
    agreeNote: "3 sources agree",
    items: [
      { id: "e1", kind: "doc", source: { kind: "pdf", label: "CIM.pdf" }, where: "page 42", highlight: "ARR of $18.2M includes multi-year prepaid contracts." },
      { id: "e2", kind: "sheet", source: { kind: "xlsx", label: "model.xlsx" }, where: "ARR tab", rows: [{ row: "16", label: "Booked ARR", value: "18.2" }, { row: "17", label: "Prepaid adj.", value: "(2.1)" }, { row: "18", label: "Adjusted ARR", value: "14.6", highlight: true }] },
      { id: "e3", kind: "bars", source: { kind: "bank", label: "SVB statements" }, where: "Apr–Sep", values: [1.02, 1.08, 1.1, 1.15, 1.19, 1.22], caption: "Cash in matches $14.6M run-rate" },
    ],
  },
  team: dealTeam,
};
export const dealTeamOpenVariant: DealData = { ...deal, team: dealTeamOpen };

/** GET /api/deals/[id] → 403 */
export const restrictedDeal: RestrictedDeal = {
  restricted: true,
  codename: "Project Falcon",
  reason: "The deal lead put this deal behind a Chinese wall.",
  stageLabel: "Due diligence",
  requested: false,
  approverRole: "the deal lead",
};

/** GET /api/deals/[id]/room (@assumed) */
export const dataRoom: DataRoomData = {
  header: nexaHeader,
  missingCount: 9,
  totalFiles: 40,
  folders: [
    { id: "fin", name: "Financials", total: 9, reviewed: 9 },
    { id: "cust", name: "Customers", total: 7, reviewed: 6 },
    { id: "con", name: "Contracts", total: 8, reviewed: 7, open: true, files: [
      { id: "f1", name: "MSA_Acme.pdf", state: "done" },
      { id: "f2", name: "Order_form_Brightline.pdf", state: "warn", selected: true },
      { id: "f3", name: "Prepaid_terms.pdf", state: "warn" },
      { id: "f4", name: "Reseller_EU.pdf", state: "running" },
    ] },
    { id: "legal", name: "Legal", total: 6, reviewed: 3 },
    { id: "team", name: "Team", total: 4, reviewed: 4 },
    { id: "cap", name: "Cap table", total: 3, reviewed: 2 },
    { id: "prod", name: "Product", total: 3, reviewed: 0 },
  ],
  preview: { folder: "Contracts", file: "Order_form_Brightline.pdf", page: 2, pages: 4, docType: "Order form", clauses: ["Term: 36 months. Fees of $1,080,000 are payable in full on signature.", "Go-live date: to be agreed."] },
  facts: [
    { id: "x1", label: "Prepaid", value: "3 years upfront", tone: "rust", impact: "−$0.7M ARR", source: { kind: "pdf", label: "p.2 ¶1" } },
    { id: "x2", label: "Go-live", value: "Not set", tone: "warn", impact: "Signed, not live", source: { kind: "pdf", label: "p.2 ¶4" } },
    { id: "x3", label: "Renewal", value: "Auto, 12 mo", tone: "ok", impact: "Matches CIM", source: { kind: "pdf", label: "p.3 ¶2" } },
  ],
  feeds: { pre: "Feeds the ARR bridge: ", hl: "prepaid −$2.1M, not live −$1.0M" },
};

/** GET /api/deals/[id]/memo (@assumed) — claims + citations come from /api/deals/[id]/claims */
export const memo: MemoData = {
  company: nexaHeader.company,
  outline: [
    { id: "rec", label: "Recommendation", state: "done", selected: true },
    { id: "ov", label: "Company overview", state: "done" },
    { id: "dd", label: "Diligence findings", state: "warn" },
    { id: "risk", label: "Key risks & mitigants", state: "warn" },
    { id: "val", label: "Valuation", state: "done" },
    { id: "icq", label: "Expected IC questions", state: "running" },
    { id: "close", label: "Closing conditions", state: "done" },
  ],
  meta: { draft: "Draft 3 · IC Mon 2 Nov", citations: 47, unsupported: 0 },
  title: "NexaFlow · Series B",
  recommendation: { verdict: "Invest, subject to conditions", valuation: nexaValuation, valuationCite: 12, verifiedArr: { value: "$14.6M", cite: 3 }, flags: ["high", "high", "mid", "mid", "low"] },
  conditions: [
    { id: "k1", text: "Maya signs off the ARR bridge to $14.6M", cite: 3 },
    { id: "k2", text: "Interim head of engineering named before close", cite: 18 },
    { id: "k3", text: "Pre-money: ", cite: 12, showValuation: true },
  ],
  bridge,
  disagreement: { you: "Key person risk: Medium", agent: "High: 4 engineers followed Jordan", cite: 18 },
  questions: ["Why is ARR $3.6M below the deck?", "Who runs engineering after Jordan?", "What would change our recommendation?"],
  sources: [
    arrExcerptSource,
    { kind: "xlsx", label: "Valuation model · Our case", n: 12 },
    { kind: "crust", label: "Crustdata · people", n: 18 },
    { kind: "pdf", label: "CIM.pdf p.42", n: 21 },
  ],
  activity: [
    { id: "a1", label: "Read 31 of 40 files", at: "02:10" },
    { id: "a2", label: "Checked 12 deck claims", at: "03:02" },
    { id: "a3", label: "Wrote draft 3", at: "05:30" },
    { id: "a4", label: "You edited Key risks", at: "08:14" },
  ],
  exportNote: "Uses the firm’s IC memo template",
  priors: {
    basisLabel: "Pre-money / verified ARR",
    arr: 14.6,
    comparable: [
      { company: "Fernway", multiple: 7.8, outcome: "On plan", tone: "neutral" },
      { company: "Mosaic Health", multiple: 8.2, outcome: "Flat 6 mo", tone: "warn" },
      { company: "Tidepool", multiple: 8.9, outcome: "2.4× markup", tone: "ok" },
      { company: "Arcline", multiple: 9.6, outcome: "ARR 1.6×", tone: "ok" },
      { company: "Corvid", multiple: 11.5, outcome: "Needs bridge", tone: "rust" },
    ],
    median: 8.9,
    band: { low: 8.2, high: 9.6 },
    axis: { min: 6, max: 14 },
    source: { kind: "memo", label: "Firm brain · outcomes" },
    implied: { low: 120, high: 140 },
    note: "Our cap is 9.1×, inside the firm’s usual band. The $180M ask is 12.3×, above every deal we’ve done; the last one above 11× needed a bridge.",
  },
};
