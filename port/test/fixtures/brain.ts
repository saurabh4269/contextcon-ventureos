import type { BrainData, ThesisLine } from "../../src/types";
import { ROUTES } from "../../src/routes";

/**
 * v4 · The Fund III thesis as lines. One story everywhere: the sidebar ("Fund III · Seed to Series A"), Today's fit
 * pills and the inbound agent's decision chips (Seed–A, Fit ≥ 75, Cheque ≤ $2M) all read from the same numbers.
 * Helio frames update t3 (Seed checks), so its id and wording stay put.
 */
export const firmThesis: ThesisLine[] = [
  { id: "t1", field: "Stage", text: "Seed to Series A, B2B software and software-led hardware" },
  { id: "t5", field: "Sectors", text: "Fintech and finance ops, AI tooling, logistics software" },
  { id: "t2", field: "Check size", text: "Up to $2M first cheque, 10–15% ownership" },
  { id: "t6", field: "Fit bar", text: "Fit 75+ gets a founder call; 55–74 is a maybe" },
  { id: "t3", field: "Seed checks", text: "Deck metrics + founder call" },
  { id: "t4", field: "Pass on", text: "Services revenue above 30%, single-customer concentration" },
];

/** GET /api/firm/brain (@assumed) + GET /api/firm/thesis-proposals */
export const brain: BrainData = {
  scope: "Northbeam Ventures · Fund III",
  exportName: "northbeam-firm-brain",
  thesis: firmThesis,
  kinds: [
    { id: "all", label: "All memories", count: "1,284", selected: true },
    { id: "pass", label: "Pass reasons", count: "31" },
    { id: "anti", label: "Anti-portfolio", count: "6" },
    { id: "pattern", label: "Patterns", count: "46" },
    { id: "pref", label: "Partner preferences", count: "38" },
    { id: "founder", label: "Founder notes", count: "212" },
    { id: "ic", label: "IC notes & deal files", count: "951" },
  ],
  since: "Learned since 2019",
  total: 1284,
  weekDelta: 8,
  trend: [1102, 1131, 1150, 1176, 1203, 1229, 1251, 1276, 1284],
  trendLabels: ["Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"],
  passReasons: [{ label: "Market too small", n: 9 }, { label: "Price", n: 7 }, { label: "Team gaps", n: 6 }, { label: "Metrics didn’t hold", n: 5 }, { label: "Too early", n: 4 }],
  passCount: 31,
  antiPortfolio: [
    { company: { id: "closeloop", name: "Closeloop", initial: "C" }, outcome: "$6M → $13M ARR" },
    { company: { id: "relay", name: "Relay", initial: "R" }, outcome: "Raised Series C" },
    { company: { id: "brightside", name: "Brightside", initial: "B" }, outcome: "Acquired · 6×" },
  ],
  memories: [
    { id: "m1", kindId: "pattern", text: "Prepaid contracts often inflate ARR in close software", kind: "Pattern", usage: "3 deals", source: { kind: "xlsx", label: "model.xlsx" }, at: "Sep" },
    { id: "m2", kindId: "pref", text: "Saurabh wants the ARR bridge before any IC", kind: "Partner preference", usage: "12 memos", source: { kind: "mail", label: "Gmail" }, at: "Aug" },
    { id: "m3", kindId: "pattern", text: "Founders who go quiet 2+ weeks rarely close", kind: "Pattern", usage: "8 deals", source: { kind: "crust", label: "Crustdata" }, at: "Jul" },
    { id: "m4", kindId: "pass", text: "Passed on Closeloop at $6M ARR: market too small", kind: "Pass reason", usage: "1 deal", source: { kind: "pdf", label: "IC notes 2024" }, at: "Oct ’24" },
    { id: "m5", kindId: "pattern", text: "Bridges below 9 months of runway raised within 6 months, 2 of 3 times", kind: "Pattern", usage: "Corvid", source: { kind: "db", label: "Portfolio · 3 bridges" }, at: "Today" },
    { id: "m6", kindId: "pass", text: "Pinecrest: services revenue at 45%, above our 30% line", kind: "Pass reason", usage: "1 deal", source: { kind: "memo", label: "Decision · Thu" }, at: "Thu" },
    { id: "m7", kindId: "pass", text: "Relay at seed: $40M cap on $1M ARR, passed on price", kind: "Pass reason", usage: "1 deal", source: { kind: "pdf", label: "IC notes · Mar ’24" }, at: "Mar ’24" },
    { id: "m8", kindId: "pass", text: "Tallow: consumer goods, outside the thesis", kind: "Pass reason", usage: "1 deal", source: { kind: "mail", label: "Pass email · Gmail" }, at: "Today" },
    { id: "m9", kindId: "anti", text: "Closeloop doubled ARR after our pass; our TAM model missed mid-market", kind: "Anti-portfolio", usage: "4 memos", source: { kind: "crust", label: "Crustdata · ARR est." }, at: "Oct" },
    { id: "m10", kindId: "anti", text: "Relay raised a Series C; price was the only reason we gave", kind: "Anti-portfolio", usage: "2 memos", source: { kind: "web", label: "TechCrunch" }, at: "Jun" },
    { id: "m11", kindId: "anti", text: "Brightside sold for 6× its last round to a payroll buyer", kind: "Anti-portfolio", usage: "1 memo", source: { kind: "web", label: "Press release" }, at: "Feb" },
    { id: "m12", kindId: "pref", text: "Maya wants a customer reference call before any Series A IC", kind: "Partner preference", usage: "9 memos", source: { kind: "call", label: "Partner meeting" }, at: "Sep" },
    { id: "m13", kindId: "pref", text: "IC wants churn by cohort, not blended", kind: "Partner preference", usage: "New", source: { kind: "memo", label: "IC notes · Thu" }, at: "Overnight" },
    { id: "m14", kindId: "pref", text: "Arjun reads the cap table first; send it with the memo", kind: "Partner preference", usage: "6 memos", source: { kind: "mail", label: "Gmail" }, at: "Jul" },
    { id: "m15", kindId: "founder", text: "Tom Becker (Corvid) is straight about bad news and sends KPIs early", kind: "Founder note", usage: "Corvid", source: { kind: "call", label: "Board call · Aug" }, at: "Aug" },
    { id: "m16", kindId: "founder", text: "Ana Ruiz (NexaFlow): ex-Stripe finance lead, 5 strong references", kind: "Founder note", usage: "NexaFlow", source: { kind: "call", label: "Reference calls" }, at: "Oct" },
    { id: "m17", kindId: "founder", text: "Priya Shah (Ledgerly) hires through a warm network; 4 eng hires in 60 days", kind: "Founder note", usage: "Ledgerly", source: { kind: "crust", label: "Crustdata" }, at: "Oct" },
    { id: "m18", kindId: "ic", text: "NexaFlow IC memo v3: ARR verified at $14.6M against bank deposits", kind: "IC note", usage: "IC Mon", source: { kind: "memo", label: "IC memo · v3" }, at: "Today" },
    { id: "m19", kindId: "ic", text: "Helio Sensors data room: 14 files read, growth checked against HDFC deposits", kind: "Deal file", usage: "Helio", source: { kind: "pdf", label: "Data room" }, at: "Today" },
    { id: "m20", kindId: "ic", text: "Arcline IC notes: unanimous invest; freight visibility was the wedge", kind: "IC note", usage: "Arcline", source: { kind: "pdf", label: "IC notes · Aug ’25" }, at: "Aug ’25" },
  ],
  learnedOvernight: { id: "l1", text: "IC wants churn by cohort" },
  usage: { reads: [168, 181, 142, 96, 88, 197, 214], days: ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"], delta: "+18%", cited: 61, stale: 12 },
  accessLog: [
    { id: "al0", who: "Portfolio monitor", what: "Bridge patterns", at: "08:02", kindId: "pattern" },
    { id: "al1", who: "Claude · MCP", what: "NexaFlow memories", at: "07:58", href: ROUTES.deal("nexaflow") },
    { id: "al2", who: "ChatGPT · MCP", what: "Pass reasons", at: "Yesterday", kindId: "pass" },
    { id: "al3", who: "Maya K.", what: "Partner preferences", at: "Tue", kindId: "pref" },
  ],
  mcp: {
    url: "mcp.dealdesk.app/firm",
    note: "Read-only · 3 people connected",
    setup: {
      clients: [
        { id: "claude", label: "Claude", steps: ["Open Claude, then Settings → Connectors", "Choose Add custom connector and paste the URL", "Sign in with your Northbeam Google account"] },
        { id: "chatgpt", label: "ChatGPT", steps: ["Open ChatGPT, then Settings → Connectors → Advanced", "Turn on developer mode and choose Create", "Paste the URL and sign in with your Northbeam Google account"] },
      ],
      people: [{ initials: "SG", name: "Saurabh Gupta", client: "Claude" }, { initials: "MK", name: "Maya Kapoor", client: "ChatGPT" }, { initials: "AR", name: "Arjun Rao", client: "Claude" }],
      scopes: ["Reads memories, the thesis and outcomes", "No deal files, data rooms or email", "Every read lands in the access log"],
    },
  },
  exportNote: "Markdown or JSON · yours to keep",
  outcomes: [
    { id: "o2", date: "Aug ’25", company: "Arcline", co: { id: "arcline", name: "Arcline", initial: "A" }, decision: "invested", result: "ARR 1.6× in 12 mo", tone: "ok" },
    { id: "o3", date: "Jun ’25", company: "Corvid", co: { id: "corvid", name: "Corvid", initial: "C" }, decision: "invested", result: "8.4 mo runway · bridge", tone: "warn" },
    { id: "o5", date: "Jan ’25", company: "Tidepool", co: { id: "tidepool", name: "Tidepool", initial: "T" }, decision: "invested", result: "ARR 2.9× since seed", tone: "ok" },
    { id: "o1", date: "Oct ’24", company: "Closeloop", co: { id: "closeloop", name: "Closeloop", initial: "C" }, decision: "passed", result: "$6M → $13M ARR", tone: "rust" },
    { id: "o4", date: "Mar ’24", company: "Relay", co: { id: "relay", name: "Relay", initial: "R" }, decision: "passed", result: "Raised Series C", tone: "rust" },
    { id: "o6", date: "Nov ’23", company: "Brightside", co: { id: "brightside", name: "Brightside", initial: "B" }, decision: "passed", result: "Acquired · 6×", tone: "rust" },
  ],
  priors: [
    { label: "Pre-money / verified ARR", value: "8.9×", basis: "median of 5 investments · IQR 8.2–9.6×" },
    { label: "Deck ARR overstated", value: "4 of 9", basis: "avg gap 14% · prepaid most common" },
    { label: "IC → term sheet", value: "48%", basis: "last 12 months · firm avg 44%" },
    { label: "First meeting → term sheet", value: "34 days", basis: "median, last 12 months" },
  ],
  proposals: [
    { id: "tp1", field: "Check size", from: "Up to $2M first cheque", to: "Up to $3M first cheque", why: "3 of your last 4 Series A leads needed $2.6M+ to reach 12% ownership.", evidence: "4 outcomes", proposedBy: "Deal Desk · from outcomes", lineId: "t2", next: "Up to $3M first cheque, 10–15% ownership" },
    { id: "tp2", field: "Sectors", from: "Fintech, AI tooling, logistics", to: "+ Vertical SaaS", why: "3 of your last 5 vertical SaaS passes raised up-rounds; partners marked 2 as “should have met”.", evidence: "Pass log · 5 deals", proposedBy: "Deal Desk · from pass reasons", lineId: "t5", next: "Fintech and finance ops, AI tooling, logistics software, vertical SaaS" },
  ],
};
export const brainEmptyMemories: BrainData = { ...brain, memories: [], proposals: [] };
