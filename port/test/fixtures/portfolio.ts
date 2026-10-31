import type { PortfolioCompany, PortfolioData } from "../../src/types";
import { ROUTES } from "../../src/routes";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Five months of runway ending at `end` in `last`, falling `step` months each month (no raise in between). */
const runway = (last: string, end: number, step = 1): { month: string; months: number }[] => {
  const i = MONTHS.indexOf(last);
  return Array.from({ length: 5 }, (_, k) => ({ month: MONTHS[(i - 4 + k + 12) % 12], months: Math.round((end + step * (4 - k)) * 10) / 10 }));
};
const co = (id: string, name: string) => ({ id, name, initial: name[0] });

/** Fund III, Seed to Series A. The five with something to say sit on top; the other nine fold under "+9 on track". */
const companies: PortfolioCompany[] = [
  { id: "corvid", company: co("corvid", "Corvid"), line: "Fleet payments · Series A", founder: "Tom Becker", arr: "$6.1M", arrTrend: [4.2, 4.6, 5.0, 5.4, 5.8, 6.1], burn: "$610K", cash: "$5.1M", runwayMonths: 8.4, runwayHistory: [{ month: "Apr", months: 13 }, { month: "May", months: 12.1 }, { month: "Jun", months: 11 }, { month: "Jul", months: 9.9 }, { month: "Aug", months: 8.4 }], lastUpdate: { label: "Aug" }, alert: { label: "Low runway", tone: "rust", kind: "runway" }, selected: true },
  { id: "arcline", company: co("arcline", "Arcline"), line: "Freight visibility · Series A", founder: "Lena Ortiz", arr: "$22.4M", arrTrend: [14, 16, 17.5, 19, 21, 22.4], burn: "$900K", cash: "$23.4M", runwayMonths: 26, runwayHistory: runway("Sep", 26), lastUpdate: { label: "Sep" }, alert: { label: "Series B term sheet", tone: "ok", kind: "raising" } },
  { id: "mosaic", company: co("mosaic", "Mosaic Health"), line: "Clinic billing · Series A", founder: "Ravi Menon", arr: "$9.8M", arrTrend: [9.9, 10.1, 10, 9.9, 9.8, 9.8], burn: "$540K", cash: "$8.1M", runwayMonths: 15, runwayHistory: runway("Sep", 15), lastUpdate: { label: "Sep" }, alert: { label: "Flat growth", tone: "warn", kind: "growth" } },
  { id: "tidepool", company: co("tidepool", "Tidepool"), line: "Treasury API · Seed", founder: "June Park", arr: "$3.2M", arrTrend: [1.1, 1.5, 1.9, 2.4, 2.8, 3.2], burn: "$380K", cash: "$8.0M", runwayMonths: 21, runwayHistory: runway("Sep", 21), lastUpdate: { label: "Sep" }, alert: { label: "Raising A", tone: "ok", kind: "raising" } },
  { id: "fernway", company: co("fernway", "Fernway"), line: "Logistics ERP · Series A", founder: "Omar Haddad", arr: "$14.0M", arrTrend: [10, 11, 11.8, 12.6, 13.2, 14], burn: "$720K", cash: "$13.7M", runwayMonths: 19, runwayHistory: runway("Jul", 19), lastUpdate: { label: "Jul", late: true }, alert: { label: "Late update", tone: "warn", kind: "late" } },
  { id: "sable", company: co("sable", "Sable"), line: "AP fraud detection · Seed", founder: "Nia Brooks", arr: "$1.4M", arrTrend: [0.6, 0.8, 0.9, 1.1, 1.2, 1.4], burn: "$210K", cash: "$6.3M", runwayMonths: 30, runwayHistory: runway("Aug", 30), lastUpdate: { label: "Aug" }, onTrack: true },
  { id: "clearwater", company: co("clearwater", "Clearwater"), line: "Water sensors · Series A", founder: "Hugo Lind", arr: "$7.2M", arrTrend: [5.1, 5.5, 6.0, 6.4, 6.8, 7.2], burn: "$480K", cash: "$10.6M", runwayMonths: 22, runwayHistory: runway("Sep", 22), lastUpdate: { label: "Sep" }, onTrack: true },
  { id: "atlas", company: co("atlas", "Atlas Logistics"), line: "Customs software · Series A", founder: "Priya Nair", arr: "$5.5M", arrTrend: [3.9, 4.2, 4.6, 4.9, 5.2, 5.5], burn: "$510K", cash: "$8.7M", runwayMonths: 17, runwayHistory: runway("Sep", 17), lastUpdate: { label: "Sep" }, onTrack: true },
  { id: "gridline", company: co("gridline", "Gridline"), line: "Grid IoT · Seed", founder: "Sam Okafor", arr: "$4.8M", arrTrend: [3.0, 3.4, 3.8, 4.1, 4.5, 4.8], burn: "$420K", cash: "$7.6M", runwayMonths: 18, runwayHistory: runway("Sep", 18), lastUpdate: { label: "Sep" }, onTrack: true },
  { id: "meridian", company: co("meridian", "Meridian"), line: "Revenue ops AI · Seed", founder: "Ella Novak", arr: "$3.6M", arrTrend: [2.2, 2.5, 2.8, 3.1, 3.4, 3.6], burn: "$330K", cash: "$6.6M", runwayMonths: 20, runwayHistory: runway("Sep", 20), lastUpdate: { label: "Sep" }, onTrack: true },
  { id: "fathom", company: co("fathom", "Fathom"), line: "Port data · Seed", founder: "Kai Tanaka", arr: "$2.6M", arrTrend: [1.4, 1.7, 1.9, 2.2, 2.4, 2.6], burn: "$260K", cash: "$6.2M", runwayMonths: 24, runwayHistory: runway("Sep", 24), lastUpdate: { label: "Sep" }, onTrack: true },
  { id: "quarry", company: co("quarry", "Quarry"), line: "Construction fintech · Seed", founder: "Ada Mensah", arr: "$1.9M", arrTrend: [1.0, 1.2, 1.4, 1.6, 1.7, 1.9], burn: "$230K", cash: "$6.2M", runwayMonths: 27, runwayHistory: runway("Sep", 27), lastUpdate: { label: "Sep" }, onTrack: true },
  { id: "lattice", company: co("lattice", "Lattice"), line: "Spend controls · Seed", founder: "Ben Adler", arr: "$1.1M", arrTrend: [0.5, 0.6, 0.7, 0.8, 1.0, 1.1], burn: "$190K", cash: "$4.8M", runwayMonths: 25, runwayHistory: runway("Sep", 25), lastUpdate: { label: "Sep" }, onTrack: true },
  { id: "brightline", company: co("brightline", "Brightline"), line: "Card issuing · Seed", founder: "Zoe Hart", arr: "$0.9M", arrTrend: [0.3, 0.4, 0.5, 0.6, 0.8, 0.9], burn: "$150K", cash: "$4.2M", runwayMonths: 28, runwayHistory: runway("Sep", 28), lastUpdate: { label: "Sep" }, onTrack: true },
];

