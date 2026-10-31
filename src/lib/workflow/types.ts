// The deal workflow: one deal flowing through the ten steps the product was designed around, each run by an agent and
// shown on one timeline (/workflow?id=). Steps that would contact a person produce drafts that wait for an approve
// click; steps that need a person's judgement (transcript, IC decision) wait for them. Nothing here is a fixture.
import type { Citation } from "@/lib/fields";
import { STAGE_LABEL, type DealStage } from "@/lib/deals/stages";

export const STEPS = [
  { id: "intake", title: "Founder email intake", agent: "Inbox agent" },
  { id: "screen", title: "Thesis screening", agent: "Screener" },
  { id: "dataroom", title: "Data-room request", agent: "Outreach agent" },
  { id: "research", title: "Research & claim validation", agent: "Research agent (Crustdata)" },
  { id: "schedule", title: "Partner meeting", agent: "Scheduler (Google Calendar)" },
  { id: "transcript", title: "Meeting transcript", agent: "Note-taker" },
  { id: "valuation", title: "Valuation", agent: "Numbers agent" },
  { id: "memo", title: "IC memo", agent: "Memo writer" },
  { id: "pipeline", title: "Pipeline: IC → Portfolio", agent: "Pipeline" },
  { id: "memory", title: "Firm memory", agent: "Firm brain" },
] as const;
export type StepId = (typeof STEPS)[number]["id"];

/** pending → running → done; "waiting" = a person is needed (the step says what for); "unavailable" = honest gap. */
export type StepStatus = "pending" | "running" | "done" | "waiting" | "unavailable" | "error";
/** How the step touched the outside world. */
export type Transport = "live" | "read_only" | "dry_run" | "local" | "person";

export type Fact = { label: string; value: string; status?: "verified" | "contradicted" | "unverifiable" | "pass" | "fail" | "unknown" | "info"; citation?: Citation; note?: string };

export type OutboundDraft = {
  channel: "gmail.send" | "calendar.insert";
  to: string[];
  subject: string;
  body: string;
  start?: string;
  end?: string;
  /** set when the approve button was clicked */
  approved?: { at: string; by: string; transport: "live" | "dry_run"; result: string; id?: string };
  /** recipients a live send would refuse (not on the allowlist) */
  blocked?: string[];
};

export type Step = {
  id: StepId;
  status: StepStatus;
  startedAt?: string;
  finishedAt?: string;
  summary?: string;
  transport?: Transport;
  facts?: Fact[];
  draft?: OutboundDraft;
  /** what a person needs to do, when waiting */
  needs?: "approve_screen" | "transcript" | "ic_decision";
  memo?: { markdown: string; sources: Citation[]; model: string | null };
  /** Crustdata credits this step's calls billed (X-Credits-Used of uncached calls), rounded to 2 decimals */
  credits?: number;
  /** true when every Crustdata call of the step came from the response cache (0 credits billed) */
  creditsCached?: boolean;
  error?: string;
};

export type Stage = DealStage;
export { STAGE_LABEL };

export type Trigger = { type: "gmail"; messageId: string; query: string } | { type: "ask"; domain: string; name?: string };

export type IntakeEmail = { messageId: string; threadId: string; from: string; fromAddress: string | null; subject: string; date: string; body: string };

export type Deal = {
  id: string;
  createdAt: string;
  updatedAt: string;
  trigger: Trigger;
  company: { name?: string; domain?: string };
  email?: IntakeEmail;
  stage: Stage;
  stageHistory: { stage: Stage; at: string; by: string }[];
  steps: Step[];
  transcript?: { text: string; source: "paste" | "upload"; name?: string; at: string };
  decision?: { verdict: "invest" | "pass"; by: string; at: string; note?: string };
  screenOverride?: { by: string; at: string };
  /** true while a run is advancing this deal (persisted, so every server instance sees it; stale after RUN_STALE_MS) */
  running?: boolean;
};

export const newSteps = (): Step[] => STEPS.map((s) => ({ id: s.id, status: "pending" }));
export const stepOf = (d: Deal, id: StepId): Step => d.steps.find((s) => s.id === id)!;
/** A run that stopped saving for this long died with its server instance; it no longer blocks actions. */
export const RUN_STALE_MS = 6 * 60_000;
export const isRunningNow = (d: Deal, now = Date.now()) => !!d.running && now - Date.parse(d.updatedAt) < RUN_STALE_MS;
