import type { OutboundItem, TodayData } from "../../src/types";

const nexa = { id: "nexaflow", name: "NexaFlow", initial: "N", dark: true };

/** GET /api/today?mode=invest  @assumed route — see PORTING.md */
export const todayInvest: TodayData = {
  mode: "invest",
  dateLabel: "Friday 30 October",
  greeting: "Good morning, Saurabh.",
  needYou: 2,
  doneWithoutYou: { count: 37, breakdown: "48 inbound read · 12 screened · 31 files checked · 4 replies drafted", batchId: "batch_2026-10-30" },
  eveningBrief: "18:30",
  briefSent: { at: "08:00", channels: "Gmail + Slack" },
  pulse: [
    { id: "p_pipe", label: "Active pipeline", value: "25", unit: "deals", delta: { label: "+4 wk", tone: "ok" }, note: "+4 this week · 3 at IC or later", viz: { kind: "bars", d: [3, 4, 2, 5, 3, 6, 4, 7], hl: 7 } },
    { id: "p_ic", label: "NexaFlow IC · Mon", value: "3", unit: "of 4 ready", delta: { label: "1 left", tone: "neutral" }, note: "Memo, model, refs · ARR bridge left", viz: { kind: "gauge", v: 0.75, center: "3/4" } },
    { id: "p_saved", label: "Time saved · week", value: "21.5", unit: "h", delta: { label: "+3.5 h", tone: "ok" }, note: "37 tasks overnight · 0 sent without you", tone: "ok", viz: { kind: "spark", d: [9, 12, 11, 15, 14, 18, 21.5] } },
    { id: "p_run", label: "Runway alert", value: "8.4", unit: "mo", delta: { label: "−0.8 mo", tone: "rust" }, note: "Corvid · below the 9 mo line", tone: "rust", viz: { kind: "spark", d: [14, 13, 12.2, 11, 10.1, 9.2, 8.4] } },
  ],
  ask: { placeholder: "Ask about your deals…", chips: ["What changed at NexaFlow?", "Who knows Leo Park?", "Portfolio cash needs 2027"] },
  decisions: [
    {
      id: "dc_arr", kind: "arrGap", company: nexa, tag: { label: "ARR gap", tone: "rust" }, time: "06:12",
      title: { pre: "ARR is ", hl: "$14.6M", post: ", not $18.2M" },
      bridge: [
        { label: "Oct update", value: 19.1, kind: "ghost" },
        { label: "Deck", value: 18.2, kind: "start" },
        { label: "Prepaid", value: 2.1, kind: "down" },
        { label: "Not live", value: 1.0, kind: "down" },
        { label: "Churned", value: 0.5, kind: "down" },
        { label: "Verified", value: 14.6, kind: "end" },
      ],
      action: { id: "open_arr_bridge", label: "Open ARR bridge" },
      sources: [
        { kind: "xlsx", label: "model.xlsx · row 18", excerpt: { where: "model.xlsx › ARR › row 18", quote: "3-year prepaid contracts booked as 3× ARR in Q3. Adjusted ARR: $14.6M.", highlight: "Adjusted ARR: $14.6M" } },
        { kind: "pdf", label: "CIM p.42" },
      ],
    },
    {
      id: "dc_team", kind: "personMove", company: nexa, tag: { label: "Team", tone: "warn" }, time: "05:48",
      title: { pre: "Head of engineering left" },
      person: { initials: "JL", name: "Jordan Lee", title: "Head of engineering" },
      to: { id: "stripe", name: "Stripe", initial: "S" },
      date: "9 Oct",
      metric: { label: "Engineers", before: "48", after: "44", trend: [41, 43, 45, 47, 48, 48, 46, 44] },
      action: { id: "add_ic_question", label: "Add to IC questions" },
      sources: [{ kind: "crust", label: "Crustdata" }, { kind: "web", label: "LinkedIn" }],
    },
  ],
  meetings: {
    dayLabel: "Fri 30 Oct", app: "Google Calendar", freeAfter: "17:00",
    items: [
      { id: "m1", time: "10:00", title: "NexaFlow", sub: "Maya Chen", next: true },
      { id: "m2", time: "13:30", title: "Ledgerly intro", sub: "Leo Park" },
      { id: "m3", time: "16:00", title: "Partner meeting", sub: "Monday pipeline" },
    ],
  },
  drafts: {
    app: "Gmail",
    items: [
      { id: "d1", preview: "Maya, before Monday could you send the prepaid schedule behind row 18? We see $14.6M once 3-year deals are spread.", basis: "model.xlsx row 18", to: "Maya Chen", subject: "ARR bridge before Monday", time: "05:41", href: "https://mail.google.com/mail/u/0/#drafts" },
      { id: "d2", preview: "Leo, looking forward to 13:30. Could you share the current cap table ahead of time?", basis: "Calendar · Ledgerly intro", to: "Leo Park", subject: "Re: 13:30 today + cap table", time: "05:43", href: "https://mail.google.com/mail/u/0/#drafts" },
      { id: "d3", preview: "Tom, attaching our bridge terms for Corvid: $1.2M, 20% discount, 9-month maturity.", basis: "Corvid KPIs · Aug", to: "Tom Becker", subject: "Corvid bridge terms", time: "05:46", href: "https://mail.google.com/mail/u/0/#drafts" },
      { id: "d4", preview: "Elena, it’s been a while. Free for coffee next week? Tue or Thu morning works.", basis: "Last touch 94 days ago", to: "Elena Marsh", subject: "Coffee next week?", time: "05:49", href: "https://mail.google.com/mail/u/0/#drafts" },
    ],
  },
  worthALook: {
    sourceNote: "from Crustdata + Gmail + firm brain",
    items: [
      { id: "t_corvid", kind: "runway", company: { id: "corvid", name: "Corvid", initial: "C" }, pill: "Low runway", pillTone: "rust", months: 8.4, trend: [13, 12.1, 11, 9.9, 8.4], link: { label: "Portfolio", href: "/portfolio" }, sources: [{ kind: "xlsx", label: "Aug KPIs" }] },
      { id: "t_pinecrest", kind: "quietContact", company: { id: "pinecrest", name: "Pinecrest", initial: "P" }, title: "Founder gone quiet", activeBars: 5, totalBars: 24, caption: "last reply", value: "19 days", sources: [{ kind: "mail", label: "Gmail" }] },
      { id: "t_closeloop", kind: "secondLook", company: { id: "closeloop", name: "Closeloop", initial: "C" }, pill: "Passed 2024", title: "Worth a second look", before: "$6M", after: "$13M ARR", sources: [{ kind: "crust", label: "Crustdata" }] },
    ],
  },
  closingLine: "That’s everything. Enjoy your morning.",
};

