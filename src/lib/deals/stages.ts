// Deal stages: where each deal is in the pipeline, who moved it there and who owns it. One document per company
// domain in the durable store (src/lib/store/docs.ts). The deal workflow moves stages as its agents and the partner
// act; approving a deal's item in Review moves a Sourced deal to Screening. Nothing else invents a stage.
//
// Owner: DEALDESK_USER_NAME once a person (the user) acted on the deal; until then, and when that env var is unset,
// the owner is null and the UI says "Unassigned".
import { docStore, type DocStore } from "@/lib/store/docs";

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

export const NS_STAGES = "deal_stages";

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

export async function moveStage(m: MoveInput, docs: DocStore = docStore(), env: Env = process.env): Promise<StageRecord> {
  const id = m.domain.trim().toLowerCase();
  const prev = await docs.get<StageRecord>(NS_STAGES, id);
  const next = applyMove(prev, m, env);
  if (JSON.stringify(prev) !== JSON.stringify(next)) await docs.put(NS_STAGES, id, next);
  return next;
}

export async function listStages(docs: DocStore = docStore()): Promise<StageRecord[]> {
  return (await docs.list<StageRecord>(NS_STAGES)).map((r) => r.doc);
}
