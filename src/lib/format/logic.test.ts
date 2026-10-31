import { describe, expect, it } from "vitest";
import { fmtAgo } from "./index";

describe("fmtAgo never rounds up into the next unit", () => {
  const now = new Date("2026-10-31T12:00:00Z");
  const ago = (ms: number) => fmtAgo(new Date(now.getTime() - ms).toISOString(), now);
  it("59 min 40 s is 59m, not 60m; 23 h 50 min is 23h, not 24h; 36 h is 1d", () => {
    expect(ago(59 * 60_000 + 40_000)).toBe("59m ago");
    expect(ago(23 * 3_600_000 + 50 * 60_000)).toBe("23h ago");
    expect(ago(36 * 3_600_000)).toBe("1d ago");
    expect(ago(60 * 60_000)).toBe("1h ago");
    expect(ago(86_400_000)).toBe("1d ago");
  });
  it("a timestamp slightly in the future (clock skew) reads just now", () => {
    expect(fmtAgo("2026-10-31T12:00:30Z", now)).toBe("just now");
  });
});
