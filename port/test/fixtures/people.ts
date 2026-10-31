/**
 * v4 · Person / founder pages (/person?id=). Company facts are pulled from the fixtures the rest of the app uses
 * (Today's work rows, the Pipeline table, Helio's valuation, Next meetings), so a deal reads the same everywhere.
 * The queue ("1 of 4 · Waiting on you") is built from the people listed here, so prev/next always resolve.
 */
import type { BookCallData, MeetingItem, PersonChip, PersonData, PersonRef, PipelineDeal } from "../types";
import { keelCall, nextMeetings } from "./meetings";
import { workRows } from "./todaysummary";
import { pipelineDeals, stages } from "./pipeline";
import { helioCo, helioValuation } from "./helio";

const saurabh: PersonRef = { id: "u_sg", initials: "SG", name: "Saurabh Gupta", title: "Partner" };
const maya: PersonRef = { id: "u_mk", initials: "MK", name: "Maya Kapoor", title: "Associate" };
const priya: PersonRef = { id: "u_ps", initials: "PS", name: "Priya Shah", title: "Partner" };
const arjun: PersonRef = { id: "u_ar", initials: "AR", name: "Arjun Rao", title: "Principal" };
const ananya: PersonRef = { id: "ananya-rao", initials: "AR", name: "Ananya Rao", title: "Founder & CEO" };
const ravi: PersonRef = { id: "ravi-menon", initials: "RM", name: "Ravi Menon", title: "Founder & CEO" };

const crust = (label: string, asOf = "updated 2h ago") => ({ kind: "crust" as const, label, provider: "crustdata" as const, asOf });

/* ── company facts from the rest of the app ── */
const WORK_STAGE: Record<string, PersonChip> = { new: { label: "New" }, screening: { label: "Screening", tone: "warn" }, diligence: { label: "Diligence", tone: "rust" }, ic: { label: "IC", tone: "ink" } };
/** Stage, fit and owner as Today's work list shows them. */
function fromWork(companyId: string) {
  const r = workRows.find((w) => w.company.id === companyId);
  if (!r) throw new Error(`people: no work row for ${companyId}`);
  return { stage: WORK_STAGE[r.stage], fit: { score: r.fit.score, signals: r.fit.signals }, owner: r.owner };
}
/** Stage, fit, owner and next step as the Pipeline table shows them. */
function fromPipeline(dealId: string) {
  const d = pipelineDeals.find((x) => x.id === dealId) as PipelineDeal | undefined;
  if (!d) throw new Error(`people: no pipeline deal ${dealId}`);
  const st = stages.find((s) => s.id === d.stage);
  return {
    stage: { label: st?.short ?? st?.label ?? d.stage, tone: st?.tone } as PersonChip,
    fit: { score: Math.round(d.thesisFit * 100), signals: d.fitSignals },
    owner: d.ownerName ? { initials: d.owner, name: d.ownerName } : undefined,
    next: d.nextDate ? { label: d.nextStep, when: d.nextDate.label } : undefined,
    lastTouched: d.lastTouch.label,
  };
}
/** The deal's next meeting from Today's "Next meetings". */
function meetingFor(companyId: string, label: string): PersonData["next"] {
  const m: MeetingItem | undefined = nextMeetings.find((x) => x.company?.id === companyId);
  return m && { label, when: `${m.day}, ${m.time}`, detail: m.duration, href: m.prep?.href };
}

/** A founder-call invite in the shared book-call shape (same partner + associate as the Keel and Helio invites). */
function inviteFor(f: { name: string; email: string; initials: string; first: string }, c: { id: string; name: string; initial: string; line: string; dark?: boolean; logoUrl?: string; domain?: string }, o: { stage: string; sector: string; ask: string; fit: string[]; topic: string; agenda: string[] }): BookCallData {
  return {
    company: { ...c, stage: o.stage, sector: o.sector, ask: o.ask }, fit: o.fit,
    title: `${c.name} × Northbeam Ventures — ${o.topic}`,
    slots: [{ id: "s1", day: "Mon 2 Nov", time: "4:00 pm", note: "Everyone free" }, { id: "s2", day: "Tue 3 Nov", time: "10:30 am", note: `${f.first}’s preferred` }, { id: "s3", day: "Wed 4 Nov", time: "6:00 pm", note: "After partner sync" }],
    slot: "s1", durations: [30, 45, 60], duration: 30, meetLink: `meet.google.com/${c.id.slice(0, 3)}-${o.topic.slice(0, 4).toLowerCase()}-mon`,
    people: [{ name: f.name, email: f.email, role: "Founder & CEO", initials: f.initials, from: "From email thread" }, { name: saurabh.name, email: "saurabh@northbeam.vc", role: "Partner", initials: saurabh.initials }, { name: maya.name, email: "maya@northbeam.vc", role: "Associate", initials: maya.initials }],
    agenda: o.agenda, origin: `From ${f.name}’s page · Book meeting`,
  };
}

