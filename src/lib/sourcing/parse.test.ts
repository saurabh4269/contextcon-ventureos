import { describe, expect, it } from "vitest";
import { parseRequest } from "./parse";

describe("sourcing parser: bounds are read the way they are written", () => {
  const plan = (q: string) => { const r = parseRequest(q, new Date("2026-10-31T00:00:00Z")); if (r.kind !== "search") throw new Error(`not a search: ${q}`); return r.plan; };
  it("'fewer than 50' / 'under 50' exclude 50; 'at most 50' includes it", () => {
    expect(plan("startups with fewer than 50 employees in the US").headcountMax).toBe(49);
    expect(plan("startups with under 50 employees in the US").headcountMax).toBe(49);
    expect(plan("startups with at most 50 employees in the US").headcountMax).toBe(50);
    expect(plan("startups with up to 50 employees in the US").headcountMax).toBe(50);
  });
  it("'more than 200' / 'over 200' exclude 200; 'at least 200' and '200+' include it", () => {
    expect(plan("AI companies with more than 200 employees in India").headcountMin).toBe(201);
    expect(plan("AI companies with over 200 employees in India").headcountMin).toBe(201);
    expect(plan("AI companies with at least 200 employees in India").headcountMin).toBe(200);
    expect(plan("AI companies with 200+ employees in India").headcountMin).toBe(200);
  });
  it("an upper bound on growth is never turned into a minimum", () => {
    for (const q of ["fintech in India with growth under 10%", "fintech in India growing less than 10% in 6 months", "fintech in India with headcount growth below 5%"]) {
      const r = parseRequest(q, new Date("2026-10-31T00:00:00Z"));
      const p = r.kind === "search" ? r.plan : null;
      expect(p?.growth, q).toBeUndefined();
      expect(p?.headcountMin, q).toBeUndefined();
      expect(r.kind === "search" ? r.plan.interpretation.some((i) => i.key === "growth") : false, q).toBe(false);
    }
  });
});
