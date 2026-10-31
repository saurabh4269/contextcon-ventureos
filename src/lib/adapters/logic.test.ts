// Counts and labels on Today and Pipeline must describe the rows that are on the page (and use IST for "this year").
import { describe, expect, it } from "vitest";
import type { PipelineDealRow } from "@/lib/inbox/pipeline";
import { liveRows, toTodaySummary, salutationAt } from "./today";
import { toLivePipeline } from "./pipeline";

const ask = { prompt: "", chips: [], placeholder: "" };
const base = { greeting: "", open: 0, inboundSpan: 7, inbound: { unavailable: "x" }, meetings: [] as never[], ask };

describe("Today header text", () => {
  it("'no fit score yet' counts only deals still on the page, not Portfolio or Passed ones", () => {
    const now = new Date("2026-10-31T06:00:00Z");
    const pipeline: PipelineDealRow[] = [
      { domain: "closed.test", name: "Closed", href: "/deal?domain=closed.test", source: "tracked", at: "2026-10-30T00:00:00Z", stage: "portfolio" },
      { domain: "open.test", name: "Open", href: "/deal?domain=open.test", source: "tracked", at: "2026-10-30T00:00:00Z", stage: "diligence" },
    ];
    const d = toTodaySummary({ ...base, now, deals: [{ domain: "closed.test", lastAt: "2026-10-30T00:00:00Z", open: 0 }, { domain: "open.test", lastAt: "2026-10-30T00:00:00Z", open: 0 }], pipeline });
    expect(d.rows.map((r) => r.id)).toEqual(["open.test"]);
    expect(d.sub).toContain("1 researched deal has no fit score yet.");
  });
});

describe("Pipeline header", () => {
  it("'passed this year' uses the IST calendar year (UTC would split 31 Dec 20:00 UTC from 1 Jan IST)", () => {
    const now = new Date("2027-01-01T05:00:00Z"); // 10:30 IST, 1 Jan 2027
    const rows = liveRows([], [{ domain: "gone.test", name: "Gone", href: "/deal?domain=gone.test", source: "tracked", at: "2026-12-31T20:00:00Z", stage: "passed" }], now); // 01:30 IST, 1 Jan 2027
    expect(toLivePipeline(rows, now).header.passedThisYear).toBe(1);
  });
});

describe("greeting hour", () => {
  const t = new Date("2026-10-31T21:00:00Z"); // 02:30 IST on 1 Nov, 21:00 UTC on 31 Oct
  it("follows the viewer's time zone, falling back to IST when none or an invalid one is given", () => {
    expect(salutationAt(t, "Asia/Kolkata")).toBe("Working late");
    expect(salutationAt(t, "UTC")).toBe("Good evening");
    expect(salutationAt(t, "America/Los_Angeles")).toBe("Good afternoon");
    expect(salutationAt(t, undefined)).toBe("Working late");
    expect(salutationAt(t, "Not/AZone")).toBe("Working late");
  });
  it("band edges: 05:00 morning, 12:00 afternoon, 17:00 evening, 22:00 late", () => {
    const at = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 31, h - 5, m - 30)); // IST wall clock h:m
    expect(salutationAt(at(4, 59), "Asia/Kolkata")).toBe("Working late");
    expect(salutationAt(at(5), "Asia/Kolkata")).toBe("Good morning");
    expect(salutationAt(at(12), "Asia/Kolkata")).toBe("Good afternoon");
    expect(salutationAt(at(17), "Asia/Kolkata")).toBe("Good evening");
    expect(salutationAt(at(22), "Asia/Kolkata")).toBe("Working late");
  });
});

describe("Pipeline 'new this week'", () => {
  const now = new Date("2026-10-31T06:00:00Z");
  it("counts deals first seen in the last 7 days, not old deals that were touched again", () => {
    const rows = liveRows(
      [{ domain: "old.test", lastAt: "2026-10-31T01:00:00Z", firstAt: "2026-09-01T00:00:00Z", open: 0 }, { domain: "new.test", lastAt: "2026-10-30T01:00:00Z", firstAt: "2026-10-29T00:00:00Z", open: 0 }],
      [{ domain: "tracked-old.test", name: "T", href: "/deal?domain=tracked-old.test", source: "tracked", at: "2026-10-31T02:00:00Z", firstAt: "2026-08-01T00:00:00Z", stage: "screening" }],
      now,
    );
    const p = toLivePipeline(rows, now);
    expect(p.header.active).toBe(3);
    expect(p.header.newThisWeek).toBe(1);
    expect(p.stats![0]!.delta).toBe("+1");
  });
});

import { growth } from "./brain";
describe("Firm brain growth months", () => {
  it("buckets events by IST month (31 Oct 20:00 UTC is already 1 Nov in IST)", () => {
    const ev = (id: string, at: string) => ({ id, at, kind: "deal.opened", actor: { type: "user" as const }, summary: "s", source: "t" });
    const g = growth([ev("1", "2026-10-31T20:00:00Z")], new Date("2026-11-15T06:00:00Z"));
    expect(g.labels).toEqual(["Oct", "Nov"]);
    expect(g.trend).toEqual([0, 1]);
  });
});