/* ── Ananya Rao · Helio Sensors (the hero) ── */
const helio = fromWork(helioCo.id);
const helioRound = `$1.5M seed · $${helioValuation.cap}${helioValuation.unit} ${helioValuation.basis === "pre-money" ? "pre" : "EV"}`;

const helioCall: BookCallData = {
  company: { ...helioCo, line: "Industrial IoT sensors", stage: "Seed", sector: "Industrial IoT", ask: "$1.5M" },
  fit: ["Industrial IoT", "Seed", "Pune", "Ex-Bosch IoT lead"],
  title: "Helio Sensors × Northbeam Ventures — growth follow-up",
  slots: [
    { id: "s1", day: "Mon 2 Nov", time: "11:00 am", note: "Everyone free" },
    { id: "s2", day: "Tue 3 Nov", time: "2:00 pm", note: "Ananya’s preferred" },
    { id: "s3", day: "Wed 4 Nov", time: "5:30 pm", note: "After partner sync" },
  ],
  slot: "s1", durations: [30, 45, 60], duration: 45,
  meetLink: "meet.google.com/hlo-grwt-mon",
  people: [
    { name: ananya.name, email: "ananya@heliosensors.in", role: "Founder & CEO", initials: ananya.initials, from: "From email thread" },
    { name: saurabh.name, email: "saurabh@northbeam.vc", role: "Partner", initials: saurabh.initials },
    { name: maya.name, email: "maya@northbeam.vc", role: "Associate", initials: maya.initials },
  ],
  agenda: ["Growth: why the deck says 40% a month", "Plants after the pilot: what they pay", `Round: ${helioRound}`, "Next steps"],
  origin: "From Ananya Rao’s page · Book meeting",
};

