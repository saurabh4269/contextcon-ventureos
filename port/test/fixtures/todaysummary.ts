/** v3.2 · The new Today: ask card + one metric, a hero number, and the work list with fit scores from data. */
import type { TodaySummaryData, WorkRow } from "../../src/types";
import { ROUTES } from "../../src/routes";
import { helioLive, helioFit } from "./helio";
import { nextMeetings } from "./meetings";

const SG = { initials: "SG", name: "Saurabh Gupta" }, MK = { initials: "MK", name: "Maya Kapoor" }, AR = { initials: "AR", name: "Arjun Rao" }, DW = { initials: "DW", name: "Dana Whitfield" };
const up = (label: string) => ({ label, effect: "up" as const }), down = (label: string) => ({ label, effect: "down" as const });
const c = (id: string, name: string, sector: string, dark?: boolean, sectorShort?: string) => ({ id, name, initial: name[0], sector, ...(dark ? { dark } : {}), ...(sectorShort ? { sectorShort } : {}) });

export const workRows: WorkRow[] = [
  { id: "w1", company: c("keel", "Keel", "Fintech · treasury", false, "Fintech"), stage: "new", fit: { score: 88, why: "B2B fintech seed, repeat founder", signals: [up("headcount +38% 6mo"), up("ex-Stripe founder")] }, action: { kind: "book", label: "Book call", recommended: true }, when: "08:02" },
  { id: "w2", company: c("harbor", "Harbor AI", "Port logistics"), stage: "new", fit: { score: 77, why: "Strong team, early revenue", signals: [up("seed $4M closed Sep"), up("headcount +24% 6mo")] }, action: { kind: "claim", label: "Claim", recommended: true }, when: "07:40" },
  { id: "w3", company: c("tallow", "Tallow", "Consumer · candles", false, "Consumer"), stage: "new", fit: { score: 31, why: "Consumer goods, outside thesis", signals: [down("consumer goods, off thesis"), down("headcount −8% 6mo")] }, action: { kind: "pass", label: "Pass" }, when: "07:12" },
  { id: "w4", company: c("orbital", "Orbital", "Fleet insurance"), stage: "screening", fit: { score: 64, why: "Fit on market, thin on traction", signals: [up("ex-Flexport founding team"), down("headcount flat 6mo")] }, owner: MK, action: { kind: "book", label: "Book call" }, when: "Yesterday" },
  { id: "w5", company: c("ledgerly", "Ledgerly", "AP automation"), stage: "screening", fit: { score: 86, why: "Hiring fast, warm intro via Priya", signals: [up("headcount +38% 12mo"), up("CFO hired ex-Brex")] }, owner: SG, action: { kind: "review", label: "Review" }, when: "Yesterday", href: ROUTES.deal("ledgerly") },
  { id: "w6", company: c("helio", "Helio Sensors", "Industrial IoT", true), stage: "diligence", fit: { ...helioFit, why: "Growth is 22%/mo, not 40%" }, owner: SG, action: { kind: "review", label: "Review" }, when: "Today", href: ROUTES.deal("helio") },
  { id: "w7", company: c("vantage", "Vantage", "Clinical trial data", false, "Clinical data"), stage: "diligence", fit: { score: 58, why: "Regulatory risk open", signals: [up("web traffic +22% 3mo"), down("2 senior exits 90d")] }, owner: AR, action: { kind: "review", label: "Review" }, when: "2 d" },
  { id: "w8", company: c("nexaflow", "NexaFlow", "Month-end close", true, "Finance ops"), stage: "ic", fit: { score: 92, why: "ARR verified at $14.6M", signals: [up("headcount +41% 12mo"), up("eng hiring 3× peers")] }, owner: DW, action: { kind: "memo", label: "Open memo", recommended: true }, when: "Mon", href: ROUTES.memo("nexaflow") },
];

export const todaySummary: TodaySummaryData = {
  date: "Thursday, 29 October",
  greeting: "Good morning, Saurabh", sub: "Three decisions need you before the 3pm IC.",
  hero: { value: 12, label: "new inbound", delta: "+4 since yesterday" },
  ask: {
    prompt: "Ready to review today’s inbound or revisit your pipeline?",
    chips: [{ id: "ask_fit", label: "Thesis fits", icon: "search" }, { id: "ask_waiting", label: "Needs me", icon: "pipeline" }, { id: "ask_ic", label: "IC prep", icon: "insight" }],
    placeholder: "Ask me anything…",
  },
  metric: { label: "Inbound this week", sub: "Decks received, last 7 days", value: "41", unit: "decks", delta: "+33% vs last week", up: true, days: ["Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu"], series: [5, 3, 2, 6, 7, 8, 10], href: ROUTES.pipeline },
  waiting: { label: "Waiting on you", items: [
    { id: "wt_memo", label: "Memos to sign off", kind: "memo", due: "before 3pm IC", href: ROUTES.memo("nexaflow") },
    { id: "wt_book", label: "Founder calls to book", kind: "book" },
    { id: "wt_claim", label: "Unclaimed inbound", kind: "claim" },
    { id: "wt_review", label: "Diligence reviews", kind: "review" },
  ] },
  rows: workRows,
  live: { ...helioLive, title: "Helio diligence", startedAt: "9:12" },
  meetings: nextMeetings.slice(0, 3),
};
