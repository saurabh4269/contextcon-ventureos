import { describe, expect, it } from "vitest";
import { createCrustdataClient } from "@/lib/crustdata";
import { explain, isOk, show } from "@/lib/fields";
import { researchCompany } from "@/lib/live/research";
import { DEAL_NUMBER_KEYS, liveDealNumbers, liveDealValuation } from "./deal-numbers";
import { companyFields } from "./company-fields";
import { demoDeal } from "./demo";

const research = async () => {
  const r = await researchCompany(createCrustdataClient({ forceFixture: true }), "e2b.dev");
  if (r.status !== "ok") throw new Error(`expected ok, got ${r.status}`);
  return r;
};

describe("live company fields (real E2B captures)", () => {
  it("computes headcount, growth and funding with method, inputs and citations", async () => {
    const f = companyFields(await research());
    expect(f.headcountLatest).toMatchObject({ status: "ok", value: 52 });
    expect(f.growthYoY).toMatchObject({ status: "ok", value: 136.4 });
    expect(f.lastFundingUsdM).toMatchObject({ status: "ok", value: 21 });
    expect(f.fundingTotalUsdM).toMatchObject({ status: "ok", value: 35 });
    expect(f.openRoles).toMatchObject({ status: "ok", value: 32 });
    for (const k of ["headcountLatest", "growthYoY", "lastFundingUsdM", "openRoles"] as const) {
      const v = f[k];
      if (!isOk(v)) throw new Error(k);
      expect(v.citations[0]).toMatchObject({ source: "Crustdata" });
      expect(v.citations[0]!.endpoint).toMatch(/^POST \//);
      expect(v.citations[0]!.path).toBeTruthy();
      expect(v.inputs.length).toBeGreaterThan(0);
    }
    expect(f.headcountLatest.status === "ok" && f.headcountLatest.citations[0]!.path).toBe("[0].matches[0].company_data.headcount.total");
  });

  it("never invents a fit/signal score", async () => {
    const f = companyFields(await research());
    expect(f.signalScore.status).toBe("unavailable");
    expect(explain(f.signalScore)).toMatch(/^Unavailable: /);
    expect(show(f.signalScore)).toBe("—");
  });

  it("deal numbers: Crustdata-backed fields ok, pipeline fields unavailable with reasons", async () => {
    const n = liveDealNumbers(companyFields(await research()));
    expect(Object.keys(n).sort()).toEqual([...DEAL_NUMBER_KEYS].sort());
    expect(n.headcountLatest.status).toBe("ok");
    for (const k of ["fitScore", "returnMultipleLow", "compsMedianMultiple", "diligenceVerdict", "icMemoValuation"] as const) {
      expect(n[k]).toMatchObject({ status: "unavailable" });
      expect((n[k] as { reason: string }).reason.length).toBeGreaterThan(20);
    }
    expect(Object.values(liveDealValuation()).every((f) => f.status === "unavailable")).toBe(true);
  });
});

describe("demo numbers module", () => {
  it("feeds the same shape, every citation labelled demo data", () => {
    const d = demoDeal("helio")!;
    expect(d.fields.fitScore).toMatchObject({ status: "ok", value: 72 });
    expect(d.fields.compsMedianMultiple).toMatchObject({ status: "ok", value: 11 });
    for (const f of [...Object.values(d.fields), ...Object.values(d.explainable)]) {
      if (isOk(f)) expect(f.citations.every((c) => c.source.startsWith("Demo data"))).toBe(true);
    }
    expect(demoDeal("e2b.dev")).toBeUndefined();
  });
});
