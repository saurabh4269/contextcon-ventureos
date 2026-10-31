import { describe, expect, it } from "vitest";
import { fmtAgo, fmtDate, fmtDateTime, fmtMoney, fmtTime, money } from ".";

describe("central formatter", () => {
  it("renders UTC instants in Asia/Kolkata with the IST label", () => {
    expect(fmtDateTime("2026-10-31T06:00:00Z")).toBe("31 Oct 2026, 11:30 IST");
    expect(fmtTime("2026-10-31T20:15:00.000Z")).toBe("01:45 IST");
    // crossing midnight: the IST date is the next day
    expect(fmtDate("2026-10-31T20:15:00Z")).toBe("1 Nov 2026");
  });
  it("leaves calendar dates unshifted", () => {
    expect(fmtDate("2024-03-15")).toBe("15 Mar 2024");
    expect(fmtDateTime("2024-03")).toBe("Mar 2024");
  });
  it("money keeps its own currency (no relabelling, no conversion)", () => {
    expect(fmtMoney(money(35_000_000, "USD"))).toBe("$35M");
    expect(fmtMoney(money(21_500_000, "inr"))).toBe("₹21.5M");
    expect(fmtMoney(money(800_000, "EUR"))).toBe("€800K");
    expect(fmtMoney(null)).toBe("—");
  });
  it("relative time", () => {
    const now = new Date("2026-10-31T12:00:00Z");
    expect(fmtAgo("2026-10-31T11:58:00Z", now)).toBe("2m ago");
    expect(fmtAgo(null, now)).toBe("never");
  });
});
