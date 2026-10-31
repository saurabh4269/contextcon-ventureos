// Outage fallback: when Crustdata is down (5xx, timeout, transport error, open circuit, malformed 2xx, exhausted 429)
// a read is answered from the last good cached response, labelled "cached at <IST time>" with its original fetch time.
// Answers are never served stale: 400/401/403/404 and other client errors propagate, because the cached response would
// hide a real problem (bad input, revoked key).
import { fmtDateTime } from "@/lib/format";
import { CircuitOpenError } from "@/lib/resilience/breaker";
import type { CachedResponse, ResponseCache } from "./cache";
import { CrustdataApiError, CrustdataMalformedResponseError, CrustdataTransportError, RETRYABLE_STATUS } from "./http";
import type { CrustdataCallMeta } from "./types";

/** Short reason when `e` means "Crustdata is unavailable right now"; null for answers (4xx) and unknown errors. */
export function outageReason(e: unknown): string | null {
  if (e instanceof CircuitOpenError) return "repeated failures, circuit open";
  if (e instanceof CrustdataTransportError) return e.kind === "timeout" ? "timed out" : "connection failed";
  if (e instanceof CrustdataMalformedResponseError) return "malformed response";
  if (e instanceof CrustdataApiError) {
    if (RETRYABLE_STATUS.has(e.status)) return `HTTP ${e.status}`;
    if (e.status === 429) return "rate limited";
  }
  return null;
}

export function staleNote(reason: string, storedAt: number): string {
  return `Crustdata unavailable (${reason}); showing the response cached at ${fmtDateTime(new Date(storedAt).toISOString())}`;
}

export function staleMeta(path: string, hit: CachedResponse, reason: string): CrustdataCallMeta {
  const retrievedAt = new Date(hit.storedAt).toISOString();
  return {
    path,
    creditsUsed: hit.creditsUsed,
    requestId: hit.requestId,
    asOf: retrievedAt.slice(0, 10),
    retrievedAt,
    latencyMs: hit.latencyMs,
    cached: true,
    stale: true,
    staleNote: staleNote(reason, hit.storedAt),
  };
}

/** The last good response for `key` when `e` is an outage and the cache still has one; otherwise undefined. */
export async function staleFallback(cache: ResponseCache | undefined, key: string | undefined, path: string, e: unknown) {
  const reason = outageReason(e);
  if (!reason || !cache?.getStale || !key) return undefined;
  let hit: CachedResponse | undefined;
  try {
    hit = await cache.getStale(key);
  } catch {
    return undefined; // a broken cache must not replace the upstream error
  }
  return hit ? { data: hit.data, meta: staleMeta(path, hit, reason) } : undefined;
}