/** GET /api/portfolio?fund=III (@assumed) */
export const portfolio: PortfolioData = {
  fundLabel: "Fund III",
  sub: "Seed to Series A · KPIs read from founder updates and bank feeds",
  companyCount: companies.length,
  view: "All",
  alertLineMonths: 9,
  runwayAxisMax: 30,
  hiddenOnTrack: companies.filter((c) => c.onTrack).length,
  companies,
  filters: [
    { id: "all", label: "All" },
    { id: "attention", label: "Needs attention" },
    { id: "runway", label: "Low runway" },
    { id: "raising", label: "Raising" },
    { id: "late", label: "Late update" },
  ],
  exportName: "northbeam-fund-iii-portfolio",
  reports: [
    { id: "r1", kind: "lpUpdate", title: "Q3 LP update", progress: 0.78, caption: "Draft · Word template", right: "11/14 KPIs in" },
    { id: "r2", kind: "boardDeck", title: "Corvid board deck", date: "Thu 12 Nov", caption: "Prep notes ready · 9:30 am" },
    { id: "r3", kind: "kpiRequests", title: "KPI requests", received: 11, total: 14, caption: "3 reminders drafted in Gmail" },
  ],
  docs: {
    r1: {
      title: "Q3 LP update",
      sub: "Fund III · drafted from the firm’s Word template",
      status: "Draft · 78% filled",
      source: { kind: "xlsx", label: "Q3 KPI packs · 11 of 14" },
      sections: [
        { id: "summary", title: "Fund summary", body: "Fourteen companies, $84.5M combined ARR. Arcline has a Series B term sheet; Tidepool is raising its A. Corvid is below our 9-month runway line and is asking insiders for a $3M bridge." },
        { id: "kpis", title: "KPIs still missing", items: [{ label: "Corvid", value: "Sep pack · last sent Aug", tone: "warn" }, { label: "Fernway", value: "Aug and Sep · last sent Jul", tone: "rust" }, { label: "Sable", value: "Sep pack · last sent Aug", tone: "warn" }] },
        { id: "filled", title: "Sections filled", items: [{ label: "Fund summary", done: true }, { label: "Company one-liners", done: true }, { label: "Valuation marks", done: true }, { label: "Corvid bridge note", done: false }] },
      ],
      primary: { id: "share", label: "Share draft with partners", done: "Shared with 3 partners" },
    },
    r2: {
      title: "Corvid board meeting",
      sub: "Thu 12 Nov · 9:30 am · Corvid office and Meet",
      status: "Prep notes ready",
      source: { kind: "deck", label: "Corvid Q3 board deck · 24 slides" },
      sections: [
        { id: "agenda", title: "Agenda", items: [{ label: "Q3 numbers and runway", value: "20 min" }, { label: "Bridge: $3M SAFE", value: "25 min" }, { label: "Hiring freeze and burn plan", value: "15 min" }] },
        { id: "notes", title: "Prep notes", body: "Burn is $610K a month against $5.1M at SVB, so runway falls to 7.2 months by September’s close. Headcount is down 9% in 30 days. Ask what a $450K burn plan cuts first, and who else is in the bridge." },
        { id: "ask", title: "Questions to ask", items: [{ label: "Which insiders have committed to the SAFE?" }, { label: "What does the plan look like with no bridge?" }, { label: "When does the Series B process start?" }] },
      ],
      primary: { id: "send", label: "Send prep notes to Maya", done: "Sent to Maya K." },
    },
    r3: {
      title: "KPI requests · Q3",
      sub: "11 of 14 packs received · reminders drafted in Gmail",
      status: "3 outstanding",
      source: { kind: "mail", label: "Gmail drafts · 3" },
      sections: [
        { id: "missing", title: "Waiting on", items: [{ label: "Corvid · Tom Becker", value: "Sep pack", tone: "warn" }, { label: "Fernway · Omar Haddad", value: "Aug and Sep", tone: "rust" }, { label: "Sable · Nia Brooks", value: "Sep pack", tone: "warn" }] },
        { id: "draft", title: "Reminder draft", body: "Hi {first name}, a quick nudge for the Q3 KPI pack: ARR, burn, cash and headcount are enough. Our LP update goes out on 13 Nov. Thanks, Saurabh" },
      ],
      primary: { id: "remind", label: "Send 3 reminders", done: "3 reminders sent from Gmail" },
    },
  },
  live: {
    title: "Portfolio watch · Q3 KPIs",
    href: ROUTES.agentInList("watch"),
    startedAt: "8:00 am",
    steps: [
      { id: "s1", label: "Read 11 KPI packs and bank balances", state: "done" },
      { id: "s2", label: "Checked runway against the 9 mo line", state: "done" },
      { id: "s3", label: "Flagged Corvid at 8.4 months", state: "done" },
      { id: "s4", label: "Drafting the Q3 LP update", state: "running" },
      { id: "s5", label: "Queue 3 KPI reminders", state: "queued" },
    ],
  },
  panel: {
    company: co("corvid", "Corvid"),
    alert: { label: "Low runway", tone: "rust" },
    runwayMonths: 8.4,
    history: [{ month: "Apr", months: 13 }, { month: "May", months: 12.1 }, { month: "Jun", months: 11 }, { month: "Jul", months: 9.9 }, { month: "Aug", months: 8.4 }],
    projection: 7.2,
    facts: [
      { label: "Cash", value: "$5.1M", source: { kind: "bank", label: "SVB · 31 Aug" } },
      { label: "Burn", value: "$610K / mo", source: { kind: "xlsx", label: "Aug KPIs" } },
      { label: "Bridge ask", value: "$3M SAFE", source: { kind: "mail", label: "Tom Becker · email" } },
    ],
    pattern: "2 of 3 past bridges at <9 mo raised within 6 months",
    action: { id: "prep_bridge", label: "Prep bridge decision" },
    decision: {
      title: "Corvid · bridge decision",
      sub: "Drafted by Deal Desk from Aug KPIs, the SVB balance and Tom’s email",
      status: "Draft · for Monday’s partner meeting",
      source: { kind: "mail", label: "Tom Becker · 24 Oct" },
      recommended: "prorata",
      options: [
        { id: "prorata", label: "Take our pro rata · $360K", sub: "Keeps 12% · paid from Fund III reserves" },
        { id: "lead", label: "Lead the bridge · $3M", sub: "Over the $2M cheque limit · needs IC" },
        { id: "decline", label: "Decline", sub: "Signals doubt to the other insiders" },
      ],
      sections: [
        { id: "situation", title: "Situation", body: "8.4 months of runway at $610K a month; $5.1M cash at SVB on 31 Aug. On the current plan runway reaches 7.2 months by the September close." },
        { id: "ask", title: "The ask", items: [{ label: "Instrument", value: "$3M SAFE" }, { label: "Cap", value: "$30M post" }, { label: "Our pro rata", value: "$360K · 12%" }, { label: "Other insiders", value: "2 of 3 in" }] },
        { id: "pattern", title: "What the firm has seen", items: [{ label: "Past bridges below 9 months", value: "2 of 3 raised within 6 months", tone: "ok" }, { label: "Headcount, last 30 days", value: "−9% · Crustdata", tone: "rust" }, { label: "ARR, last 6 months", value: "+45%", tone: "ok" }] },
      ],
      primary: { id: "send", label: "Send to partners", done: "On Monday’s partner agenda" },
    },
  },
};
