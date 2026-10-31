/**
 * v3.2 · Docked assistant conversation, as a pure function of a frame (?frame=1..6) so the film can shoot any moment.
 * 1 empty · 2 thinking (Helio) · 3 answer with mini chart + follow-ups · 4 second question thinking · 5 answer with company rows · 6 deal card answer
 */
import type { AssistantData, AssistantIcon, AssistantMsg, AssistantThread, Nav } from "../../src/types";
import { ROUTES } from "../../src/routes";
import { helioGrowth } from "./helio";

/** Scopes offered by the composer's context chip. */
export const askScopes = ["All deals", "Pipeline", "Portfolio", "Helio Sensors", "Firm memory"];
/** Previous threads, shown quietly under the full-page first run. */
export const askRecent: AssistantThread[] = [
  { id: "th1", title: "Why did we pass on Pinecrest?", meta: "Yesterday · 4 sources", icon: "pass" },
  { id: "th2", title: "Northwind’s IOI questions on Halyard", meta: "Tue · draft ready", icon: "mail" },
  { id: "th3", title: "Corvid burn, month by month", meta: "Mon · 2 sources", icon: "runway" },
];

export const helioAskEmpty: AssistantData = {
  title: "Ask Deal Desk", context: "Helio Sensors", placeholder: "Ask about Helio Sensors…", messages: [], scopes: askScopes, recent: askRecent,
  greeting: { title: "Ask about Helio Sensors", body: "I’ve read the deck, the data room and three months of HDFC statements." },
  suggestions: [
    { id: "q1", title: "How fast is Helio really growing?", short: "Helio’s real growth", desc: "Deck p.4 vs bank deposits", action: "ask_helio_growth", icon: "growth" },
    { id: "q2", title: "Who else has backed the founders?", short: "Founders’ backers", desc: "Crustdata · LinkedIn", action: "ask_helio_backers", icon: "people" },
    { id: "q3", title: "What’s still open before Thursday’s IC?", short: "Open before IC", desc: "Memo draft 3", action: "ask_helio_ic", icon: "memo" },
    { id: "q4", title: "Is the $11M cap reasonable at 22%?", short: "Is the cap fair?", desc: "Valuation · comparables", action: "ask_helio_value", icon: "valuation" },
  ],
};

/** Fallback dock content when a page brings none of its own (⌘K / ⌘J anywhere). */
export const askEmpty: AssistantData = {
  title: "Ask Deal Desk", context: "All deals", placeholder: "Ask about a deal, a company or the portfolio…", messages: [], scopes: askScopes, recent: askRecent,
  greeting: { title: "What do you want to know?", body: "I can read every deck, data room, inbox thread and memo the firm has. Answers come with sources." },
  suggestions: [
    { id: "e1", title: "How fast is Helio really growing?", short: "Helio’s real growth", desc: "Deck vs bank deposits", action: "ask_helio_growth", icon: "growth" },
    { id: "e2", title: "Which portfolio companies have under 9 months runway?", short: "Runway under 9 months", desc: "Latest KPIs", action: "ask_runway", icon: "runway" },
    { id: "e3", title: "What did Northwind ask about Halyard?", short: "Northwind’s questions", desc: "IOI questions · draft ready", action: "ask_northwind", icon: "mail" },
    { id: "e4", title: "Why did we pass on Pinecrest?", short: "Why we passed on Pinecrest", desc: "Firm memory", action: "ask_pinecrest", icon: "pass" },
  ],
};

const q = (id: string, title: string, desc: string, icon: AssistantIcon, short?: string) => ({ id, title, desc, action: id, icon, short });
/** Page-aware empty states: the suggested questions follow the page you are on. */
export const askByPage: Partial<Record<Nav, AssistantData>> = {
  today: { ...askEmpty, greeting: { title: "Morning. What do you want to know?", body: "Two things need you today. Ask about them, or anything else the firm knows." }, suggestions: [q("ask_helio_growth", "How fast is Helio really growing?", "Deck vs bank deposits", "growth", "Helio’s real growth"), q("ask_waiting", "What’s waiting on me?", "2 decisions · 1 IC memo", "inbox", "What’s waiting on me"), q("ask_northwind", "What did Northwind ask about Halyard?", "IOI questions · draft ready", "mail", "Northwind’s questions"), q("ask_runway", "Which portfolio companies have under 9 months runway?", "Latest KPIs", "runway", "Runway under 9 months")] },
  pipeline: { ...askEmpty, context: "Pipeline · 25 deals", greeting: { title: "Ask about the pipeline", body: "Fit, owners and next steps for every live deal, with the sources behind them." }, suggestions: [q("ask_fit", "Which new inbound fits our thesis?", "This week · 4 new", "search"), q("ask_stalled", "What’s stalled for more than two weeks?", "By stage and owner", "history"), q("ask_ic", "What’s going to IC on Thursday?", "Helio Sensors · memo draft 3", "memo")] },
  portfolio: { ...askEmpty, context: "Portfolio · Fund III · 14 companies", greeting: { title: "Ask about the portfolio", body: "Runway, burn and the latest updates, read from founder KPIs and bank data." }, suggestions: [q("ask_runway", "Which companies have under 9 months runway?", "Latest KPIs", "runway"), q("ask_late", "Who hasn’t sent an update since July?", "Fernway", "calendar"), q("ask_flat", "Why is Mosaic’s ARR flat?", "6 months of KPIs", "growth")] },
  brain: { ...askEmpty, context: "Firm memory", greeting: { title: "Ask the firm’s memory", body: "Past decisions, pass reasons and partner notes, searchable in plain words." }, suggestions: [q("ask_pinecrest", "Why did we pass on Pinecrest?", "Decision · Thu", "pass"), q("ask_pattern", "Which pass reasons come up most?", "Last 12 months", "search"), q("ask_learned", "What did the agents learn this week?", "+42 memories", "agent")] },
  agents: { ...askEmpty, context: "Agents", greeting: { title: "Ask about your agents", body: "What ran, what it touched and what it’s waiting on." }, suggestions: [q("ask_running", "What’s running right now?", "3 agents", "agent"), q("ask_touch", "Which agents can send email for me?", "Gmail access", "mail"), q("ask_wait", "What’s waiting for my approval?", "2 steps", "inbox")] },
};
/** Full page (/ask) first run, opened from Today. */
export const askFull: AssistantData = { ...(askByPage.today ?? askEmpty), greeting: { title: "What can Deal Desk do for you?", body: "Ask about a deal, a founder or the portfolio. Answers cite their sources." } };
/** Back-compat names (wrappers imported these from the component before v3.3). */
export const ASK_EMPTY = askEmpty;
export const ASK_BY_PAGE = askByPage;