const personAnanya0: Omit<PersonData, "queue"> = {
  id: "ananya-rao",
  person: { ...ananya, email: "ananya@heliosensors.in", location: "Pune, India", linkedin: "linkedin.com/in/ananya-rao" },
  company: { ...helioCo, line: "Industrial IoT sensors · Seed", dealId: helioCo.id },
  relationship: { label: "Engaged", tone: "ok" },
  stage: helio.stage,
  status: { label: "At risk", tone: "rust" },
  fit: helio.fit,
  owner: helio.owner,
  lastTouched: "2 hours ago",
  round: helioRound,
  next: meetingFor(helioCo.id, "IC vote"),
  details: [
    { k: "Role", v: "Founder & CEO" },
    { k: "Location", v: "Pune, India" },
    { k: "Sourced via", v: "Inbound · Gmail pitch@" },
    { k: "Background", v: "Ex-Bosch · IIT Bombay" },
  ],
  team: [
    { role: "Lead partner", person: saurabh },
    { role: "Associate", person: maya },
    { role: "IC partner", person: priya },
    { role: "Diligence", agent: "Diligence agent" },
  ],
  insights: {
    status: { label: "Needs you", tone: "rust" },
    summary: "Credible IoT operator; growth is real but about half the deck’s claim. IC votes today at 3 pm.",
    points: ["11 yrs in IoT, last as Bosch’s IoT platforms lead", "22% a month verified, deck says 40%", "Headcount 22 → 31 in six months"],
    sources: [crust("experience.employment_details.past"), { kind: "bank", label: "HDFC deposits" }],
    updated: "Updated 2h ago",
  },
  nestedPreview: 3,
  book: helioCall,
  waitingFor: "IC vote today",
  email: { subject: "Data room + two growth questions", body: "Hi Ananya,\n\nThanks for sharing the HDFC statements. Before today’s IC, two quick questions:\n\n1. Which plants are paid today vs still in pilot?\n2. What drove the 40% month in the deck?\n\nBest,\nSaurabh", by: "Drafted by the inbound agent · held for you" },
  groups: [
    {
      id: "week", label: "This week", events: [
        { id: "a1", kind: "signal", when: "Today, 9:12 am", by: { agent: "Diligence agent" }, agentMark: "escalated", text: [{ t: "raised a diligence alert on " }, { t: "Helio Sensors", b: true }],
          alert: {
            title: "Claimed growth mismatch",
            sources: [{ kind: "bank", label: "HDFC deposits · Jul–Oct" }, crust("headcount.timeseries")],
            actions: [
              { id: "verify", label: "Verify with founder", kind: "compose", draft: { subject: "Quick check on growth before today’s IC", body: "Hi Ananya,\n\nBefore the IC at 3 pm: the deck shows 40% month on month, while HDFC deposits for Jul–Oct show about 22%. Could you walk us through the gap? Paid plants vs pilots would help most.\n\nThanks,\nSaurabh", by: "Drafted by the diligence agent from the alert" } },
              { id: "raw", label: "Request raw data", kind: "request", toast: "Request drafted · held for you" },
            ],
          },
          change: { from: { label: "Deck 40% MoM" }, to: { label: "Verified 22% MoM", tone: "rust" } } },
        { id: "a2", kind: "signal", when: "Yesterday, 2:35 pm", by: { agent: "Diligence agent" }, text: [{ t: "enriched " }, { t: "Ananya Rao", b: true }, { t: " and " }, { t: "Helio Sensors", b: true }, { t: " from Crustdata" }],
          children: [
            { id: "a2a", kind: "signal", when: "2:35 pm", by: { agent: "Diligence agent" }, text: [{ t: "Past role: " }, { t: "Bosch", b: true }, { t: ", Lead, IoT Platforms · 11 yrs" }], source: crust("experience.employment_details.past") },
            { id: "a2b", kind: "signal", when: "2:36 pm", by: { agent: "Diligence agent" }, text: [{ t: "Headcount" }], change: { from: { label: "22" }, to: { label: "31", tone: "ok" }, note: "in 6 months" }, source: crust("headcount.timeseries") },
            { id: "a2c", kind: "signal", when: "2:36 pm", by: { agent: "Diligence agent" }, text: [{ t: "Hiring " }, { t: "9 roles", b: true }, { t: ", 6 in engineering" }], source: crust("job_listings[].job_details.category") },
            { id: "a2d", kind: "fit", when: "2:38 pm", by: { agent: "Diligence agent" }, text: [{ t: "Fit moved" }], change: { from: { label: "Fit 64", tone: "warn" }, to: { label: `Fit ${helio.fit.score}`, tone: "ok" } } },
          ] },
        { id: "a3", kind: "stage", when: "Yesterday, 6:40 pm", by: { person: saurabh }, text: [{ t: "moved " }, { t: "Helio Sensors", b: true }, { t: " from" }],
          change: { from: { label: "Screening", tone: "warn" }, to: helio.stage, note: "after the founder call" } },
        { id: "a4", kind: "email", when: "Thu, 11:20 am", by: { agent: "Inbound agent" }, agentMark: "drafted", text: [{ t: "drafted a reply: " }, { t: "“Growth figures + data room”", b: true }], source: { kind: "mail", label: "Gmail · held for you" } },
        { id: "a5", kind: "note", when: "Wed, 5:05 pm", by: { person: maya }, text: [{ t: "added a note: " }, { t: "“14 paying plants; Ananya knows the buyer cold.”", b: true }] },
        { id: "a6", kind: "file", when: "Wed, 10:02 am", by: { person: ananya }, text: [{ t: "shared " }, { t: "HDFC_statements_Jul-Oct.pdf", b: true }], source: { kind: "pdf", label: "Data room" } },
        { id: "a7", kind: "meeting", when: "Tue, 4:30 pm", by: { person: saurabh }, text: [{ t: "held a founder call with " }, { t: "Ananya", b: true }, { t: " · 45 min" }], source: { kind: "cal", label: "Google Calendar" } },
      ],
    },
    {
      id: "history", label: "History", events: [
        { id: "h1", kind: "stage", when: "14 Oct 2026, 9:02 am", by: { agent: "Inbound agent" }, text: [{ t: "moved " }, { t: "Helio Sensors", b: true }, { t: " from" }],
          change: { from: { label: "New" }, to: { label: "Screening", tone: "warn" }, note: "fits Seed B2B" } },
        { id: "h2", kind: "claim", when: "13 Oct 2026, 9:14 am", by: { person: saurabh }, text: [{ t: "took the lead on " }, { t: "Helio Sensors", b: true }] },
        { id: "h3", kind: "signal", when: "13 Oct 2026, 9:12 am", by: { agent: "Inbound agent" }, text: [{ t: "matched " }, { t: "Ananya Rao", b: true }, { t: " to a Crustdata profile" }], source: crust("basic_profile.current_title", "13 Oct") },
        { id: "h4", kind: "email", when: "13 Oct 2026, 8:02 am", by: { person: ananya }, text: [{ t: "sent the pitch " }, { t: "“Helio Sensors — $1.5M seed”", b: true }, { t: " to pitch@" }], source: { kind: "deck", label: "Helio_deck.pdf" } },
      ],
    },
  ],
};

