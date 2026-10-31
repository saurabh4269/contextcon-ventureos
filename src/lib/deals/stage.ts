// Deal stage vocabulary and the pure move rule (client-safe: no store import). The store functions are in stages.ts.
export const DEAL_STAGES = ["sourced", "screening", "diligence", "ic", "portfolio", "passed"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];
export const STAGE_LABEL: Record<DealStage, string> = { sourced: "Sourced", screening: "Screening", diligence: "Diligence", ic: "IC", portfolio: "Portfolio", passed: "Passed" };
/** Closed stages leave the active pipeline. */
export const isClosed = (s: DealStage) => s === "portfolio" || s === "passed";

export type StageMove = { stage: DealStage; at: string; by: string; actor: "user" | "agent"; note?: string };
export type StageRecord = {
  domain: string;
  name?: string;
  stage: DealStage;
  history: StageMove[];
  /** DEALDESK_USER_NAME when a person acted; null = Unassigned */
  owner: string | null;
  /** the deal workflow that moved it, if any (/workflow?id=) */
  workflowId?: string;
  updatedAt: string;
};

type Env = Record<string, string | undefined>;
/** The operator's name for "owner" and "by" (no sign-in in this build). Null when unset. */
export const userName = (env: Env = process.env): string | null => env.DEALDESK_USER_NAME?.trim() || null;

const RANK: Record<DealStage, number> = { sourced: 0, screening: 1, diligence: 2, ic: 3, portfolio: 4, passed: 4 };

export type MoveInput = { domain: string; stage: DealStage; by: string; actor: "user" | "agent"; name?: string; workflowId?: string; note?: string; at?: string; /** only move later in the pipeline (never back, never out of a closed stage) */ forwardOnly?: boolean };

/** Pure: the record after a move (unchanged when the move is a no-op). */
export function applyMove(prev: StageRecord | null, m: MoveInput, env: Env = process.env): StageRecord {
  const at = m.at ?? new Date().toISOString();
  const domain = m.domain.trim().toLowerCase();
  const base: StageRecord = prev ?? { domain, stage: "sourced", history: [], owner: null, updatedAt: at };
  const owner = m.actor === "user" ? userName(env) ?? base.owner : base.owner;
  const named = { ...base, ...(m.name ? { name: m.name } : {}), ...(m.workflowId ? { workflowId: m.workflowId } : {}), owner };
  const blocked = m.forwardOnly && prev && (isClosed(prev.stage) || RANK[m.stage] <= RANK[prev.stage]);
  if (blocked || (prev && prev.stage === m.stage)) return { ...named, updatedAt: prev && named.owner === prev.owner && named.name === prev.name && named.workflowId === prev.workflowId ? prev.updatedAt : at };
  return { ...named, stage: m.stage, history: [...base.history, { stage: m.stage, at, by: m.by, actor: m.actor, ...(m.note ? { note: m.note } : {}) }], updatedAt: at };
}