const q1: AssistantMsg = { id: "u1", from: "user", text: "How fast is Helio really growing?" };
const think1: AssistantMsg = { id: "t1", from: "agent", text: "", thinking: { label: "Checking the deck against the bank…", steps: [{ label: "Read Helio_deck.pdf · p.4", done: true }, { label: "Matched 5 months of HDFC deposits", done: true }, { label: "Rebuilding monthly revenue" }] } };
const a1: AssistantMsg = {
  id: "a1", from: "agent",
  text: "About 22% a month, not the 40% on the deck [1]. HDFC deposits take MRR from $29.4K in June to $65K in October [2]. The gap is two pilots counted as revenue that haven’t paid yet [3]. Hiring is running ahead of revenue: headcount is up 38% in six months, mostly field sales [4].",
  sources: [{ kind: "pdf", label: "Helio_deck.pdf p.4" }, { kind: "bank", label: "HDFC statements p.2–6" }, { kind: "xlsx", label: "Pilot tracker.xlsx" }, { kind: "crust", label: "Headcount +38% in 6 mo", provider: "crustdata", asOf: "updated 2h ago" }],
  visual: { kind: "growth", growth: helioGrowth },
};
const q2: AssistantMsg = { id: "u2", from: "user", text: "Which portfolio companies have under 9 months runway?" };
const think2: AssistantMsg = { id: "t2", from: "agent", text: "", thinking: { label: "Reading the latest KPIs…", steps: [{ label: "14 companies · August and September KPIs", done: true }, { label: "Checking cash against burn" }] } };
const a2: AssistantMsg = {
  id: "a2", from: "agent",
  text: "One company is under 9 months: Corvid at 8.4 months, from August KPIs [1]. Mosaic Health is next at 15 months, with flat ARR for six months [2].",
  sources: [{ kind: "xlsx", label: "Corvid KPIs Aug" }, { kind: "xlsx", label: "Mosaic KPIs Sep" }],
  visual: { kind: "companies", title: "Runway, shortest first", rows: [
    { id: "corvid", name: "Corvid", initial: "C", value: "8.4 mo", note: "Burn $610K/mo · update Aug", tone: "rust", href: ROUTES.portfolio },
    { id: "mosaic", name: "Mosaic Health", initial: "M", value: "15 mo", note: "ARR flat at $9.8M", tone: "warn", href: ROUTES.portfolio },
    { id: "fernway", name: "Fernway", initial: "F", value: "19 mo", note: "Update late · July", href: ROUTES.portfolio },
  ] },
};
const q3: AssistantMsg = { id: "u3", from: "user", text: "Where does Helio stand before Thursday?" };
const a3: AssistantMsg = {
  id: "a3", from: "agent", text: "Memo draft 3 is ready except valuation [1]. Ananya hasn’t answered the growth question yet [2]. The team checks out: both founders ex-Bosch, no departures this year [3].",
  sources: [{ kind: "memo", label: "IC memo · draft 3" }, { kind: "mail", label: "Gmail · Ananya Rao" }, { kind: "crust", label: "Founders · 0 departures", provider: "crustdata", asOf: "updated 2h ago" }],
  visual: { kind: "deal", name: "Helio Sensors", initial: "H", dark: true, stage: "Seed · partner meeting Thu", href: ROUTES.deal("helio"), facts: [{ k: "Ask", v: "$1.5M" }, { k: "Cap", v: "$11M" }, { k: "Growth", v: "22%/mo", tone: "rust" }] },
};

/** Exported so the fixtures index attaches company marks (logoUrl) to the inline visuals. */
export const assistantMessages = { q1, think1, a1, q2, think2, a2, q3, a3 };
export const ASSISTANT_FRAMES = 6;
export function assistantAt(frame: number, base: AssistantData = helioAskEmpty): AssistantData {
  const f = Math.min(ASSISTANT_FRAMES, Math.max(1, Math.round(frame)));
  const msgs: AssistantMsg[][] = [[], [q1, think1], [q1, a1], [q1, a1, q2, think2], [q1, a1, q2, a2], [q2, a2, q3, a3]];
  const followups: Record<number, string[]> = {
    3: ["Which portfolio companies have under 9 months runway?", "Re-run the valuation at 22% a month", "Add the growth question for Ananya"],
    5: ["Draft a check-in to Corvid’s CFO", "Show Corvid’s burn by month"],
    6: ["Open the memo", "Draft the follow-up to Ananya"],
  };
  return { ...base, context: f >= 4 && f < 6 ? "All deals" : base.context, messages: msgs[f - 1], followups: followups[f], suggestions: f === 1 ? base.suggestions : [] };
}
