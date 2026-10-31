// Tiny per-key circuit breaker. After `threshold` consecutive "unavailable" failures (5xx, timeout, transport) on a key
// the circuit opens for `cooldownMs`: calls fail fast with CircuitOpenError instead of waiting on a dead upstream. After
// the cooldown one trial call is let through (half-open); success closes the circuit, failure re-opens it.
// Client errors (4xx) and rate limits are answers, not outages, and never count.

export class CircuitOpenError extends Error {
  readonly key: string;
  /** epoch ms when the next trial call is allowed */
  readonly retryAt: number;
  constructor(key: string, retryAt: number, lastError: string | undefined) {
    super(`${key} is unavailable (circuit open after repeated failures${lastError ? `; last error: ${lastError}` : ""})`);
    this.name = "CircuitOpenError";
    this.key = key;
    this.retryAt = retryAt;
  }
}

type State = { failures: number; openUntil: number; trialInFlight: boolean; lastError?: string };

export class CircuitBreaker {
  private readonly states = new Map<string, State>();
  constructor(
    readonly threshold = 4,
    readonly cooldownMs = 30_000,
    private readonly now: () => number = Date.now,
  ) {}

  private state(key: string): State {
    let s = this.states.get(key);
    if (!s) this.states.set(key, (s = { failures: 0, openUntil: 0, trialInFlight: false }));
    return s;
  }

  /** Throws CircuitOpenError when the key is open (or half-open with a trial already in flight). */
  check(key: string): void {
    const s = this.state(key);
    if (s.failures < this.threshold) return;
    if (this.now() < s.openUntil || s.trialInFlight) throw new CircuitOpenError(key, Math.max(s.openUntil, this.now()), s.lastError);
    s.trialInFlight = true; // half-open: this caller is the trial
  }

  success(key: string): void {
    this.states.set(key, { failures: 0, openUntil: 0, trialInFlight: false });
  }

  failure(key: string, error?: string): void {
    const s = this.state(key);
    s.failures += 1;
    s.trialInFlight = false;
    s.lastError = error;
    if (s.failures >= this.threshold) s.openUntil = this.now() + this.cooldownMs;
  }

  status(key: string): "closed" | "open" | "half_open" {
    const s = this.states.get(key);
    if (!s || s.failures < this.threshold) return "closed";
    return this.now() < s.openUntil ? "open" : "half_open";
  }
}
