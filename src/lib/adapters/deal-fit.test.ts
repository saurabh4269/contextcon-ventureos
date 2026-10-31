// Fit card "Signals into fit" from the decisions response (synthetic fields shaped like GET /api/deals/:domain/decisions).
import { fixtureClient } from "@/test/crustdata";
import { describe, expect, it } from "vitest";
import { ok, unavailable, type ComputedField } from "@/lib/fields";
import { researchCompany } from "@/lib/live/research";
import type { ResearchResult } from "@/lib/live/types";
import { fitContributions, toLiveDeal, withDecisionFit } from "./deal";

const now = new Date("2026-10-31T06:00:00Z");
const cite = { source: "Crustdata", endpoint: "POST /company/enrich", path: "[0].matches[0].company_data.taxonomy", retrievedAt: "2026-10-31T05:00:00.000Z" };
const crit = (v: string, why = `synthetic ${v}`) => ok(v, "Synthetic criterion", why, [cite]);
const fit = (score: number) => ok(score, "Share of scored mandate criteria met × 100", "synthetic", [cite]);
const fields = (o: Record<string, ComputedField<unknown>>) => ({
  criterionSector: crit("met"),
  criterionStage: unavailable("Crustdata returned no last round type for example.test (funding.last_round_type)."),
  criterionGeo: crit("met"),
  criterionCheckSize: unavailable("No last round amount."),
  criterionMemory: ok("no prior decisions", "Past review-queue decisions", "neutral (not scored)", [cite]),
  ...o,
});
async function deal() {
  const r = await researchCompany(fixtureClient(), "e2b.dev");
  if (r.status !== "ok") throw new Error(r.status);
  return toLiveDeal(r as Extract<ResearchResult, { status: "ok" }>, now);
}

describe("fitContributions", () => {
  it("splits the score over met criteria; unavailable and unscored criteria contribute 0 with their reason", () => {
    const c = fitContributions(fields({}), 100)!;
    expect(c.map((k) => k.id)).toEqual(["criterionSector", "criterionStage", "criterionGeo", "criterionCheckSize", "criterionMemory"]);
    expect(c.map((k) => k.weight)).toEqual([50, 0, 50, 0, 0]);
    expect(c[1]!.label).toBe("Stage · not scored");
    expect(c[1]!.source).toMatch(/no last round type/);
    expect(c[4]!.label).toBe("Firm memory · no prior decisions · not scored");
  });

  it("weights sum to the rounded score exactly (largest remainder)", () => {
    const c = fitContributions(fields({ criterionStage: crit("not met") }), 67)!;
    expect(c.reduce((a, k) => a + k.weight, 0)).toBe(67);
    expect(c.find((k) => k.id === "criterionStage")!.weight).toBe(0);
    expect(fitContributions(fields({ criterionSector: crit("not met"), criterionGeo: crit("not met") }), 0)!.every((k) => k.weight === 0)).toBe(true);
  });

  it("returns null when the criteria do not reproduce the score (no made-up split)", () => {
    expect(fitContributions(fields({}), 78)).toBeNull();
    expect(fitContributions({ criterionSector: unavailable("x") }, 0)).toBeNull();
  });
});

describe("withDecisionFit", () => {
  it("header pill and tile equal fitScore; every contribution has a score event that lands before the decision", async () => {
    const d = withDecisionFit(await deal(), fields({ fitScore: fit(100), screenerVerdict: ok("Advance", "Synthetic", "every scored criterion met", [cite]) }));
    const f = d.signals!.fit;
    expect(d.header.fit).toEqual({ score: 100 });
    expect(f.unscored).toBeUndefined();
    expect(f.base.value).toBe(0);
    expect(f.base.value! + f.contributions.reduce((a, k) => a + k.weight, 0)).toBe(100);
    const tl = d.signals!.timeline;
    const decide = tl.find((e) => e.type === "decide")!.at;
    const lastCall = Math.max(...tl.filter((e) => e.type === "done").map((e) => e.at));
    for (const k of f.contributions) {
      const s = tl.find((e) => e.type === "score" && e.contribution === k.id);
      expect(s, k.id).toBeDefined();
      expect(s!.at).toBeGreaterThan(lastCall);
      expect(s!.at).toBeLessThan(decide);
    }
    expect(tl.filter((e) => e.type === "decide")).toHaveLength(1);
    expect(f.recommendation.label).toBe("Advance");
  });

  it("a score the criteria cannot explain stays the base score with no contributions", async () => {
    const d = withDecisionFit(await deal(), fields({ fitScore: fit(78) }));
    expect(d.header.fit).toEqual({ score: 78 });
    expect(d.signals!.fit.base.value).toBe(78);
    expect(d.signals!.fit.contributions).toEqual([]);
  });

  it("unavailable fitScore keeps the tile unscored with its reason", async () => {
    const d = withDecisionFit(await deal(), fields({ fitScore: unavailable("No firm mandate is set.") }));
    expect(d.header.fit).toBeUndefined();
    expect(d.signals!.fit.unscored!.reason).toMatch(/mandate/);
  });
});
