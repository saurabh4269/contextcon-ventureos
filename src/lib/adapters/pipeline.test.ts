// Live Pipeline adapter (synthetic rows shaped like the live Today rows; no real company data).
import { describe, expect, it } from "vitest";
import { ok } from "@/lib/fields";
import type { DecisionsResponse } from "@/lib/numbers/decisions";
import { liveRows } from "./today";
import { toLivePipeline } from "./pipeline";

const now = new Date("2026-10-31T06:00:00Z");
const cite = { source: "Crustdata", endpoint: "POST /company/enrich", path: "x", retrievedAt: "2026-10-31T05:00:00.000Z" };
const decisions = { fields: { fitScore: ok(80, "m", "4 of 5", [cite]), criterionSector: ok("met", "m", "w", [cite]) } } as unknown as DecisionsResponse;

describe("toLivePipeline", () => {
  const rows = liveRows(
    [{ domain: "alpha.test", lastAt: "2026-10-30T06:00:00Z", open: 0, decisions }],
    [{ domain: "beta.test", name: "beta seed pitch", href: "/deal?domain=beta.test", source: "inbound", at: "2026-10-20T06:00:00Z" }],
    now,
  );
  const d = toLivePipeline(rows, now);
  it("keeps only real rows, all at the first stage", () => {
    expect(d.deals.map((x) => x.id)).toEqual(["alpha.test", "beta.test"]);
    expect(d.deals.every((x) => x.stage === "sourced")).toBe(true);
    expect(d.stages.map((s) => s.count)).toEqual([2, 0, 0, 0, 0, 0]);
  });
  it("takes fit from decisions; unscored rows have no number", () => {
    expect(d.deals[0]!.thesisFit).toBe(0.8);
    expect(d.deals[0]!.fitSignals).toEqual([{ label: "sector met", effect: "up" }]);
    expect(d.deals[1]!.thesisFit).toBeNaN();
    expect(d.deals[1]!.owner).toBe("");
  });
  it("counts recent activity and leaves unknown stats as —", () => {
    expect(d.header).toMatchObject({ active: 2, newThisWeek: 1 });
    expect(d.deals.map((x) => x.lastTouch)).toEqual([{ label: "Yesterday", days: 1 }, { label: "11 d", days: 11 }]);
    expect(d.stats!.map((s) => s.value)).toEqual(["2", "0", "—", "—"]);
    expect(d.sectors).toEqual([{ label: "Not researched", count: 2 }]);
  });
  it("is empty (the screen's empty state) without rows", () => {
    expect(toLivePipeline([], now).deals).toEqual([]);
  });
});