/* ── Mo Haddad · Vantage, and Ana Ruiz · NexaFlow (the rest of the diligence queue) ── */
const vantage = fromPipeline("vantage");
const vantageCo = pipelineDeals.find((d) => d.id === "vantage")!.company;
const personMo0: Omit<PersonData, "queue"> = {
  id: "mo-haddad",
  person: { id: "mo-haddad", initials: "MH", name: "Mo Haddad", title: "Founder & CEO", email: "mo@vantagetrials.com", location: "Boston, US" },
  company: { ...vantageCo, line: "Clinical trial data · Seed" },
  relationship: { label: "Engaged", tone: "ok" },
  stage: vantage.stage,
  status: { label: "Watch", tone: "warn" },
  fit: vantage.fit,
  owner: vantage.owner,
  lastTouched: vantage.lastTouched,
  round: "$2M seed",
  next: vantage.next,
  details: [{ k: "Role", v: "Founder & CEO" }, { k: "Location", v: "Boston, US" }, { k: "Sourced via", v: "Founder outreach" }],
  team: [{ role: "Lead", person: arjun }, { role: "Partner", person: saurabh }, { role: "Diligence", agent: "Diligence agent" }],
  book: inviteFor({ name: "Mo Haddad", email: "mo@vantagetrials.com", initials: "MH", first: "Mo" }, { ...vantageCo, line: "Clinical trial data" }, { stage: "Seed", sector: "Clinical trial data", ask: "$2M", fit: ["Health data", "Seed", "US"], topic: "regulatory path", agenda: ["FDA pathway: what is still open", "Two senior exits: who replaces them", "Model review next steps"] }),
  waitingFor: "Questions to approve",
  email: { subject: "Regulatory path: three questions", body: "Hi Mo,\n\nAhead of Wednesday’s model review, could you share where the FDA pathway stands, and who covers the two roles that opened up this quarter?\n\nBest,\nSaurabh", by: "Drafted by the diligence agent · held for you" },
  insights: {
    status: { label: "Watch", tone: "warn" },
    summary: "Traffic is climbing, but two senior people left in 90 days and the FDA pathway is still open.",
    points: ["Web traffic +22% in 3 months", "2 senior exits in 90 days", "Model review on Wed 4 Nov"],
    sources: [crust("people.departures", "updated 4d ago")],
    updated: "Updated 4 days ago",
  },
  nestedPreview: 3,
  groups: [
    { id: "week", label: "This week", events: [
      { id: "v1", kind: "signal", when: "Mon, 8:40 am", by: { agent: "Diligence agent" }, agentMark: "escalated", text: [{ t: "flagged " }, { t: "2 senior exits", b: true }, { t: " in 90 days" }], source: crust("people.departures", "updated 4d ago") },
      { id: "v2", kind: "email", when: "Mon, 9:05 am", by: { agent: "Diligence agent" }, agentMark: "drafted", text: [{ t: "drafted questions to " }, { t: "Mo", b: true }, { t: " on the regulatory path" }], source: { kind: "mail", label: "Gmail · held for you" } },
    ] },
    { id: "history", label: "History", events: [
      { id: "v3", kind: "stage", when: "21 Oct 2026, 4:10 pm", by: { person: arjun }, text: [{ t: "moved " }, { t: "Vantage", b: true }, { t: " from" }], change: { from: { label: "Partner mtg", tone: "warn" }, to: vantage.stage } },
      { id: "v4", kind: "meeting", when: "20 Oct 2026, 11:00 am", by: { person: saurabh }, text: [{ t: "held a partner meeting with " }, { t: "Mo", b: true }, { t: " · 60 min" }], source: { kind: "cal", label: "Google Calendar" } },
    ] },
  ],
};

