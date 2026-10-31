import "server-only";
// Memory store selection. Postgres when DATABASE_URL is set; otherwise every caller gets an explicit
// "unavailable" — there is deliberately no in-memory fallback (events would vanish on restart and look persisted).
// Swapping to the builder backend = replacing createPostgresMemoryStore with an HTTP client for its memory API.
import type { MemoryEvent, MemoryEventInput, MemoryUnavailable } from "./types";
import { createPostgresMemoryStore } from "./postgres";

export interface MemoryStore {
  append(input: MemoryEventInput): Promise<MemoryEvent>;
  /** Events with id > sinceId (oldest first), or the latest `limit` events when sinceId is omitted. */
  list(opts: { sinceId?: string; limit: number }): Promise<MemoryEvent[]>;
}

export const MEMORY_NOT_CONFIGURED = "memory store not configured (DATABASE_URL)";

const g = globalThis as unknown as { __dealdeskMemory?: { url: string; store: MemoryStore } };

export function memoryStore(env: Record<string, string | undefined> = process.env): { status: "ok"; store: MemoryStore } | MemoryUnavailable {
  const url = env.DATABASE_URL?.trim();
  if (!url) return { status: "unavailable", reason: MEMORY_NOT_CONFIGURED };
  if (g.__dealdeskMemory?.url !== url) g.__dealdeskMemory = { url, store: createPostgresMemoryStore(url) };
  return { status: "ok", store: g.__dealdeskMemory.store };
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
