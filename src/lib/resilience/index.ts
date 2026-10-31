// Generic resilience for upstream calls (Crustdata, OpenAI, Anthropic): one error taxonomy, per-attempt timeouts, a total
// deadline, exponential backoff with full jitter, Retry-After, caller cancellation and an optional per-key circuit breaker.
// Classification is structural (numeric `.status`, error names, Node error codes) so this module imports no client code.
// Every `userMessage` is short, honest and never claims success; no secrets and no raw bodies over 200 chars leave here.
import { fmtTime } from "@/lib/format";
import { CircuitBreaker, CircuitOpenError } from "./breaker";

export { CircuitBreaker, CircuitOpenError };

export type ErrorKind =
  | "timeout"
  | "rate_limited"
  | "upstream_unavailable"
  | "circuit_open"
  | "auth"
  | "bad_request"
  | "not_found"
  | "insufficient_credits"
  | "malformed_response"
  | "network"
  | "aborted"
  | "unknown";

export type ErrorClass = { kind: ErrorKind; retryable: boolean; status?: number; retryAfterMs?: number; userMessage: string; detail: string };

/** One attempt ran past its per-attempt budget (or the remaining deadline). */
export class ResilienceTimeoutError extends Error {
  constructor(readonly label: string, readonly timeoutMs: number) {
    super(`${label} did not answer within ${fmtSeconds(timeoutMs)}`);
    this.name = "ResilienceTimeoutError";
  }
}

/** An upstream answered 2xx but the body was not parseable (JSON). */
export class MalformedResponseError extends Error {
  constructor(readonly label: string, readonly snippet: string, reason: string) {
    super(`${label} returned an unparseable response (${reason}): ${snippet}`);
    this.name = "MalformedResponseError";
  }
}

/** Final failure after retries/fallbacks. `message` is the user-facing message. */
export class ResilienceError extends Error {
  readonly cause: unknown;
  constructor(readonly classification: ErrorClass, readonly attempts: number, cause: unknown) {
    super(classification.userMessage);
    this.name = "ResilienceError";
    this.cause = cause;
  }
}

/* ── classification ── */

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504, 529]);
const NETWORK_CODES = /ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|EPIPE|EHOSTUNREACH|ENETUNREACH|UND_ERR_[A-Z_]+/;
const NETWORK_TEXT = /fetch failed|network error|transport error|socket hang up|other side closed|getaddrinfo/i;