const nexa = fromPipeline("nexaflow");
const nexaCo = pipelineDeals.find((d) => d.id === "nexaflow")!.company;
const personAna0: Omit<PersonData, "queue"> = {
  id: "ana-ruiz",
  person: { id: "ana-ruiz", initials: "AR", name: "Ana Ruiz", title: "Founder & CEO", email: "ana@nexaflow.io", location: "London, UK" },
  company: { ...nexaCo, line: "Month-end close · Series A", dealId: nexaCo.id },
  relationship: { label: "Warm", tone: "ok" },
  stage: nexa.stage,
  status: { label: "On track", tone: "ok" },
  fit: nexa.fit,
  owner: nexa.owner,
  lastTouched: nexa.lastTouched,
  round: "$8M Series A",
  next: nexa.next,
  details: [{ k: "Role", v: "Founder & CEO" }, { k: "Location", v: "London, UK" }, { k: "Sourced via", v: "Direct" }],
  team: [{ role: "Lead partner", person: saurabh }, { role: "Associate", person: maya }, { role: "Memo", agent: "IC memo agent" }],
  book: inviteFor({ name: "Ana Ruiz", email: "ana@nexaflow.io", initials: "AR", first: "Ana" }, { ...nexaCo, line: "Month-end close" }, { stage: "Series A", sector: "Finance ops", ask: "$8M", fit: ["Finance ops", "Series A", "ARR verified"], topic: "pre-IC call", agenda: ["ARR bridge to $14.6M", "Hiring plan for 2027", "Terms and timing"] }),
  waitingFor: "Memo to sign off",
  email: { subject: "IC on Monday: next steps", body: "Hi Ana,\n\nThe memo is with the partners and the IC vote is Monday 2 Nov. I’ll send an update the same afternoon.\n\nBest,\nSaurabh", by: "Drafted by the IC memo agent · held for you" },
  insights: {
    status: { label: "On track", tone: "ok" },
    summary: "ARR verified at $14.6M; hiring three times faster than peers. Memo is ready for the IC vote.",
    points: ["Headcount +41% in 12 months", "Engineering hiring 3× peers", "IC vote Mon 2 Nov"],
    sources: [crust("headcount.growth_percent.yoy", "updated today")],
    updated: "Updated today",
  },
  nestedPreview: 3,
  groups: [
    { id: "week", label: "This week", events: [
      { id: "n1", kind: "file", when: "Today, 7:30 am", by: { agent: "IC memo agent" }, agentMark: "drafted", text: [{ t: "drafted the " }, { t: "IC memo", b: true }, { t: " · 31 citations" }], source: { kind: "memo", label: "IC memo · draft 2" } },
      { id: "n2", kind: "stage", when: "Today, 2:14 am", by: { agent: "Diligence agent" }, text: [{ t: "moved " }, { t: "NexaFlow", b: true }, { t: " from" }], change: { from: { label: "Partner mtg", tone: "warn" }, to: nexa.stage } },
    ] },
    { id: "history", label: "History", events: [
      { id: "n3", kind: "meeting", when: "22 Oct 2026, 3:00 pm", by: { person: saurabh }, text: [{ t: "held a partner meeting with " }, { t: "Ana", b: true }, { t: " · 60 min" }], source: { kind: "cal", label: "Google Calendar" } },
    ] },
  ],
};

