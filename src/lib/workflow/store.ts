// Workflow deals in the durable store (src/lib/store/docs.ts): Postgres with DATABASE_URL / POSTGRES_URL, else JSON
// files (labelled "not durable" on Vercel). One document per deal, written after every step.
import { docStore, type DocStore } from "@/lib/store/docs";
import type { Deal } from "./types";

export const NS_WORKFLOWS = "workflows";

export function createWorkflowStore(docs: () => DocStore = () => docStore()) {
  return {
    info: () => docs().info(),
    async get(id: string): Promise<Deal | null> { return docs().get<Deal>(NS_WORKFLOWS, id); },
    async list(): Promise<Deal[]> { return (await docs().list<Deal>(NS_WORKFLOWS)).map((r) => r.doc).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async save(d: Deal): Promise<void> { await docs().put(NS_WORKFLOWS, d.id, d); },
  };
}

export const workflowStore = createWorkflowStore();
