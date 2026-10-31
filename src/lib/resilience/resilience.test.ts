import { describe, expect, it, vi } from "vitest";
import { CrustdataApiError } from "@/lib/crustdata/http";
import {
  backoffDelay,
  CircuitBreaker,
  classifyError,
  MalformedResponseError,
  parseJsonOrThrow,
  parseJsonSafe,
  ResilienceError,
  ResilienceTimeoutError,
  withResilience,
  type ErrorClass,
} from "./index";

/** Same shape as nl-screener's ModelApiError (src/lib/agent/model.ts). */
class ModelApiError extends Error {
  constructor(readonly provider: string, readonly status: number, message: string) {
    super(`${provider} API ${status}: ${message}`);
    this.name = "ModelApiError";
  }
}

const noSleep = async () => {};
const fast = { sleep: noSleep, random: () => 0.5 };

/** fn that throws the given errors in order, then resolves "ok". */
function script(...errors: unknown[]) {
  let i = 0;
  return vi.fn(async () => {
    if (i < errors.length) throw errors[i++];
    return "ok";
  });
}

async function failure(p: Promise<unknown>): Promise<ResilienceError> {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(ResilienceError);
  return e as ResilienceError;
}

describe("withResilience", () => {
  it("returns the first successful result without retrying", async () => {
    const fn = script();
    const onRetry = vi.fn();
    await expect(withResilience(fn, { label: "Crustdata", ...fast, onRetry })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("retries a 503 and reports bounded jittered delays", async () => {
    const fn = script(new CrustdataApiError(503, { error: "down" }));
    const onRetry = vi.fn();
    await expect(withResilience(fn, { label: "Crustdata", ...fast, baseDelayMs: 400, onRetry })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    const { attempt, delayMs, error } = onRetry.mock.calls[0]![0] as { attempt: number; delayMs: number; error: ErrorClass };
    expect(attempt).toBe(1);
    expect(delayMs).toBe(200); // 0.5 × min(8000, 400 × 2^0)
    expect(error.kind).toBe("upstream_unavailable");
  });

  it.each([500, 502, 504])("retries %i", async (status) => {
    const fn = script(new ModelApiError("OpenAI", status, "boom"), new ModelApiError("OpenAI", status, "boom"));
    await expect(withResilience(fn, { label: "OpenAI", ...fast })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("gives up after `retries` with a ResilienceError carrying the classification", async () => {
    const fn = vi.fn(async () => {
      throw new CrustdataApiError(502, { error: "bad gateway" });
    });
    const e = await failure(withResilience(fn, { label: "Crustdata", ...fast, retries: 2 }));
    expect(fn).toHaveBeenCalledTimes(3);
    expect(e.attempts).toBe(3);
    expect(e.classification).toMatchObject({ kind: "upstream_unavailable", status: 502, retryable: true });
    expect(e.message).toBe("Crustdata is unavailable (502) — nothing was invented; try again shortly.");
    expect(e.cause).toBeInstanceOf(CrustdataApiError);
  });

  it.each([
    [400, "bad_request", "Crustdata rejected the request (400): filter is invalid"],
    [401, "auth", "Crustdata rejected the API key (401) — an operator must fix the key."],
    [403, "auth", "Crustdata refused access (403) — the key lacks permission for this; an operator must fix it."],
    [404, "not_found", "Crustdata returned not found (404): filter is invalid"],
    [402, "insufficient_credits", "Crustdata reports insufficient credits (402) — top up before retrying."],
    [422, "bad_request", "Crustdata rejected the request (422): filter is invalid"],
  ])("does not retry %i (%s)", async (status, kind, message) => {
    const fn = vi.fn(async () => {
      throw new CrustdataApiError(status, { error: "filter is invalid" });
    });
    const e = await failure(withResilience(fn, { label: "Crustdata", ...fast }));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(e.classification).toMatchObject({ kind, status, retryable: false });
    expect(e.message).toBe(message);
  });

  it("honours retryAfterMs on 429", async () => {
    const fn = script(new CrustdataApiError(429, { error: "slow down" }, 2));
    const onRetry = vi.fn();
    const slept: number[] = [];
    await expect(withResilience(fn, { label: "Crustdata", random: () => 0, sleep: async (ms) => void slept.push(ms), onRetry })).resolves.toBe("ok");
    expect(slept).toEqual([2000]);
    expect(onRetry.mock.calls[0]![0]).toMatchObject({ delayMs: 2000, error: { kind: "rate_limited", retryAfterMs: 2000 } });
  });

  it("gives up on 429 when Retry-After does not fit in the deadline", async () => {
    const fn = vi.fn(async () => {
      throw new CrustdataApiError(429, { error: "slow down" }, 120);
    });
    const sleep = vi.fn(noSleep);
    const e = await failure(withResilience(fn, { label: "Crustdata", sleep, deadlineMs: 60_000 }));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(e.classification.kind).toBe("rate_limited");
    expect(e.message).toMatch(/^Crustdata is rate-limiting requests \(429\); nothing was returned\. Retry after \d{2}:\d{2} IST\.$/);
  });

  it("times out a fn that never resolves, retries, then fails with kind timeout", async () => {
    const fn = vi.fn(() => new Promise<string>(() => {}));
    const e = await failure(withResilience(fn, { label: "OpenAI gpt-x", ...fast, timeoutMs: 20, retries: 1 }));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(e.classification).toMatchObject({ kind: "timeout", retryable: true });
    expect(e.cause).toBeInstanceOf(ResilienceTimeoutError);
    expect(e.message).toBe("OpenAI gpt-x did not answer within 20 ms — nothing was invented; try again shortly.");
  });

  it("aborts the attempt signal on timeout", async () => {
    let seen: AbortSignal | undefined;
    const fn = vi.fn(({ signal }: { signal: AbortSignal }) => {
      seen = signal;
      return new Promise<string>(() => {});
    });
    await failure(withResilience(fn, { label: "x", ...fast, timeoutMs: 20, retries: 0 }));
    expect(seen?.aborted).toBe(true);
    expect(seen?.reason).toBeInstanceOf(ResilienceTimeoutError);
  });

  it("caps total attempts by the deadline (backoff counts against it)", async () => {
    let clock = 0;
    const fn = vi.fn(async () => {
      throw new CrustdataApiError(503, { error: "down" });
    });
    const e = await failure(
      withResilience(fn, {
        label: "Crustdata",
        retries: 10,
        deadlineMs: 1000,
        baseDelayMs: 400,
        random: () => 1,
        now: () => clock,
        sleep: async (ms) => void (clock += ms),
      }),
    );
    // attempt 1 → wait 400 (600 left) → attempt 2 → wait 800 does not fit → stop
    expect(fn).toHaveBeenCalledTimes(2);
    expect(e.attempts).toBe(2);
  });

  it("passes the per-attempt budget (min of timeout and remaining deadline)", async () => {
    const fn = vi.fn(async ({ remainingMs, attempt }: { remainingMs: number; attempt: number }) => `${attempt}:${remainingMs}`);
    await expect(withResilience(fn, { label: "x", timeoutMs: 30_000, deadlineMs: 5_000, now: () => 0 })).resolves.toBe("1:5000");
  });

  it("stops on caller abort without retrying", async () => {
    const ctl = new AbortController();
    const fn = vi.fn(() => {
      setTimeout(() => ctl.abort(), 1);
      return new Promise<string>(() => {});
    });
    const e = await failure(withResilience(fn, { label: "OpenAI", ...fast, signal: ctl.signal, timeoutMs: 1000 }));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(e.classification).toMatchObject({ kind: "aborted", retryable: false });
  });

  it("does not start when the caller signal is already aborted", async () => {
    const ctl = new AbortController();
    ctl.abort();
    const fn = script();
    const e = await failure(withResilience(fn, { label: "x", ...fast, signal: ctl.signal }));
    expect(fn).not.toHaveBeenCalled();
    expect(e.classification.kind).toBe("aborted");
  });

  it("opens the breaker after the threshold and then fails fast with circuit_open", async () => {
    const breaker = new CircuitBreaker(3, 30_000);
    const fn = vi.fn(async () => {
      throw new ModelApiError("OpenAI", 503, "overloaded");
    });
    await failure(withResilience(fn, { label: "OpenAI", ...fast, breaker, breakerKey: "model:openai:x", retries: 2 }));
    expect(fn).toHaveBeenCalledTimes(3);
    expect(breaker.status("model:openai:x")).toBe("open");

    const e = await failure(withResilience(fn, { label: "OpenAI", ...fast, breaker, breakerKey: "model:openai:x" }));
    expect(fn).toHaveBeenCalledTimes(3); // not called again
    expect(e.attempts).toBe(1);
    expect(e.classification).toMatchObject({ kind: "circuit_open", retryable: false });
    expect(e.message).toMatch(/^model:openai:x is paused after repeated failures; nothing was sent\. Retry after \d{2}:\d{2} IST\.$/);
  });

  it("does not count client errors against the breaker", async () => {
    const breaker = new CircuitBreaker(2, 30_000);
    const fn = vi.fn(async () => {
      throw new CrustdataApiError(400, { error: "bad" });
    });
    for (let i = 0; i < 3; i++) await failure(withResilience(fn, { label: "Crustdata", ...fast, breaker }));
    expect(breaker.status("Crustdata")).toBe("closed");
  });

  it("retries a malformed response only once", async () => {
    const fn = vi.fn(async () => parseJsonOrThrow("<html>502 Bad Gateway</html>", "Crustdata"));
    const e = await failure(withResilience(fn, { label: "Crustdata", ...fast, retries: 5 }));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(e.classification).toMatchObject({ kind: "malformed_response" });
    expect(e.message).toBe("Crustdata returned a response that could not be read — nothing was invented; try again.");
  });

  it("treats fetch failed as a retryable network error", async () => {
    const fn = script(Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } }));
    const onRetry = vi.fn();
    await expect(withResilience(fn, { label: "Crustdata", ...fast, onRetry })).resolves.toBe("ok");
    expect(onRetry.mock.calls[0]![0].error).toMatchObject({ kind: "network", retryable: true });
  });

  it("lets isRetryable veto retries", async () => {
    const fn = script(new CrustdataApiError(503, { error: "down" }));
    await failure(withResilience(fn, { label: "Crustdata", ...fast, isRetryable: () => false }));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("classifyError", () => {
  it("classifies structurally", () => {
    expect(classifyError(new TypeError("fetch failed"))).toMatchObject({ kind: "network", retryable: true });
    expect(classifyError(Object.assign(new Error("getaddrinfo ENOTFOUND api.openai.com"), { code: "ENOTFOUND" })).kind).toBe("network");
    expect(classifyError(new Error("Crustdata GET /screener/company timed out after 30000 ms"))).toMatchObject({ kind: "timeout", retryable: true });
    expect(classifyError(new Error("Crustdata POST /x transport error: socket hang up")).kind).toBe("network");
    expect(classifyError(Object.assign(new Error("aborted"), { name: "AbortError" }))).toMatchObject({ kind: "aborted", retryable: false });
    expect(classifyError(Object.assign(new Error("signal timed out"), { name: "TimeoutError" })).kind).toBe("timeout");
    expect(classifyError(new SyntaxError("Unexpected token <")).kind).toBe("malformed_response");
    expect(classifyError("weird")).toMatchObject({ kind: "unknown", retryable: false });
  });

  it("names the provider from ModelApiError and keeps secrets and long bodies out", () => {
    const c = classifyError(new ModelApiError("Anthropic", 400, `bad key sk-ant-abcdefghijklmnop ${"x".repeat(500)}`), "fallback label");
    expect(c.kind).toBe("bad_request");
    expect(c.userMessage.startsWith("Anthropic rejected the request (400)")).toBe(true);
    expect(c.userMessage).not.toContain("sk-ant-abcdefghijklmnop");
    expect(c.detail).not.toContain("sk-ant-abcdefghijklmnop");
    expect(c.detail.length).toBeLessThanOrEqual(200);
    expect(c.userMessage.length).toBeLessThanOrEqual(200);
  });

  it("uses the ModelApiError provider in auth messages", () => {
    expect(classifyError(new ModelApiError("OpenAI", 401, "Incorrect API key")).userMessage).toBe("OpenAI rejected the API key (401) — an operator must fix the key.");
  });

  it("passes a ResilienceError's classification through", () => {
    const c = classifyError(new CrustdataApiError(503, { error: "x" }));
    expect(classifyError(new ResilienceError(c, 3, null))).toBe(c);
  });
});

describe("JSON helpers", () => {
  it("parseJsonSafe never throws", () => {
    expect(parseJsonSafe('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseJsonSafe("{a:1}").ok).toBe(false);
  });

  it("parseJsonOrThrow raises MalformedResponseError with a short, control-char-free snippet", () => {
    const body = `<html>\u0000\u0007${"y".repeat(300)}`;
    let err: unknown;
    try {
      parseJsonOrThrow(body, "Crustdata");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(MalformedResponseError);
    const m = (err as Error).message;
    expect(m).not.toMatch(/[\u0000-\u001f]/);
    expect((err as MalformedResponseError).snippet.length).toBeLessThanOrEqual(120);
    expect(classifyError(err)).toMatchObject({ kind: "malformed_response", retryable: true });
  });
});

describe("backoffDelay", () => {
  it("is full-jitter exponential and capped", () => {
    expect(backoffDelay(1, 400, 8000, () => 1)).toBe(400);
    expect(backoffDelay(3, 400, 8000, () => 1)).toBe(1600);
    expect(backoffDelay(10, 400, 8000, () => 1)).toBe(8000);
    expect(backoffDelay(4, 400, 8000, () => 0)).toBe(0);
    expect(backoffDelay(2, 400, 8000, () => 0.25)).toBe(200);
  });
});
