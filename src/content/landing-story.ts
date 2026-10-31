// Landing value story: who pays, what it replaces, and how a request becomes finished work. Copy only — no customer
// names, no prices, no data. The one quoted request is the ContextCon Investing sample (event deck p24), shown as user
// input; pricing is a stated hypothesis until it is tested with buyers.
import type { AccentLine } from "@port/types";

export type StoryCard = { id: string; label: string; title: string; body: string; tags?: string[] };
export type StoryStep = { id: string; label: string; title: string; body: string; endpoints?: string[]; person?: boolean };

export type LandingStory = {
  value: {
    eyebrow: string;
    title: AccentLine;
    sub: string;
    tool: { label: string; line: string };
    service: { label: string; line: string };
    cards: StoryCard[];
    pricing: { badge: string; line: string };
  };
  flow: {
    eyebrow: string;
    title: AccentLine;
    request: string;
    steps: StoryStep[];
    note: string;
    try: string;
    open: { label: string; href: string };
  };
};

const SAMPLE_REQUEST =
  "Find ten Indian B2B software companies founded since 2023 whose team grew by half in the last six months, and tell me who founded each and what they did before.";

export const landingStory: LandingStory = {
  value: {
    eyebrow: "An outcome, not a tool",
    title: { before: "Deal teams pay for the ", accent: "answer", after: ", not the search" },
    sub: "Deal Desk does the first-pass diligence an associate does by hand and hands back finished, cited work.",
    tool: { label: "A research tool", line: "Gives you rows. You still build the list, check every number and write it up." },
    service: { label: "Deal Desk", line: "Gives you the finished shortlist or memo, checked and cited. You approve the exceptions." },
    cards: [
      {
        id: "pays",
        label: "Who pays",
        title: "Teams that buy diligence today",
        body: "They pay for it in associate and analyst time, or in diligence-vendor fees.",
        tags: ["VC funds", "Investment banks", "Diligence firms"],
      },
      {
        id: "replaces",
        label: "What it replaces",
        title: "The first-pass screen and memo",
        body: "Building the list, pulling headcount and funding, checking who founded each company and what they did before, then writing it up with sources.",
      },
      {
        id: "outcome",
        label: "What you get",
        title: "A cited shortlist or IC memo",
        body: "Every value links to the Crustdata endpoint and field it came from, or says why it is unavailable.",
      },
    ],
    pricing: {
      badge: "Pricing hypothesis",
      line: "Priced per finished shortlist or memo, below the analyst time it replaces. Not yet tested with buyers.",
    },
  },
  flow: {
    eyebrow: "How a request becomes finished work",
    title: { before: "A person only for the ", accent: "exceptions" },
    request: SAMPLE_REQUEST,
    steps: [
      { id: "request", label: "Request", title: "Ask in plain English", body: "Any request, including one it has never seen." },
      { id: "plan", label: "Plan", title: "Turned into filters", body: "Each requirement is mapped to a Crustdata field, or flagged when it can’t be." },
      {
        id: "crustdata",
        label: "Crustdata",
        title: "Live company and people data",
        body: "Searched and enriched live. Every call is logged with its time and credits.",
        endpoints: ["/company/search", "/company/enrich", "/person/search", "/person/enrich"],
      },
      { id: "checks", label: "Checks", title: "Every value re-read at its source", body: "Mismatches are corrected and gaps are marked unavailable, with the reason." },
      {
        id: "exceptions",
        label: "Exceptions",
        title: "A person approves",
        body: "Weak matches, conflicting sources, a credit cap or any outbound send wait for a person. The rest finishes on its own.",
        person: true,
      },
      { id: "done", label: "Finished work", title: "Cited shortlist and memo", body: "Founders and their earlier roles, each fact with its endpoint, field and retrieval time." },
    ],
    note: "Outbound email, Slack and calendar sends stay in dry-run until a person approves them.",
    try: "Try this request",
    open: { label: "Open the live app", href: "/pipeline" },
  },
};

/** The assistant URL that runs `q` (the landing card's form posts to the same place). */
export const askHref = (q: string) => `/ask?q=${encodeURIComponent(q)}`;
