import type { MandateGate, MandatesData } from "../types";
import { halyardFootballField } from "./valuation";

const ms = (n: number, active: boolean): MandatesData["buyers"][number]["milestones"] =>
  Array.from({ length: 6 }, (_, i) => (i < n ? "done" : i === n && active ? "active" : "todo"));

const cleared: MandateGate[] = [
  { id: "conflicts", label: "Conflicts check", state: "cleared", detail: "No conflicts across 214 relationships", owner: "Compliance · R. Iyer", at: "2 Oct" },
  { id: "engagement", label: "Engagement letter", state: "cleared", detail: "Signed by Halyard CFO", owner: "You", at: "6 Oct" },
  { id: "kyc", label: "KYC", state: "cleared", detail: "Entity + 2 beneficial owners verified", owner: "Compliance · R. Iyer", at: "8 Oct" },
];

const mandateList = (sel: "halyard" | "cobalt"): MandatesData["mandates"] => [
  { id: "halyard", name: "Project Halyard", sub: "Sell-side · IOIs 13 Nov", progress: 0.55, selected: sel === "halyard", walled: true },
  { id: "cobalt", name: "Project Cobalt", sub: "Buy-side · screening", progress: 0.2, selected: sel === "cobalt", walled: true, gatesOpen: 2 },
  { id: "meridian", name: "Project Meridian", sub: "Debt raise · CIM out", progress: 0.4 },
];

/** GET /api/mandates/[id] (@assumed). Banking mode: EV only. */
export const mandateHalyard: MandatesData = {
  mandates: mandateList("halyard"),
  sections: [
    { id: "buyers", label: "Buyer list", meta: "64", selected: true },
    { id: "room", label: "Data room", meta: "212 files" },
    { id: "qa", label: "Q&A log", meta: "6 open" },
    { id: "val", label: "Valuation", meta: "Football field" },
  ],
  selectedName: "Project Halyard",
  eyebrow: "Sell-side · Halyard Freight",
  title: "Buyer list",
  process: { steps: ["Teaser", "NDA", "CIM", "IOI", "LOI", "Close"], currentIndex: 3 },
  countdown: { days: 14, label: "days to IOIs", due: "due Fri 13 Nov" },
  funnel: [{ label: "Contacted", n: 64 }, { label: "Teaser", n: 38 }, { label: "NDA", n: 22 }, { label: "Data room", n: 9 }],
  milestoneLabels: ["Teaser", "NDA", "CIM", "IOI", "Mgmt pres", "LOI"],
  buyers: [
    { id: "b1", name: "Northwind Capital", type: "Sponsor", milestones: ms(3, true), vdrViews: [9, 12, 15, 21, 26], lastTouch: "Today" },
    { id: "b2", name: "Orchard Equity", type: "Sponsor", milestones: ms(3, true), vdrViews: [3, 5, 8, 12, 16], lastTouch: "Today" },
    { id: "b3", name: "Atlas Logistics", type: "Strategic", milestones: ms(3, false), vdrViews: [4, 9, 11, 13, 18], lastTouch: "Yesterday" },
    { id: "b4", name: "Bluewater Partners", type: "Sponsor", milestones: ms(3, false), vdrViews: [6, 8, 9, 9, 10], lastTouch: "3 d" },
    { id: "b5", name: "Keystone Group", type: "Strategic", milestones: ms(3, false), vdrViews: [10, 8, 5, 3, 1], lastTouch: "9 d", quiet: true },
    { id: "b6", name: "Harbor & Co", type: "Strategic", milestones: ms(2, false), vdrViews: [0, 1, 2, 2, 3], lastTouch: "5 d" },
  ],
  moreBuyers: 58,
  sync: { sources: [{ kind: "db", label: "Datasite" }, { kind: "mail", label: "Outlook" }], at: "07:40" },
  qa: {
    answered: 41,
    total: 47,
    items: [
      { id: "q0", status: "tieOut", buyer: "Atlas", question: "FY25 EBITDA: CIM $11.4M vs model $10.9M", sources: [{ kind: "pdf", label: "CIM p.31" }, { kind: "xlsx", label: "Model · EBITDA r.44" }] },
      { id: "q1", status: "draftReady", buyer: "Northwind", question: "Customer concentration top 10?" },
      { id: "q2", status: "draftReady", buyer: "Orchard", question: "Fleet lease terms" },
      { id: "q3", status: "needsClient", buyer: "Atlas", question: "Union contracts" },
    ],
  },
  footballField: halyardFootballField,
  gates: cleared,
  walled: true,
  wall: {
    members: [
      { initials: "SG", name: "Saurabh Gupta", role: "MD · lead" },
      { initials: "NV", name: "Nina Vos", role: "VP" },
      { initials: "TO", name: "Tariq Osei", role: "Associate" },
      { initials: "LW", name: "Lena Wu", role: "Analyst" },
    ],
    approver: "Compliance · R. Iyer",
    crossings: 3,
  },
};

/** Gated + walled: buyer work locked until conflicts, engagement letter and KYC clear. */
export const mandateCobalt: MandatesData = {
  ...mandateHalyard,
  mandates: mandateList("cobalt"),
  selectedName: "Project Cobalt",
  eyebrow: "Buy-side · Cobalt",
  title: "Before we start",
  gates: [
    { id: "conflicts", label: "Conflicts check", state: "cleared", detail: "1 match reviewed: Atlas (prior advisor, 2023), cleared", owner: "Compliance · R. Iyer", at: "28 Oct" },
    { id: "engagement", label: "Engagement letter", state: "pending", detail: "Sent to client 29 Oct · awaiting signature", owner: "You" },
    { id: "kyc", label: "KYC", state: "blocked", detail: "Beneficial owner ID missing for 1 of 3", owner: "Compliance · R. Iyer" },
  ],
  wall: {
    members: [{ initials: "SG", name: "Saurabh Gupta", role: "MD · lead" }, { initials: "NV", name: "Nina Vos", role: "VP" }],
    approver: "Compliance · R. Iyer",
    crossings: 0,
  },
};
