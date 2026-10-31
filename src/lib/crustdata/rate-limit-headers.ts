/** Parse Retry-After / X-RateLimit-Reset as seconds to wait (handles epoch reset). */
export function parseRateLimitWaitSeconds(headers: Headers, attempt: number): number {
  const retryAfter = headers.get("Retry-After");
  if (retryAfter) {
    const n = parseInt(retryAfter, 10);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  const reset = headers.get("X-RateLimit-Reset");
  if (reset) {
    const n = parseInt(reset, 10);
    if (!Number.isNaN(n)) {
      if (n > 1_000_000_000) {
        return Math.max(1, n - Math.floor(Date.now() / 1000));
      }
      return Math.max(1, n);
    }
  }
  return Math.max(1, 2 ** attempt);
}