const SECRET = /(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._~+/=-]{8,}|(api[_-]?key|token|authorization)["'=:\s]+[A-Za-z0-9._~+/=-]{8,})/gi;
/** Strip control chars and anything that looks like a credential; cap length. */
export function scrub(text: string, max = 200): string {
  const clean = text.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(SECRET, "[redacted]").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

const fmtSeconds = (ms: number) => (ms >= 1000 ? `${Math.round(ms / 1000)} s` : `${ms} ms`);
const at = (epochMs: number) => fmtTime(new Date(epochMs).toISOString());

type Errorish = { name?: unknown; message?: unknown; status?: unknown; code?: unknown; cause?: unknown; provider?: unknown; retryAfterSeconds?: unknown; retryAfterMs?: unknown };

function codeOf(e: Errorish | undefined, depth = 0): string {
  if (!e || typeof e !== "object" || depth > 3) return "";
  return `${typeof e.code === "string" ? e.code : ""} ${codeOf(e.cause as Errorish, depth + 1)}`.trim();
}

/** Who failed: the provider on ModelApiError, "Crustdata" for its errors, else the caller's label. */
function subjectOf(e: Errorish, fallback?: string): string {
  if (typeof e.provider === "string" && e.provider) return e.provider;
  if (e instanceof ResilienceTimeoutError || e instanceof MalformedResponseError) return e.label;
  if (typeof e.message === "string" && /^Crustdata\b/.test(e.message)) return "Crustdata";
  return fallback || "The upstream service";
}

/**
 * Map any thrown value to an ErrorClass. `subject` names the upstream in the user message when the error itself does not
 * (e.g. "OpenAI gpt-6.1-sol").
 */
export function classifyError(e: unknown, subject?: string): ErrorClass {
  if (e instanceof ResilienceError) return e.classification;
  const err: Errorish = e && typeof e === "object" ? (e as Errorish) : { message: String(e) };
  const name = typeof err.name === "string" ? err.name : "";
  const message = typeof err.message === "string" ? err.message : String(e);
  const detail = scrub(`${name && name !== "Error" ? `${name}: ` : ""}${message}`);
  const who = subjectOf(err, subject);
  const brief = scrub(message.replace(/^\w+( API)? \d{3}: /, ""), 120); // drop the "Crustdata 400: " / "OpenAI API 400: " prefix

  if (e instanceof CircuitOpenError || name === "CircuitOpenError") {
    const retryAt = typeof (err as { retryAt?: unknown }).retryAt === "number" ? (err as CircuitOpenError).retryAt : Date.now();
    const key = typeof (err as { key?: unknown }).key === "string" ? (err as CircuitOpenError).key : who;
    return {
      kind: "circuit_open",
      retryable: false,
      retryAfterMs: Math.max(0, retryAt - Date.now()),
      userMessage: `${key} is paused after repeated failures; nothing was sent. Retry after ${at(retryAt)}.`,
      detail,
    };
  }
  const timeout = (within: string): ErrorClass => ({ kind: "timeout", retryable: true, userMessage: `${who} did not answer ${within} — nothing was invented; try again shortly.`, detail });
  if (e instanceof ResilienceTimeoutError) return timeout(`within ${fmtSeconds(e.timeoutMs)}`);
  if (name === "TimeoutError") return timeout("in time");
  if (name === "AbortError") return { kind: "aborted", retryable: false, userMessage: "The request was cancelled before it finished.", detail };
  if (e instanceof MalformedResponseError || name === "MalformedResponseError" || e instanceof SyntaxError) {
    return { kind: "malformed_response", retryable: true, userMessage: `${who} returned a response that could not be read — nothing was invented; try again.`, detail };
  }

  const status = typeof err.status === "number" && Number.isFinite(err.status) ? err.status : undefined;
  if (status !== undefined) {
    const retryAfterMs =
      typeof err.retryAfterMs === "number" ? err.retryAfterMs : typeof err.retryAfterSeconds === "number" ? err.retryAfterSeconds * 1000 : undefined;
    const base = { status, detail, retryable: RETRYABLE_STATUS.has(status) };
    if (status === 429) {
      const when = retryAfterMs !== undefined ? ` Retry after ${at(Date.now() + retryAfterMs)}.` : " Try again in a minute.";
      return { ...base, kind: "rate_limited", retryAfterMs, userMessage: `${who} is rate-limiting requests (429); nothing was returned.${when}` };
    }
    if (status === 401) return { ...base, kind: "auth", userMessage: `${who} rejected the API key (401) — an operator must fix the key.` };
    if (status === 403) return { ...base, kind: "auth", userMessage: `${who} refused access (403) — the key lacks permission for this; an operator must fix it.` };
    if (status === 402) return { ...base, kind: "insufficient_credits", userMessage: `${who} reports insufficient credits (402) — top up before retrying.` };
    if (status === 404) return { ...base, kind: "not_found", userMessage: `${who} returned not found (404): ${brief}` };
    if (status === 408) return { ...base, kind: "timeout", userMessage: `${who} did not answer in time (408) — nothing was invented; try again shortly.` };
    if (status >= 500) return { ...base, kind: "upstream_unavailable", userMessage: `${who} is unavailable (${status}) — nothing was invented; try again shortly.` };
    if (status >= 400) return { ...base, kind: "bad_request", userMessage: `${who} rejected the request (${status}): ${brief}` };
  }

  if (/timed out|timeout/i.test(message)) return timeout("in time"); // e.g. crustdataFetch "… timed out after 30000 ms"
  if (NETWORK_CODES.test(codeOf(err)) || NETWORK_TEXT.test(message) || NETWORK_CODES.test(message)) {
    return { kind: "network", retryable: true, userMessage: `Could not reach ${who} (network error) — nothing was returned; check connectivity and try again.`, detail };
  }
  return { kind: "unknown", retryable: false, userMessage: `${who} failed unexpectedly: ${brief}`, detail };
}

/* ── retry loop ── */

/** Full-jitter exponential backoff: random() × min(max, base × 2^(attempt−1)). Pure. */
export function backoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number, random: () => number = Math.random): number {
  return Math.floor(random() * Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1)));
}

export type AttemptContext = { signal: AbortSignal; attempt: number; /** budget for this attempt (≤ timeoutMs) */ remainingMs: number };

export type ResilienceOptions = {
  label: string;
  /** per attempt; default 30 s (capped by what is left of the deadline) */
  timeoutMs?: number;
  /** total budget including backoff; default 60 s */
  deadlineMs?: number;
  /** retries after the first attempt; default 2 */
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (c: ErrorClass) => boolean;
  breaker?: CircuitBreaker;
  /** defaults to `label` */
  breakerKey?: string;
  /** caller cancellation */
  signal?: AbortSignal;
  /** test hooks */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  onRetry?: (info: { attempt: number; delayMs: number; error: ErrorClass }) => void;
};

const BREAKER_FAILURES: ReadonlySet<ErrorKind> = new Set(["upstream_unavailable", "timeout", "network"]);

