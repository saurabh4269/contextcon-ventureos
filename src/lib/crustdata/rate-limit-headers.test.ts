import { describe, expect, it } from "vitest";
import { parseRateLimitWaitSeconds } from "./rate-limit-headers";

describe("Crustdata rate limit headers", () => {
  it("treats X-RateLimit-Reset as epoch seconds", () => {
    const future = Math.floor(Date.now() / 1000) + 30;
    const headers = new Headers({ "X-RateLimit-Reset": String(future) });
    const wait = parseRateLimitWaitSeconds(headers, 1);
    expect(wait).toBeGreaterThanOrEqual(25);
    expect(wait).toBeLessThanOrEqual(35);
  });

  it("treats small X-RateLimit-Reset as seconds to wait", () => {
    const headers = new Headers({ "X-RateLimit-Reset": "12" });
    expect(parseRateLimitWaitSeconds(headers, 1)).toBe(12);
  });
});
