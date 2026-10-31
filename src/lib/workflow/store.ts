// Workflow deals in the durable store (src/lib/store/docs.ts): Postgres with DATABASE_URL / POSTGRES_URL, else JSON
// files (labelled "not durable" on Vercel). One document per deal, written after every step.
import { docStore, type DocStore } from "@/lib/store/docs";
import type { Deal } from "./types";

export const NS_WORKFLOWS = "workflows";

/** Thrown by saveGuarded when another writer saved the deal after this copy was read. */
export class StaleDealError extends Error {
  constructor(id: string) { super(`deal ${id} was changed by another writer; this copy was not saved`); this.name = "StaleDealError"; }
}

export function createWorkflowStore(docs: () => DocStore = () => docStore()) {
  return {
    info: () => docs().info(),
    async get(id: string): Promise<Deal | null> { return docs().get<Deal>(NS_WORKFLOWS, id); },
    async list(): Promise<Deal[]> { return (await docs().list<Deal>(NS_WORKFLOWS)).map((r) => r.doc).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    /** Plain write (creating a deal). Runs and actions use saveGuarded / update. */
    async save(d: Deal): Promise<void> { await docs().put(NS_WORKFLOWS, d.id, d); },
    /** Atomic read-modify-write of one deal; fn returns the new deal or undefined to leave it. Bumps `rev`. */
    async update(id: string, fn: (cur: Deal | null) => Promise<Deal | undefined> | Deal | undefined): Promise<Deal | null> {
      return docs().update<Deal>(NS_WORKFLOWS, id, async (cur) => {
        const next = await fn(cur);
        if (next) next.rev = (cur?.rev ?? 0) + 1;
        return next;
      });
    },
    /** Save a copy of the deal only if nobody saved it since this copy was read (compares `rev`); else StaleDealError. */
    async saveGuarded(d: Deal): Promise<void> {
      await docs().update<Deal>(NS_WORKFLOWS, d.id, (cur) => {
        if (cur && (cur.rev ?? 0) !== (d.rev ?? 0)) throw new StaleDealError(d.id);
        d.rev = (cur?.rev ?? 0) + 1;
        return d;
      });
    },
  };
}

export const workflowStore = createWorkflowStore();
