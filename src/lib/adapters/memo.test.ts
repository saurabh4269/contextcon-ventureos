// Live IC memo adapter (synthetic fields shaped like GET /api/deals/:domain/decisions; no real company data).
import { describe, expect, it } from "vitest";
import { ok, unavailable } from "@/lib/fields";
import type { DecisionsResponse } from "@/lib/numbers/decisions";
import { memoSources, riskFlags, toLiveMemo } from "./memo";

const at = "2026-10-31T05:00:00.000Z";
const crust = (path: string, endpoint = "POST /company/enrich") => ({ source: "Crustdata", endpoint, path, retrievedAt: at });
const mandate = { source: "Firm mandate (entered in Settings)", endpoint: "GET /api/settings/mandate", path: "sectors", url: "/settings/mandate" };
const usd = (amount: number) => ({ amount, currency: "USD" });
const fields = (o: Record<string, unknown> = {}) => ({
  fitScore: ok(100, "m", "2 of 2", [crust("taxonomy"), mandate]),
  diligenceVerdict: ok("Proceed to diligence", "m", "Screener: Advance. No risk flags in founders, growth or funding recency.", [crust("taxonomy")]),
  valuationLow: ok(usd(4_350_000), "Estimated revenue × peer median multiple", "r", [crust("revenue"), crust("peers", "POST /company/search")]),
  valuationHigh: ok(usd(8_700_000), "Estimated revenue × peer median multiple", "r", [crust("revenue")]),
  valuationCap: unavailable("A valuation cap comes from the term sheet, which this build does not ingest."),
  founderAsk: unavailable("No pitch ingested."),
  icMemoArrUsedM: ok(0.8, "Midpoint of the estimated revenue range", "r", [crust("revenue")]),
  criterionStage: unavailable("No last round type."),
  ...o,
});
const resp = (o: Record<string, unknown> = {}, open: { id: string; key: string; kind: string }[] = []): DecisionsResponse =>
  ({ dealId: "alpha.test", companyDomain: "alpha.test", source: "crustdata", decisions: {}, endpoints: {}, fields: fields(o), review: { runId: "r", href: "/review", open, resolved: [] } } as unknown as DecisionsResponse);

describe("memoSources", () => {
  it("numbers one source per cited endpoint, in field order", () => {
    const { sources, citeOf } = memoSources(fields() as never);
    expect(sources.map((s) => s.label)).toEqual(["Crustdata · /company/enrich", "Firm mandate · /api/settings/mandate", "Crustdata · /company/search"]);
    expect(sources.map((s) => s.kind)).toEqual(["crust", "db", "crust"]);
    expect(citeOf("valuationLow")).toBe(1);
    expect(citeOf("valuationCap")).toBe(0);
  });
});

describe("riskFlags", () => {
  it("counts the flags in the diligence reasoning", () => {
    expect(riskFlags(ok("Proceed with flags", "m", "Screener: Advance. Flags: no founders found on Crustdata; headcount down 5% YoY.", []))).toHaveLength(2);
    expect(riskFlags(fields().diligenceVerdict as never)).toEqual([]);
    expect(riskFlags(unavailable("x"))).toEqual([]);
  });
});

describe("toLiveMemo", () => {
  it("fills the memo from the fields; no cap or ask is invented", () => {
    const m = toLiveMemo("alpha.test", resp({}, [{ id: "ex1", key: "fitScore", kind: "low_confidence" }]), null);
    expect(m.company.name).toBe("alpha.test");
    expect(m.title).toBe("alpha.test");
    expect(m.recommendation.verdict).toBe("Proceed to diligence");
    expect(m.recommendation.valuation).toMatchObject({ low: 4.35, high: 8.7, unit: "M" });
    expect(m.recommendation.valuation.cap).toBeNaN();
    expect(m.recommendation.valuation.ask).toBeUndefined();
    expect(m.recommendation.valuation.capRationale).toMatch(/term sheet/);
    expect(m.recommendation.verifiedArr.value).toBe("~$0.8M");
    expect(m.conditions.map((c) => c.text)).toEqual(["Fit score: approve, reject or enter it in Review"]);
    expect(m.questions).toContain("Stage: No last round type.");
    expect(m.bridge).toEqual([]);
    expect(m.disagreement).toBeUndefined();
    expect(m.meta.citations).toBe(5);
  });
  it("says so when there is no verdict or valuation", () => {
    const m = toLiveMemo("alpha.test", resp({ diligenceVerdict: unavailable("x"), valuationLow: unavailable("no revenue"), icMemoArrUsedM: unavailable("no revenue") }), null);
    expect(m.recommendation.verdict).toBe("No recommendation yet");
    expect(m.recommendation.valuation.low).toBeNaN();
    expect(m.recommendation.verifiedArr.value).toBe("—");
    expect(m.outline.find((o) => o.id === "val")!.state).toBe("queued");
  });
  it("titles the memo with the research name and last round", () => {
    const research = { company: { name: "Alpha Labs", logoUrl: "https://example.test/logo.png", funding: { lastRoundType: "series_a", investors: [] } } } as never;
    const m = toLiveMemo("alpha.test", resp(), research);
    expect(m.title).toBe("Alpha Labs · Series A");
    expect(m.company.logoUrl).toBe("https://example.test/logo.png");
  });
});
