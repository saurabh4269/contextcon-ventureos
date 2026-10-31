import { rpmForPath } from "./rate-limits";
import { rateLimitKeyForPath } from "./request-path";
import { parseRateLimitWaitSeconds } from "./rate-limit-headers";
import type { CrustdataErrorBody } from "./types";
import type { CircuitBreaker } from "@/lib/resilience/breaker";

export const CRUSTDATA_API_VERSION = "2025-11-01";
export const CRUSTDATA_BASE_URL = "https://api.crustdata.com";

export class CrustdataApiError extends Error {
  readonly status: number;
  readonly body: CrustdataErrorBody;
  readonly retryAfterSeconds: number | null;

  constructor(
    status: number,
    body: CrustdataErrorBody,
    retryAfterSeconds: number | null = null,
  ) {
    const detail =
      body?.error && typeof body.error === "object"
        ? body.error.message ?? body.error.type ?? String(status)
        : body?.description ?? body?.reason ?? String(body?.error ?? status);
    super(`Crustdata ${status}: ${detail}`);
    this.status = status;
    this.body = body ?? {};
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Sliding-window limiter per route template (documented RPM, e.g. /company/enrich 15, /watch/company/:id 10).
 * Allows bursts up to the RPM within any 60 s window instead of spacing every call 60/rpm seconds apart.
 */
export class RateLimiter {
  private calls = new Map<string, number[]>();

  /** Waits for a slot; with `deadline` (epoch ms), throws a timeout instead of waiting past it. */
  async acquire(path: string, deadline = Infinity): Promise<void> {
    const key = rateLimitKeyForPath(path);
    const rpm = rpmForPath(path);
    for (;;) {
      const now = Date.now();
      const recent = (this.calls.get(key) ?? []).filter((t) => now - t < 60_000);
      if (recent.length < rpm) {
        recent.push(now);
        this.calls.set(key, recent);
        return;
      }
      this.calls.set(key, recent);
      const wait = Math.max(50, 60_000 - (now - recent[0]!));
      if (now + wait >= deadline) {
        throw new CrustdataTransportError("timeout", `Crustdata ${key}: the rate limit (${rpm}/min) needs a ${Math.ceil(wait / 1000)} s wait, past this request's deadline`);
      }
      await sleep(wait);
    }
  }
}

/** Connection errors that prove the request never reached the server (safe to resend even a write). */
const NEVER_CONNECTED = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH"]);
const errorCode = (e: unknown): string | undefined => {
  const x = e as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = x?.cause?.code ?? x?.code;
  return typeof code === "string" ? code : undefined;
};

/** Thrown when no HTTP response arrived: the attempt timed out or the connection failed. */
export class CrustdataTransportError extends Error {
  readonly kind: "timeout" | "network";
  constructor(kind: "timeout" | "network", message: string) {
    super(message);
    this.name = "CrustdataTransportError";
    this.kind = kind;
  }
}

/** A 2xx whose body is not the JSON the endpoint documents (truncated proxy page, HTML error page, empty body). */
export class CrustdataMalformedResponseError extends Error {
  readonly status: number;
  constructor(status: number, method: string, path: string, text: string, problem = "not valid JSON") {
    const head = text.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 120);
    super(`Crustdata ${method} ${path} returned a response that is ${problem} (HTTP ${status}${head ? `, starts "${head}"` : ", empty body"})`);
    this.name = "CrustdataMalformedResponseError";
    this.status = status;
  }
}

/**
 * Read endpoints. Replaying them cannot change state (a replay after a timeout may bill the read twice; retries are
 * bounded). Writes — POST /watch/company (creates a watch) and DELETE /watch/company/:id — are never replayed after a
 * request may have reached Crustdata.
 */
const REPLAYABLE_POST = new Set([
  "/company/identify",
  "/company/enrich",
  "/company/search",
  "/company/search/autocomplete",
  "/person/identify",
  "/person/enrich",
  "/person/search",
  "/person/search/autocomplete",
  "/job/search",
  "/web/search/live",
  "/web/enrich/live",
]);

export function isReplayableRequest(method: string, path: string): boolean {
  const m = method.toUpperCase();
  if (m === "GET") return true;
  return m === "POST" && REPLAYABLE_POST.has(rateLimitKeyForPath(path));
}

/** Upstream outage statuses worth retrying (500 included: Crustdata returns it for transient search backend errors). */
export const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

/** Full-jitter exponential backoff: random in [0, min(max, base·2^(n-1))]. */
export function backoffDelayMs(retry: number, baseMs = 400, maxMs = 4_000, random: () => number = Math.random): number {
  return Math.floor(random() * Math.min(maxMs, baseMs * 2 ** Math.max(0, retry - 1)));
}

export type CrustdataFetchOptions = {
  /** per-attempt timeout */
  timeoutMs?: number;
  /** max 429 retries */
  retries?: number;
  max429WaitMs?: number;
  /** max retries after 5xx / timeout / transport errors (replayable requests only) */
  transientRetries?: number;
  /** total budget for all attempts, waits and backoff; no attempt starts or waits past it */
  deadlineMs?: number;
  breaker?: CircuitBreaker;
  fetchImpl?: typeof fetch;
  /** test hooks */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

/**
 * One Crustdata request with bounded retries, all inside `deadlineMs` (default 45 s):
 * - 429: wait `Retry-After` / `X-RateLimit-Reset` (seconds) and retry, but never wait more than `max429WaitMs` in total
 *   (interactive page loads must fail loudly instead of stalling ~50 s).
 * - 500/502/503/504, timeouts and transport errors: retried with jittered exponential backoff (`transientRetries`,
 *   default 2) for read endpoints only (see isReplayableRequest). A write is retried only when the connection failed
 *   outright (no timeout), and only once.
 * - A 2xx that is not JSON: retried like a 5xx, then CrustdataMalformedResponseError — never treated as "no match".
 * - Any other non-2xx: thrown as CrustdataApiError immediately; `retryAfterSeconds` is only set for 429.
 * - `breaker`: outages (5xx, timeout, transport) count per route; when open, calls fail fast with CircuitOpenError.
 */
export async function crustdataFetch<T>(
  apiKey: string,
  path: string,
  init: RequestInit,
  limiter: RateLimiter,
  opts: CrustdataFetchOptions = {},
): Promise<{ data: T; creditsUsed: string | null; requestId: string | null }> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const max429Retries = opts.retries ?? 3;
  const max429WaitMs = opts.max429WaitMs ?? 15_000;
  const maxTransient = opts.transientRetries ?? 2;
  const deadline = Date.now() + (opts.deadlineMs ?? 45_000);
  const pause = opts.sleep ?? sleep;
  const method = (init.method ?? "GET").toUpperCase();
  const replayable = isReplayableRequest(method, path);
  const breakerKey = `Crustdata ${rateLimitKeyForPath(path)}`;
  let waited429 = 0;
  let transient = 0;
  let writeReconnected = false;
  let attempt = 0;

  /** Back off before another attempt when allowed and the wait fits in the deadline. */
  const retryTransient = async (canReplay: boolean): Promise<boolean> => {
    if (!canReplay || transient >= maxTransient) return false;
    const delay = 250 + backoffDelayMs(transient + 1, 400, 4_000, opts.random);
    if (Date.now() + delay + 1_000 > deadline) return false;
    transient += 1;
    await pause(delay);
    return true;
  };

  while (true) {
    attempt += 1;
    if (Date.now() >= deadline) {
      throw new CrustdataTransportError("timeout", `Crustdata ${method} ${path} ran out of time (deadline reached after ${attempt - 1} attempt(s))`);
    }
    opts.breaker?.check(breakerKey);
    // every attempt records success/failure on the breaker; if it ends any other way (deadline, a thrown bug), the
    // half-open trial slot is released in `finally` so the circuit can never get stuck
    let recorded = false;
    const failed = (message: string) => {
      recorded = true;
      opts.breaker?.failure(breakerKey, message);
    };
    const succeeded = () => {
      recorded = true;
      opts.breaker?.success(breakerKey);
    };
    try {
      await limiter.acquire(path, deadline);
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new CrustdataTransportError("timeout", `Crustdata ${method} ${path} ran out of time (deadline reached after ${attempt - 1} attempt(s))`);
      const attemptTimeout = Math.min(timeoutMs, remaining);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), attemptTimeout);
      let res: Response | undefined;
      let text: string;
      try {
        res = await (opts.fetchImpl ?? fetch)(`${CRUSTDATA_BASE_URL}${path}`, {
          ...init,
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
            "x-api-version": CRUSTDATA_API_VERSION,
            ...(init.headers ?? {}),
          },
        });
        text = await res.text();
      } catch (e) {
        const timedOut = controller.signal.aborted;
        const err = new CrustdataTransportError(
          timedOut ? "timeout" : "network",
          `Crustdata ${method} ${path} ${timedOut ? `timed out after ${attemptTimeout} ms` : `transport error: ${e instanceof Error ? e.message : String(e)}`}`,
        );
        failed(err.message);
        // a write is resent only when the connection provably never opened (no response, DNS/refused); a reset or a
        // failed body read may come after Crustdata acted on it
        const neverConnected = !res && !timedOut && NEVER_CONNECTED.has(errorCode(e) ?? "");
        if (await retryTransient(replayable || (neverConnected && !writeReconnected))) {
          if (!replayable) writeReconnected = true;
          continue;
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
      const creditsUsed = res.headers.get("X-Credits-Used");
      const requestId = res.headers.get("X-Request-Id");

      if (RETRYABLE_STATUS.has(res.status)) {
        const err = new CrustdataApiError(res.status, (safeJson(text) as CrustdataErrorBody) ?? { error: text || res.statusText }, null);
        failed(err.message);
        if (await retryTransient(replayable)) continue;
        throw err;
      }
      if (res.status === 429) {
        succeeded(); // rate limited is an answer, not an outage
        const waitSec = parseRateLimitWaitSeconds(res.headers, attempt);
        const waitMs = waitSec * 1000 + jitter();
        if (attempt <= max429Retries && waited429 + waitMs <= max429WaitMs && Date.now() + waitMs < deadline) {
          waited429 += waitMs;
          await pause(waitMs);
          continue;
        }
        throw new CrustdataApiError(429, (safeJson(text) as CrustdataErrorBody) ?? { error: "rate limited" }, waitSec);
      }
      if (!res.ok) {
        succeeded();
        throw new CrustdataApiError(res.status, (safeJson(text) as CrustdataErrorBody) ?? { error: text || res.statusText }, null);
      }
      // 204 / DELETE may legitimately have no (or a non-JSON) body; every read endpoint returns JSON
      if (res.status === 204 || method === "DELETE") {
        succeeded();
        return { data: (safeJsonOrNull(text) ?? null) as T, creditsUsed, requestId };
      }
      let data: T;
      try {
        data = JSON.parse(text) as T;
      } catch {
        const err = new CrustdataMalformedResponseError(res.status, method, path, text);
        failed(err.message); // an HTML page behind a 200 is an outage (proxy/gateway), not an answer
        if (await retryTransient(replayable)) continue;
        throw err;
      }
      succeeded();
      return { data, creditsUsed, requestId };
    } finally {
      if (!recorded) opts.breaker?.release(breakerKey);
    }
  }
}

function safeJsonOrNull(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function safeJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 300) };
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter() {
  return Math.floor(Math.random() * 200);
}