/** GET /api/today?mode=bank — same shape, banker's words and tools. EV only. */
export const todayBank: TodayData = {
  mode: "bank",
  dateLabel: "Friday 30 October",
  greeting: "Good morning, Saurabh.",
  needYou: 2,
  doneWithoutYou: { count: 22, breakdown: "31 Q&A items triaged · 9 buyer logins checked · 4 replies drafted in Outlook", batchId: "batch_bank_2026-10-30" },
  eveningBrief: "18:30",
  briefSent: { at: "08:00", channels: "Outlook + Teams" },
  ask: { placeholder: "Ask about your mandates…", chips: ["Who hasn’t opened the CIM?", "Update football field", "Halyard client update"] },
  decisions: [
    {
      id: "dc_tie", kind: "tieOut", company: { id: "halyard", name: "Project Halyard", initial: "H", dark: true }, tag: { label: "Doesn’t tie out", tone: "rust" }, time: "06:20",
      title: { pre: "FY25 EBITDA is ", hl: "$0.5M", post: " apart, CIM vs model" },
      rows: [{ label: "CIM p.31", value: 11.4 }, { label: "Model r.44", value: 10.9 }], scaleMax: 12,
      note: "Atlas asked in Q&A. Likely the one-off lease gain in Q3.",
      action: { id: "draft_atlas", label: "Draft answer to Atlas" },
      sources: [{ kind: "pdf", label: "CIM p.31" }, { kind: "xlsx", label: "Model · r.44" }],
    },
    {
      id: "dc_quiet", kind: "quietBuyer", company: { id: "keystone", name: "Keystone Group", initial: "K" }, tag: { label: "Gone quiet", tone: "warn" }, time: "07:40",
      title: { pre: "No data room visits in 9 days" },
      trendLabel: "Data room views · 5 wk", trend: [10, 8, 5, 3, 1],
      countdown: { value: 14, unit: "days", caption: "to IOIs · Fri 13 Nov" },
      action: { id: "draft_ioi", label: "Draft IOI reminder" },
      sources: [{ kind: "db", label: "Datasite" }, { kind: "mail", label: "Outlook" }],
    },
  ],
  meetings: {
    dayLabel: "Fri 30 Oct", app: "Teams", freeAfter: "16:00",
    items: [
      { id: "bm1", time: "09:30", title: "Halyard", sub: "mgmt pres dry run", next: true },
      { id: "bm2", time: "11:00", title: "Northwind Capital", sub: "IOI questions" },
      { id: "bm3", time: "15:00", title: "Project Cobalt", sub: "screening review" },
    ],
  },
  drafts: {
    app: "Outlook",
    items: [
      { id: "bd1", to: "Northwind", subject: "Customer concentration, top 10", time: "06:02", href: "https://outlook.office.com/mail/drafts" },
      { id: "bd2", to: "Orchard Equity", subject: "Fleet lease terms", time: "06:05", href: "https://outlook.office.com/mail/drafts" },
      { id: "bd3", to: "Halyard CFO", subject: "EBITDA bridge for Q&A", time: "06:21", href: "https://outlook.office.com/mail/drafts" },
      { id: "bd4", to: "Keystone Group", subject: "IOI timing check-in", time: "07:44", href: "https://outlook.office.com/mail/drafts" },
    ],
  },
  worthALook: {
    sourceNote: "from Datasite + Crustdata + firm brain",
    items: [
      { id: "bt_ff", kind: "rangeBars", company: { id: "halyard", name: "Halyard football field", initial: "H" }, title: "Precedents moved up · EV", ranges: [[22, 60], [35, 78], [28, 66]], emphasis: 1, axisLabels: ["$90M", "$190M"], sources: [] },
      { id: "bt_meridian", kind: "progress", company: { id: "meridian", name: "Project Meridian", initial: "M" }, title: "7 of 11 lenders opened the CIM", done: 7, total: 11, sources: [{ kind: "db", label: "Datasite" }] },
      { id: "bt_atlas", kind: "personMove", company: { id: "atlas", name: "Atlas Logistics", initial: "A" }, pill: "Buyer", title: "New CFO, ex-Ryder M&A", person: { initials: "RM", name: "Ruth Moss" }, caption: "started 26 Oct", sources: [{ kind: "crust", label: "Crustdata" }] },
    ],
  },
  closingLine: "That’s everything. Enjoy your morning.",
};

/** Outbound hold queue — GET /api/outbound?status=holding (@assumed). Approved sends wait holdMinutes, then leave. */
export const outboundQueue: OutboundItem[] = [
  { id: "ob1", to: "Maya Chen", subject: "ARR bridge before Monday", app: "Gmail", status: "holding", secondsLeft: 252, holdSeconds: 300, approvedBy: "You" },
  { id: "ob2", to: "Leo Park", subject: "Re: 13:30 today + cap table", app: "Gmail", status: "holding", secondsLeft: 61, holdSeconds: 300, approvedBy: "You in Slack" },
  { id: "ob3", to: "Elena Marsh", subject: "Coffee next week?", app: "Gmail", status: "sent", secondsLeft: 0, holdSeconds: 300, approvedBy: "Auto · L2" },
];
export const todayInvestHolding: TodayData = {
  ...todayInvest,
  outbound: outboundQueue,
  drafts: { ...todayInvest.drafts, items: todayInvest.drafts.items.filter((d) => d.id === "d3") },
};