/* ── Ravi Menon · Keel (New) ── */
const keel = fromWork("keel");
const personRavi0: Omit<PersonData, "queue"> = {
  id: "ravi-menon",
  person: { ...ravi, email: "ravi@keel.finance", location: "Bengaluru, India", linkedin: "linkedin.com/in/ravimenon" },
  company: { id: "keel", name: "Keel", initial: "K", line: "Startup treasury · Seed" },
  relationship: { label: "Cold inbound", tone: "neutral" },
  stage: keel.stage,
  status: { label: "New", tone: "neutral" },
  fit: keel.fit,
  owner: keel.owner,
  lastTouched: "Yesterday",
  round: `${keelCall.company.ask} seed`,
  next: meetingFor("keel", "Intro call"),
  details: [
    { k: "Role", v: "Founder & CEO" },
    { k: "Location", v: "Bengaluru, India" },
    { k: "Sourced via", v: "Inbound · pitch@" },
  ],
  team: [{ role: "Sourced by", agent: "Inbound agent" }, { role: "Partner", person: saurabh }, { role: "Associate", person: maya }],
  insights: {
    status: { label: "Strong fit", tone: "ok" },
    summary: "Repeat fintech founder; B2B treasury fits the seed thesis. The intro call is on the calendar.",
    points: ["Ex-Stripe, second company", "Headcount +38% in 6 months", `Asks ${keelCall.company.ask}; no lead yet`],
    sources: [crust("experience.employment_details.past", "updated yesterday"), { kind: "deck", label: "Keel_seed_deck.pdf" }],
    updated: "Updated yesterday",
  },
  nestedPreview: 3,
  book: keelCall,
  waitingFor: "Reply to approve",
  email: { subject: "Re: Keel — treasury for startups", body: "Hi Ravi,\n\nThanks for sending Keel over. We’d love to learn more; does Tue 3 Nov at 4:30 pm work for a 30-minute intro?\n\nBest,\nSaurabh", by: "Drafted by the inbound agent · held for you" },
  groups: [
    {
      id: "week", label: "This week", events: [
        { id: "r1", kind: "email", when: "Yesterday, 4:12 pm", by: { agent: "Inbound agent" }, agentMark: "drafted", text: [{ t: "drafted a reply to " }, { t: "Ravi", b: true }, { t: " with three call slots" }], source: { kind: "mail", label: "Gmail · held for you" } },
        { id: "r2", kind: "signal", when: "Yesterday, 4:05 pm", by: { agent: "Inbound agent" }, text: [{ t: "enriched " }, { t: "Ravi Menon", b: true }, { t: " from Crustdata" }],
          children: [
            { id: "r2a", kind: "signal", when: "4:05 pm", by: { agent: "Inbound agent" }, text: [{ t: "Past role: " }, { t: "Stripe", b: true }, { t: ", treasury product" }], source: crust("experience.employment_details.past", "updated yesterday") },
            { id: "r2b", kind: "signal", when: "4:05 pm", by: { agent: "Inbound agent" }, text: [{ t: "Headcount " }, { t: "+38%", b: true }, { t: " in 6 months" }], source: crust("headcount.growth_percent.six_months", "updated yesterday") },
            { id: "r2c", kind: "fit", when: "4:06 pm", by: { agent: "Inbound agent" }, text: [{ t: "Scored fit" }], change: { from: { label: "Unscored" }, to: { label: `Fit ${keel.fit.score}`, tone: "ok" } } },
          ] },
        { id: "r3", kind: "email", when: "Thu, 8:02 am", by: { person: ravi }, text: [{ t: "sent the pitch " }, { t: "“Keel — treasury for startups”", b: true }, { t: " to pitch@" }], source: { kind: "deck", label: "Keel_seed_deck.pdf" } },
      ],
    },
    { id: "history", label: "History", events: [] },
  ],
};

/** Queue navigation built from the people in the same stage, so "1 of N" and prev/next always resolve. */
function queued(label: string, list: Omit<PersonData, "queue">[]): PersonData[] {
  return list.map((p, i) => ({ ...p, queue: { label, index: i + 1, total: list.length, prevId: list[i - 1]?.id, nextId: list[i + 1]?.id } }));
}
/** One queue across stages, in the order they need you. */
export const [personAnanya, personRavi, personAna, personMo] = queued("Waiting on you", [personAnanya0, personRavi0, personAna0, personMo0]);

export const people: Record<string, PersonData> = Object.fromEntries([personAnanya, personMo, personAna, personRavi].map((p) => [p.id, p]));
/** Old links keep working. */
export const personAliases: Record<string, string> = { "alex-rao": "ananya-rao" };
export const personById = (id?: string): PersonData => people[(id && personAliases[id]) || id || ""] ?? personAnanya;