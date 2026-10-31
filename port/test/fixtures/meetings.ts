/** v3.2 · Meetings, founder calls and the just-in-time connect, all pre-filled by agents. */
import type { BookCallData, ConnectAsk, MeetingItem, MeetPerson } from "../types";
import { ROUTES } from "../routes";

const saurabh: MeetPerson = { name: "Saurabh Gupta", email: "saurabh@northbeam.vc", role: "Partner", initials: "SG" };
const maya: MeetPerson = { name: "Maya Kapoor", email: "maya@northbeam.vc", role: "Associate", initials: "MK" };
const ravi: MeetPerson = { name: "Ravi Menon", email: "ravi@keel.finance", role: "Founder & CEO", initials: "RM", from: "From email thread" };
const ananya: MeetPerson = { name: "Ananya Rao", email: "ananya@heliosensors.in", role: "Founder & CEO", initials: "AR" };

export const calendarAsk: ConnectAsk = {
  tool: "calendar", title: "Calendar access needed",
  why: "To book the Keel intro call, the inbound agent needs to see when you and Maya are free.",
  allowLabel: "Allow access to Calendar", scope: "You can revoke it any time in Settings › Connectors",
  scopes: [{ label: "See free/busy", detail: "yours and Maya’s, never event details" }, { label: "Create events", detail: "only invites you send from Deal Desk" }],
  step: "Book Keel intro call",
};
export const connectAsks: Record<string, ConnectAsk> = {
  calendar: calendarAsk,
  slack: { tool: "slack", title: "Slack access needed", why: "To post Keel’s fit summary in #deal-flow so Maya can claim it.", allowLabel: "Allow access to Slack", scope: "You can revoke it any time in Settings › Connectors",
    scopes: [{ label: "Post messages", detail: "only in #deal-flow" }, { label: "Read replies", detail: "to the posts it makes" }], step: "Share Keel in #deal-flow" },
  gmail: { tool: "gmail", title: "Gmail access needed", why: "To draft a reply to Ravi in your voice. Nothing sends without you.", allowLabel: "Allow access to Gmail", scope: "You can revoke it any time in Settings › Connectors",
    scopes: [{ label: "Read the Keel thread", detail: "and other founder threads" }, { label: "Create drafts", detail: "you review and send" }], step: "Draft reply to Ravi" },
  crustdata: { tool: "crustdata", title: "Connect Crustdata", why: "To check Keel’s headcount and funding before the call.", allowLabel: "Connect Crustdata", scope: "Uses your firm’s Crustdata API key",
    scopes: [{ label: "Company and people lookups", detail: "headcount, funding, hires" }], step: "Enrich Keel" },
};

export const keelCall: BookCallData = {
  company: { id: "keel", name: "Keel", initial: "K", line: "Startup treasury", stage: "Seed", sector: "Fintech · treasury", ask: "$2.5M" },
  fit: ["B2B fintech", "India + US", "Repeat founder"],
  fitScore: 88, fitSignals: [{ label: "headcount +38% 6mo", effect: "up" }, { label: "ex-Stripe founder", effect: "up" }],
  round: ["Seed", "$2.5M", "No lead yet"],
  title: "Keel × Northbeam Ventures — intro call",
  slots: [
    { id: "s1", day: "Tue 3 Nov", time: "4:30 pm", note: "Everyone free" },
    { id: "s2", day: "Wed 4 Nov", time: "11:00 am", note: "Ravi’s preferred" },
    { id: "s3", day: "Thu 5 Nov", time: "5:00 pm", note: "After IC" },
  ],
  slot: "s1", durations: [30, 45, 60], duration: 30,
  meetLink: "meet.google.com/kqe-trzb-wno",
  people: [ravi, saurabh, maya],
  agenda: ["Ravi on Keel, and who pays today", "Why treasury teams switch from banks", "The $2.5M seed: use of funds and lead"],
  origin: "Filled in by the inbound agent from Ravi’s email",
  conflict: { with: "Helio IC prep", clash: "Tue 3 Nov · 3:00 pm", found: "All three keep Ravi, Maya and you free.", slots: ["s1", "s2", "s3"] },
  otherHint: "Fri 6 Nov, 2:00 pm",
};

export const nextMeetings: MeetingItem[] = [
  { id: "m1", kind: "ic", title: "IC · Helio Sensors", day: "Today", time: "3:00 pm", duration: "45 min", company: { id: "helio", name: "Helio Sensors", initial: "H", line: "Industrial IoT · Seed", dark: true }, founder: ananya, people: [saurabh, maya, { name: "Dana Whitfield", email: "dana@northbeam.vc", role: "Partner", initials: "DW" }], agenda: ["Growth: 22% a month verified, not 40%", "Valuation at $11M cap", "Vote"], meetLink: "meet.google.com/hlo-icxv-thu", prep: { label: "Helio IC memo · draft 3", pages: 6, ready: true, href: ROUTES.memo("helio") }, href: ROUTES.memo("helio") },
  { id: "m2", kind: "founder", title: "Keel intro call", day: "Tue 3", time: "4:30 pm", duration: "30 min", company: { id: "keel", name: "Keel", initial: "K", line: "Startup treasury · Seed" }, founder: ravi, people: [ravi, saurabh, maya], agenda: keelCall.agenda, meetLink: keelCall.meetLink, prep: { label: "Keel prep brief", pages: 2, ready: false } },
  { id: "m3", kind: "founder", title: "Ledgerly · partner meeting", day: "Wed 4", time: "11:00 am", duration: "60 min", company: { id: "ledgerly", name: "Ledgerly", initial: "L", line: "AP automation · Series A" }, founder: { name: "Priya Shah", email: "priya@ledgerly.io", role: "Founder", initials: "PS" }, people: [saurabh], agenda: ["Product demo", "Hiring plan", "Terms"], meetLink: "meet.google.com/ldg-prtn-wed", prep: { label: "Ledgerly prep brief", pages: 3, ready: true } },
  { id: "m4", kind: "board", title: "Corvid board", day: "Thu 12", time: "10:00 am", duration: "90 min", company: { id: "corvid", name: "Corvid", initial: "C", line: "Portfolio · 8.4 mo runway" }, people: [saurabh], agenda: ["Bridge ask: $3M SAFE", "Burn plan"], meetLink: "meet.google.com/crv-brd-thu", prep: { label: "Corvid board prep", pages: 4, ready: true, href: ROUTES.portfolio } },
];
