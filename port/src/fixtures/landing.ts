import { fitBand, type CompanyRef, type LandingData } from "../types";
import { ROUTES } from "../routes";
import { attachLogos } from "./logos";
import { workRows } from "./todaysummary";
import { helioSignals } from "./signals";
import { keelCall } from "./meetings";

/**
 * v4 · Landing page (/landing). Copy from inspo/LANDING_BRIEF.md; companies, scores and slots are the same demo facts as
 * Today (Keel 88, Ledgerly 86, Harbor AI 77, Helio Sensors 72), read from Today's work rows, Helio's live Crustdata research (signals.ts) and Keel's invite (meetings.ts).
 */
const co = (id: string, name: string, line?: string, domain?: string): CompanyRef => ({ id, name, initial: name[0], line, domain });
/** Today's work rows are the source of truth for every company and fit score shown here. */
const row = (id: string) => workRows.find((r) => r.company.id === id)!;
const fitOf = (id: string) => ({ fit: row(id).fit.score, fitSignals: row(id).fit.signals });
const keel = row("keel").company, ledgerly = row("ledgerly").company, harbor = row("harbor").company, tallow = row("tallow").company, helio = row("helio").company;
const arcline = co("arcline", "Arcline", "Portfolio · Series A");

/* Diligence card mirrors Helio's live Crustdata research on the deal page (fixtures/signals.ts): the same chips, weights and fit. */
const sg = helioSignals;
const chipById = (id: string) => sg.calls.flatMap((c) => c.chips).find((c) => c.id === id);
const seg = (v: string, pick: "first" | "last" | "all") => (pick === "all" ? v : pick === "first" ? v.split(" · ")[0] : v.split(" · ").slice(-1)[0]);
const GRAPH: { chip: string; label: string; pick: "first" | "last" | "all" }[] = [
  // left column top → bottom, then right column (the short ones sit beside the hub)
  { chip: "hc6", label: "Headcount", pick: "all" }, { chip: "past", label: "Founder", pick: "first" }, { chip: "engts", label: "Eng headcount", pick: "last" },
  { chip: "total", label: "Open roles", pick: "all" }, { chip: "webqoq", label: "Web traffic", pick: "all" }, { chip: "cat", label: "Jobs", pick: "all" },
];
const graph = GRAPH.flatMap((g) => { const c = chipById(g.chip); return c ? [{ id: g.chip, label: g.label, value: seg(c.value, g.pick), field: c.path ?? c.field, effect: c.tone ?? "flat" as const }] : []; });
const byWeight = [...sg.fit.contributions].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
const weights = [...byWeight.filter((k) => k.weight > 0).slice(0, 3), ...byWeight.filter((k) => k.weight < 0)].map((k) => ({ id: k.id, label: k.label, weight: k.weight }));
const helioFit = (sg.fit.base.value ?? 0) + sg.fit.contributions.reduce((a, k) => a + k.weight, 0);

