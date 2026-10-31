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
    expect(d.stats!.map((s) => s.value)).toEqual(["2", "0", "0", "—"]);
    expect(d.sectors).toEqual([{ label: "Not researched", count: 2 }]);
  });
  it("stages and owners come from the deal-stage store rows; closed deals leave the table, passed ones count", () => {
    const moved = liveRows(
      [{ domain: "alpha.test", lastAt: "2026-10-30T06:00:00Z", open: 0, decisions }],
      [
        { domain: "alpha.test", name: "Alpha", href: "/workflow?id=w1", source: "tracked", at: "2026-10-30T07:00:00Z", stage: "diligence", owner: "Ada Lovelace", workflowId: "w1" },
        { domain: "gamma.test", name: "Gamma", href: "/deal?domain=gamma.test", source: "tracked", at: "2026-10-29T07:00:00Z", stage: "screening", owner: null },
        { domain: "delta.test", name: "Delta", href: "/workflow?id=w2", source: "tracked", at: "2026-10-28T07:00:00Z", stage: "passed", owner: "Ada Lovelace", workflowId: "w2" },
        { domain: "omega.test", name: "Omega", href: "/workflow?id=w3", source: "tracked", at: "2026-10-27T07:00:00Z", stage: "portfolio", owner: "Ada Lovelace", workflowId: "w3" },
      ],
      now,
    );
    const p = toLivePipeline(moved, now, { storageNote: "instance /tmp files (not durable)" });
    expect(p.deals.map((x) => [x.id, x.stage, x.owner, x.ownerName])).toEqual([["alpha.test", "dd", "AL", "Ada Lovelace"], ["gamma.test", "review", "", ""]]);
    expect(p.stages.map((s) => [s.id, s.count])).toEqual([["sourced", 0], ["review", 1], ["partner", 0], ["dd", 1], ["ic", 0], ["ts", 0]]);
    expect(p.header.passedThisYear).toBe(1);
    expect(p.stats!.find((s) => s.id === "dd")!.value).toBe("1");
    expect(p.footnote).toMatch(/Stages: instance \/tmp files \(not durable\)$/);
    expect(moved[0]!.row.href).toBe("/workflow?id=w1");
    expect(moved[0]!.row.stage).toBe("diligence");
  });
  it("is empty (the screen's empty state) without rows", () => {
    expect(toLivePipeline([], now).deals).toEqual([]);
  });
});