const callerAbort = () => Object.assign(new Error("The request was cancelled by the caller"), { name: "AbortError" });

const realSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(callerAbort());
    const onAbort = () => {
      clearTimeout(t);
      reject(callerAbort());
    };
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

/**
 * Run one attempt with its own AbortController. The timeout aborts the signal (reason: ResilienceTimeoutError) and also
 * rejects the race, so a fn that ignores the signal still times out (its work is abandoned, not cancelled).
 */
function runAttempt<T>(fn: (ctx: AttemptContext) => Promise<T>, attempt: number, budgetMs: number, label: string, caller?: AbortSignal): Promise<T> {
  const ctl = new AbortController();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const settle = (ok: boolean, v: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      caller?.removeEventListener("abort", onCaller);
      if (ok) resolve(v as T);
      else reject(v);
    };
    const onCaller = () => {
      const err = callerAbort();
      ctl.abort(err);
      settle(false, err);
    };
    const timer = setTimeout(() => {
      const err = new ResilienceTimeoutError(label, budgetMs);
      ctl.abort(err);
      settle(false, err);
    }, budgetMs);
    caller?.addEventListener("abort", onCaller, { once: true });
    Promise.resolve()
      .then(() => fn({ signal: ctl.signal, attempt, remainingMs: budgetMs }))
      .then(
        (v) => settle(true, v),
        (e) => settle(false, e),
      );
  });
}

/**
 * Call `fn` with per-attempt timeouts, a total deadline and jittered retries for retryable failures (timeout, 429, 5xx,
 * network, one malformed response). A Retry-After that does not fit in the remaining deadline stops immediately rather
 * than sleeping past it. Throws ResilienceError (message = honest user message) on final failure.
 */
export async function withResilience<T>(fn: (ctx: AttemptContext) => Promise<T>, opts: ResilienceOptions): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const deadlineMs = opts.deadlineMs ?? 60_000;
  const retries = opts.retries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 400;
  const maxDelayMs = opts.maxDelayMs ?? 8_000;
  const random = opts.random ?? Math.random;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => realSleep(ms, opts.signal));
  const isRetryable = opts.isRetryable ?? ((c: ErrorClass) => c.retryable);
  const key = opts.breakerKey ?? opts.label;
  const { breaker, signal, label } = opts;
  const start = now();
  let malformedSeen = 0;

  for (let attempt = 1; ; attempt++) {
    if (signal?.aborted) throw new ResilienceError(classifyError(callerAbort(), label), attempt - 1, signal.reason);
    const remaining = deadlineMs - (now() - start);
    if (remaining <= 0) {
      const err = new ResilienceTimeoutError(label, deadlineMs);
      throw new ResilienceError(classifyError(err, label), attempt - 1, err);
    }
    let checked = false;
    try {
      breaker?.check(key);
      checked = true;
      const value = await runAttempt(fn, attempt, Math.min(timeoutMs, remaining), label, signal);
      breaker?.success(key);
      return value;
    } catch (e) {
      const c = classifyError(e, label);
      if (breaker && checked) {
        if (BREAKER_FAILURES.has(c.kind)) breaker.failure(key, c.detail);
        // A cancelled half-open trial proves nothing: re-open rather than leave the trial slot stuck.
        else if (c.kind === "aborted") {
          if (breaker.status(key) === "half_open") breaker.failure(key, c.detail);
        } else breaker.success(key);
      }
      if (c.kind === "malformed_response") malformedSeen++;
      const retryable = attempt <= retries && c.kind !== "aborted" && !(c.kind === "malformed_response" && malformedSeen > 1) && isRetryable(c);
      if (!retryable) throw new ResilienceError(c, attempt, e);
      const delayMs = c.retryAfterMs !== undefined ? Math.max(0, Math.ceil(c.retryAfterMs)) : backoffDelay(attempt, baseDelayMs, maxDelayMs, random);
      if (delayMs >= deadlineMs - (now() - start)) throw new ResilienceError(c, attempt, e); // the wait would outlive the budget
      opts.onRetry?.({ attempt, delayMs, error: c });
      try {
        await sleep(delayMs);
      } catch (se) {
        throw new ResilienceError(classifyError(se, label), attempt, se);
      }
    }
  }
}

/* ── JSON ── */

export function parseJsonSafe(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** JSON.parse or MalformedResponseError (message carries ≤ 120 scrubbed chars of the body). */
export function parseJsonOrThrow(text: string, label: string): unknown {
  const r = parseJsonSafe(text);
  if (r.ok) return r.value;
  throw new MalformedResponseError(label, scrub(text ?? "", 120) || "(empty body)", scrub(r.error, 80));
}
