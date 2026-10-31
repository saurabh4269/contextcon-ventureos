// Deal stages: where each deal is in the pipeline, who moved it there and who owns it. One document per company
// domain in the durable store (src/lib/store/docs.ts). The deal workflow moves stages as its agents and the partner
// act; approving a deal's item in Review moves a Sourced deal to Screening. Nothing else invents a stage.
//
// Owner: DEALDESK_USER_NAME once a person (the user) acted on the deal; until then, and when that env var is unset,
// the owner is null and the UI says "Unassigned".
import { docStore, type DocStore } from "@/lib/store/docs";
import { applyMove, type MoveInput, type StageRecord } from "./stage";

export * from "./stage";

export const NS_STAGES = "deal_stages";
type Env = Record<string, string | undefined>;

export async function moveStage(m: MoveInput, docs: DocStore = docStore(), env: Env = process.env): Promise<StageRecord> {
  const id = m.domain.trim().toLowerCase();
  // atomic read-modify-write: two moves of one domain never interleave (no lost history entry)
  let out!: StageRecord;
  await docs.update<StageRecord>(NS_STAGES, id, (prev) => {
    const next = applyMove(prev, m, env);
    out = next;
    return JSON.stringify(prev) !== JSON.stringify(next) ? next : undefined;
  });
  return out;
}

export async function listStages(docs: DocStore = docStore()): Promise<StageRecord[]> {
  return (await docs.list<StageRecord>(NS_STAGES)).map((r) => r.doc);
}
