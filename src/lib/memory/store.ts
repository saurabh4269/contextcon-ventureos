import "server-only";
// Memory store selection. Postgres (table dealdesk_memory_events) when DATABASE_URL / POSTGRES_URL is set; otherwise
// the durable store's JSON documents (src/lib/store/docs.ts): local files on one server, or per-instance /tmp files on
// Vercel. Every response carries `storage`, so the UI says when memory is not durable on this deploy. There is no
// silent in-memory fallback (DEALDESK_STORE=memory is for tests and says so).
// Swapping to the builder backend = replacing createPostgresMemoryStore with an HTTP client for its memory API.
import type { MemoryEvent, MemoryEventInput, MemoryUnavailable } from "./types";
import { createPostgresMemoryStore } from "./postgres";
import { databaseUrl, docStore, type DocStore, type StorageInfo } from "@/lib/store/docs";

export interface MemoryStore {
  append(input: MemoryEventInput): Promise<MemoryEvent>;
  /** Events with id > sinceId (oldest first), or the latest `limit` events when sinceId is omitted. */
  list(opts: { sinceId?: string; limit: number }): Promise<MemoryEvent[]>;
}

export const MEMORY_NOT_CONFIGURED = "memory store not configured (DATABASE_URL)";
export const NS_MEMORY = "memory_events";
/** The document fallback keeps the newest events only (the Postgres table keeps all). */
export const DOC_MEMORY_MAX = 2000;

/** Memory events as documents (ids "1", "2", … in append order). Appends in one process are serialized. */
export function createDocMemoryStore(docs: DocStore, now: () => Date = () => new Date()): MemoryStore {
  let chain: Promise<unknown> = Promise.resolve();
  const all = async () => (await docs.list<MemoryEvent>(NS_MEMORY)).map((r) => r.doc).sort((a, b) => Number(a.id) - Number(b.id));
  return {
    append(input) {
      const run = chain.then(async () => {
        const events = await all();
        const id = String((events.length ? Number(events.at(-1)!.id) : 0) + 1);
        const ev: MemoryEvent = { ...input, subject: input.subject ?? null, data: input.data ?? null, id, at: now().toISOString() };
        await docs.put(NS_MEMORY, id, ev);
        for (const old of events.slice(0, Math.max(0, events.length + 1 - DOC_MEMORY_MAX))) await docs.remove(NS_MEMORY, old.id);
        return ev;
      });
      chain = run.catch(() => undefined);
      return run;
    },
    async list({ sinceId, limit }) {
      const events = await all();
      return sinceId ? events.filter((e) => Number(e.id) > Number(sinceId)).slice(0, limit) : events.slice(-limit);
    },
  };
}

const g = globalThis as unknown as { __dealdeskMemory?: { key: string; store: MemoryStore } };

export function memoryStore(env: Record<string, string | undefined> = process.env): { status: "ok"; store: MemoryStore; storage: StorageInfo } | MemoryUnavailable {
  const db = env.DEALDESK_STORE?.trim().toLowerCase() === "memory" ? null : databaseUrl(env);
  if (db) {
    if (g.__dealdeskMemory?.key !== `pg:${db.url}`) g.__dealdeskMemory = { key: `pg:${db.url}`, store: createPostgresMemoryStore(db.url) };
    return { status: "ok", store: g.__dealdeskMemory.store, storage: { kind: "postgres", durable: true, label: `Postgres (${db.name})`, note: `Stored in Postgres (${db.name}); every server instance sees the same memory.` } };
  }
  const docs = docStore(env);
  return { status: "ok", store: createDocMemoryStore(docs), storage: docs.info() };
}

/**
 * Server-side append for actions handled by API routes (research runs, connector checks …). Never throws: the action
 * itself already happened, so a memory failure is reported back (and logged) instead of failing the request.
 */
export async function recordMemory(input: MemoryEventInput): Promise<{ status: "ok"; id: string } | MemoryUnavailable | { status: "error"; message: string }> {
  const m = memoryStore();
  if (m.status !== "ok") return m;
  try {
    const e = await m.store.append(input);
    return { status: "ok", id: e.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[memory] append ${input.kind} failed: ${message}`);
    return { status: "error", message };
  }
}