export const landing: LandingData = {
  brand: "Deal Desk",
  nav: [
    { id: "triage", label: "Triage", href: "#triage" },
    { id: "diligence", label: "Diligence", href: "#diligence" },
    { id: "meetings", label: "Meetings", href: "#meetings" },
    { id: "agents", label: "Agents", href: "#agents" },
  ],
  signIn: { id: "signin", label: "Sign in", href: ROUTES.today() },
  hero: {
    eyebrow: "For venture and banking deal teams",
    headline: [{ before: "Your firm’s ", accent: "AI" }, { before: "deal team", accent: "" }],
    sub: "Triage inbound, run diligence, book founders and prep IC, with every step visible and every call yours.",
    demo: "Watch the demo",
    access: "Request access",
  },
  assistant: {
    title: "Ask Deal Desk",
    sub: "Northbeam Ventures · Fund III",
    expand: ROUTES.ask("landing"),
    placeholder: "Ask about any deal…",
    questions: [
      {
        id: "thesis", label: "Which inbound fits our thesis?", result: "4 fit · 9 pass",
        answer: "4 of 13 new decks fit Fund III. Keel leads on team growth [1] and a repeat founder [2]; the 9 passes each have a reason logged.",
        sources: [
          { kind: "crust", label: "headcount", provider: "crustdata", asOf: "updated 2h ago" },
          { kind: "crust", label: "founders", provider: "crustdata", asOf: "updated 2h ago" },
          { kind: "mail", label: "13 emails" },
        ],
        rows: [
          { id: "keel", company: keel, title: "Keel", sub: "B2B fintech · Seed", ...fitOf("keel") },
          { id: "ledgerly", company: ledgerly, title: "Ledgerly", sub: "AP automation · Seed", ...fitOf("ledgerly") },
          { id: "harbor", company: harbor, title: "Harbor AI", sub: "Port logistics · Pre-seed", ...fitOf("harbor") },
        ],
      },
      {
        id: "halcyon", label: "What did we promise Halcyon’s founder?", result: "Call booked Tue 3pm",
        answer: "You promised Maya a decision on the term sheet by Friday [1] and an intro to Arcline’s CFO [2]. I booked the follow-up for Tue 3pm in your free slot [3].",
        sources: [
          { kind: "mail", label: "Halcyon thread" },
          { kind: "call", label: "Call notes" },
          { kind: "cal", label: "Calendar" },
        ],
        rows: [
          { id: "decision", tool: "gmail", title: "Term sheet decision by Fri", sub: "Your email to Maya Rao, 24 Oct", pill: { label: "Promised", tone: "warn" } },
          { id: "intro", company: arcline, title: "Intro to Arcline’s CFO", sub: "Drafted, waiting on your OK", pill: { label: "Draft", tone: "neutral" } },
          { id: "call", tool: "calendar", title: "Halcyon follow-up · 30 min", sub: "Tue 3:00 pm · Meet link sent", pill: { label: "Booked", tone: "ok" } },
        ],
      },
      {
        id: "waiting", label: "Who’s waiting on my decision?", result: "IC memo drafted",
        answer: "Three things wait on you. Helio Sensors’ IC memo is drafted with growth checked against bank data [1]; sign off before the 3pm IC [2].",
        sources: [
          { kind: "bank", label: "HDFC Q3" },
          { kind: "cal", label: "IC 3:00 pm" },
        ],
        rows: [
          { id: "helio", company: helio, title: "Helio Sensors", sub: "IC memo · sign off by 3pm", pill: { label: "IC today", tone: "ink" } },
          { id: "keel-call", company: keel, title: "Keel", sub: "Founder call to book", pill: { label: "Book call", tone: "rust" } },
          { id: "ledgerly-reply", company: ledgerly, title: "Ledgerly", sub: "Reply to Priya drafted", pill: { label: "Review", tone: "neutral" } },
        ],
      },
    ],
  },
  demo: { title: "Deal Desk · Today", src: ROUTES.today(), caption: "The live product: Saurabh’s Today, with the agents mid-run." },
  features: {
    eyebrow: "What the agents do",
    title: { before: "Every step visible, every call ", accent: "yours" },
    sub: "The same rows, pills and live steps your team works in, doing the legwork across inbound, diligence, meetings and IC.",
    items: [
      {
        id: "triage", kind: "triage", title: "Inbound triage",
        body: "Every deck read, enriched and scored against your thesis before you open your inbox.",
        link: { id: "open", label: "Open Today", href: ROUTES.today() },
        head: "13 new decks triaged",
        counts: [{ label: "4 fit", tone: "ok" }, { label: "9 pass", tone: "neutral" }],
        rows: [
          { id: "keel", company: keel, title: "Keel", sub: "Repeat founder", ...fitOf("keel"), pill: { label: "Book call", tone: "ink" } },
          { id: "ledgerly", company: ledgerly, title: "Ledgerly", sub: "Hiring fast", ...fitOf("ledgerly"), pill: { label: "Screening", tone: "warn" } },
          { id: "harbor", company: harbor, title: "Harbor AI", sub: "Early revenue", ...fitOf("harbor"), pill: { label: "Claim", tone: "neutral" } },
          { id: "tallow", company: tallow, title: "Tallow", sub: "Outside thesis", ...fitOf("tallow"), pill: { label: "Passed", tone: "neutral" } },
        ],
      },
      {
        id: "diligence", kind: "diligence", title: "Diligence, powered by Crustdata",
        body: "Headcount, hiring, founders and traffic pulled live from Crustdata and weighed into a fit score you can trace.",
        link: { id: "open", label: "Open Helio’s signals", href: `${ROUTES.deal("helio")}&tab=signals` },
        company: { ...helio, ...sg.company }, domain: sg.company.domain, provider: "crustdata", asOf: `updated ${sg.requestedAgo}`, calls: `${sg.calls.length} live calls`,
        signals: graph, weights, fit: helioFit, fitLabel: sg.fit.bands[fitBand(helioFit)], recommendation: sg.fit.recommendation.label,
      },
      {
        id: "meetings", kind: "meetings", title: "Meetings and prep",
        body: "Founder calls booked into slots where everyone is free, with a prep brief waiting before you join.",
        link: { id: "open", label: "Open the invite", href: `${ROUTES.today()}?meet=1` },
        company: keel, meeting: keelCall.title, fit: keelCall.fitScore ?? row("keel").fit.score, found: "Found 3 slots where all of you are free",
        slots: keelCall.slots.map((x) => ({ id: x.id, label: `${x.day} · ${x.time}`, sub: x.note ?? "" })),
        slot: keelCall.slot, other: "Other time", durations: keelCall.durations, duration: keelCall.duration,
        people: keelCall.people.map((x) => ({ initials: x.initials, name: x.name, role: x.role })),
        meetLink: keelCall.meetLink,
        prep: { label: "Prep brief ready", sub: "6 questions, 3 from Crustdata signals" },
        send: "Send invite", sent: "Invite sent",
      },
      {
        id: "agents", kind: "agent", title: "Agent flow, live",
        body: "Watch each agent work step by step. Nothing reaches a founder until you approve it.",
        link: { id: "open", label: "See how the agent works", href: ROUTES.agentFlow("inbound") },
        run: "Inbound triage · Keel", startedAt: "08:12",
        steps: [
          { id: "email", label: "Read pitch email", sub: "Gmail · deck attached", tool: "gmail", state: "done" },
          { id: "enrich", label: "Enrich via Crustdata", sub: "6 calls · 214 fields", tool: "crustdata", state: "done" },
          { id: "score", label: "Score against Fund III", sub: `Fit ${row("keel").fit.score} · ${sg.fit.bands[fitBand(row("keel").fit.score)].toLowerCase()}`, state: "running" },
          { id: "reply", label: "Draft reply and book call", sub: "Waits for your approval", tool: "calendar", state: "queued" },
        ],
        gate: { label: "You approve", sub: "before anything is sent" },
      },
    ],
  },
  closing: {
    title: { before: "Every deal, ", accent: "decided", after: " faster" },
    sub: "Bring your inbound, your thesis and your calendar. The agents start on day one.",
    placeholder: "Work email",
    cta: "Request access",
    done: "Thanks. We’ll write to {email} within a day.",
  },
  footer: "© 2026 Deal Desk",
};
attachLogos(landing);
