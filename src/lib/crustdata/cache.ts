import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Pluggable cache for successful Crustdata responses, so repeated page loads don't re-spend credits.
 *
 * - `MemoryResponseCache` (default): per server process, TTL-bound. Safe on Vercel (stateless between instances).
 * - `FileResponseCache`: JSON files in `DEALDESK_CACHE_DIR`. Intended for local development only (survives dev-server
 *   restarts); do not set it on Vercel. The directory must be gitignored (`.cache/` is).
 *
 * Only response bodies and response metadata are stored. Request headers (and therefore the API key) never are.
 * Errors are never cached.
 *
 * Expired entries are kept for `staleMs` (default 7 days) so `getStale` can serve the last good response, labelled
 * with its original fetch time, when Crustdata is down (see ./stale.ts). Fresh reads never return them.
 */
export type CachedResponse = {
  data: unknown;
  creditsUsed: string | null;
  requestId: string | null;
  latencyMs: number;
  /** epoch ms */
  storedAt: number;
};

export interface ResponseCache {
  readonly kind: "memory" | "file";
  get(key: string): Promise<CachedResponse | undefined>;
  /** Last good response regardless of TTL (within the stale window); only for outage fallback. */
  getStale?(key: string): Promise<CachedResponse | undefined>;
  set(key: string, value: CachedResponse): Promise<void>;
}

export function cacheKey(method: string, apiPath: string, body: unknown): string {
  return createHash("sha256").update(`${method} ${apiPath}\n${stableStringify(body ?? null)}`).digest("hex");
}

/** JSON.stringify with sorted object keys so equivalent request bodies share a cache entry. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

export const DEFAULT_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_MEMORY_ENTRIES = 2_000;

export class MemoryResponseCache implements ResponseCache {
  readonly kind = "memory" as const;
  private readonly entries = new Map<string, CachedResponse>();
  constructor(
    private readonly ttlMs: number,
    private readonly staleMs = DEFAULT_STALE_MS,
  ) {}
  async get(key: string) {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    const age = Date.now() - hit.storedAt;
    if (age > this.ttlMs) {
      if (age > Math.max(this.ttlMs, this.staleMs)) this.entries.delete(key);
      return undefined;
    }
    return hit;
  }
  async getStale(key: string) {
    const hit = this.entries.get(key);
    return hit && Date.now() - hit.storedAt <= Math.max(this.ttlMs, this.staleMs) ? hit : undefined;
  }
  async set(key: string, value: CachedResponse) {
    this.entries.delete(key); // re-insert so Map order is oldest-first
    this.entries.set(key, value);
    while (this.entries.size > MAX_MEMORY_ENTRIES) this.entries.delete(this.entries.keys().next().value!);
  }
}

export class FileResponseCache implements ResponseCache {
  readonly kind = "file" as const;
  constructor(
    private readonly dir: string,
    private readonly ttlMs: number,
    private readonly staleMs = DEFAULT_STALE_MS,
  ) {}
  private file(key: string) {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error(`Invalid cache key ${key}`);
    return path.join(this.dir, `${key}.json`);
  }
  private async read(key: string): Promise<CachedResponse | undefined> {
    const f = this.file(key);
    let raw: string;
    try {
      raw = await fs.promises.readFile(f, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw e;
    }
    try {
      const hit = JSON.parse(raw) as CachedResponse;
      return typeof hit?.storedAt === "number" ? hit : undefined;
    } catch {
      return undefined; // a truncated/corrupt cache file is a miss, never a crash
    }
  }
  async get(key: string) {
    const hit = await this.read(key);
    return hit && Date.now() - hit.storedAt <= this.ttlMs ? hit : undefined;
  }
  async getStale(key: string) {
    const hit = await this.read(key);
    return hit && Date.now() - hit.storedAt <= Math.max(this.ttlMs, this.staleMs) ? hit : undefined;
  }
  async set(key: string, value: CachedResponse) {
    await fs.promises.mkdir(this.dir, { recursive: true });
    const f = this.file(key);
    const tmp = `${f}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(value));
    await fs.promises.rename(tmp, f);
  }
}

const DEFAULT_TTL_SECONDS = 6 * 60 * 60;

export function cacheTtlMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.DEALDESK_CACHE_TTL_SECONDS?.trim();
  if (!raw) return DEFAULT_TTL_SECONDS * 1000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`DEALDESK_CACHE_TTL_SECONDS must be a non-negative number (got "${raw}")`);
  return n * 1000;
}

const g = globalThis as unknown as { __dealdeskResponseCache?: ResponseCache };

/** Process-wide cache chosen from env (memory unless DEALDESK_CACHE_DIR is set). Survives Next dev HMR. */
export function defaultResponseCache(env: NodeJS.ProcessEnv = process.env): ResponseCache {
  if (g.__dealdeskResponseCache) return g.__dealdeskResponseCache;
  const dir = env.DEALDESK_CACHE_DIR?.trim();
  const ttl = cacheTtlMs(env);
  g.__dealdeskResponseCache = dir ? new FileResponseCache(path.resolve(dir), ttl) : new MemoryResponseCache(ttl);
  return g.__dealdeskResponseCache;
}
