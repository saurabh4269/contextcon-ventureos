import { rpmForPath } from "./rate-limits";
import { rateLimitKeyForPath } from "./request-path";
import { parseRateLimitWaitSeconds } from "./rate-limit-headers";
import type { CrustdataErrorBody } from "./types";

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
      typeof body.error === "object"
        ? body.error.message
        : body.description ?? body.reason ?? String(body.error ?? status);
    super(`Crustdata ${status}: ${detail}`);
    this.status = status;
    this.body = body;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Sliding-window limiter per route template (documented RPM, e.g. /company/enrich 15, /watch/company/:id 10).
 * Allows bursts up to the RPM within any 60 s window instead of spacing every call 60/rpm seconds apart.
 */
export class RateLimiter {
  private calls = new Map<string, number[]>();

  async acquire(path: string): Promise<void> {
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
      await sleep(Math.max(50, 60_000 - (now - recent[0]!)));
    }
  }
}

function parseResponseJson(text: string, status: number): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CrustdataApiError(status, { error: text }, null);
  }
}

/**
 * One Crustdata request with bounded retries:
 * - 429: wait `Retry-After` / `X-RateLimit-Reset` (seconds) and retry, but never wait more than `max429WaitMs` in total
 *   (interactive page loads must fail loudly instead of stalling ~50 s).
 * - Transport errors (no HTTP response): one retry, and only for GETs or when the connection failed before a response
 *   could exist — a POST that timed out may already have been billed, so it is not replayed.
 * - Any other non-2xx: thrown as CrustdataApiError immediately; `retryAfterSeconds` is only set for 429.
 */
export async function crustdataFetch<T>(
  apiKey: string,
  path: string,
  init: RequestInit,
  limiter: RateLimiter,
  opts: { timeoutMs?: number; retries?: number; max429WaitMs?: number } = {},
): Promise<{ data: T; creditsUsed: string | null; requestId: string | null }> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const max429Retries = opts.retries ?? 3;
  const max429WaitMs = opts.max429WaitMs ?? 15_000;
  const method = (init.method ?? "GET").toUpperCase();
  let waited429 = 0;
  let transportRetried = false;
  let attempt = 0;
  while (true) {
    attempt += 1;
    await limiter.acquire(path);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${CRUSTDATA_BASE_URL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "x-api-version": CRUSTDATA_API_VERSION,
          ...(init.headers ?? {}),
        },
      });
    } catch (e) {
      clearTimeout(timer);
      const timedOut = controller.signal.aborted;
      const replayable = method === "GET" || !timedOut;
      if (!transportRetried && replayable) {
        transportRetried = true;
        await sleep(500 + jitter());
        continue;
      }
      throw new Error(`Crustdata ${method} ${path} ${timedOut ? `timed out after ${timeoutMs} ms` : `transport error: ${e instanceof Error ? e.message : String(e)}`}`);
    }
    clearTimeout(timer);
    const creditsUsed = res.headers.get("X-Credits-Used");
    const requestId = res.headers.get("X-Request-Id");
    const text = await res.text();

    if (res.status === 429) {
      const waitSec = parseRateLimitWaitSeconds(res.headers, attempt);
      const waitMs = waitSec * 1000 + jitter();
      if (attempt <= max429Retries && waited429 + waitMs <= max429WaitMs) {
        waited429 += waitMs;
        await sleep(waitMs);
        continue;
      }
      throw new CrustdataApiError(429, (safeJson(text) as CrustdataErrorBody) ?? { error: "rate limited" }, waitSec);
    }
    if (!res.ok) {
      throw new CrustdataApiError(res.status, (safeJson(text) as CrustdataErrorBody) ?? { error: text || res.statusText }, null);
    }
    return { data: parseResponseJson(text, res.status) as T, creditsUsed, requestId };
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
