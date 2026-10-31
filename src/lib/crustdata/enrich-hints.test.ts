import { describe, expect, it } from "vitest";
import { latestHeadcountFromCompanyData, screenerHintsFromEnrich } from "./enrich-hints";
import { loadFixture } from "./fixtures";

describe("enrich-hints against the live E2B enrich capture", () => {
  const e2b = loadFixture<unknown>("company-enrich-e2b.json");

  it("reads headcount.total, funding.last_round_type and the HQ country from their real paths", () => {
    const hints = screenerHintsFromEnrich(e2b);
    expect(hints.headcountLatest).toBe(52);
    expect(hints.fundingStage).toBe("series_a");
    expect(hints.hqCountry).toBe("USA");
  });

  it("picks the newest timeseries point even though the API does not sort the series", () => {
    expect(
      latestHeadcountFromCompanyData({ headcount: { timeseries: [{ date: "2026-10-01", employee_count: 52 }, { date: "2023-02-13", employee_count: 1 }] } }),
    ).toBe(52);
  });

  it("returns no hints for an unknown domain (matches: [])", () => {
    expect(screenerHintsFromEnrich(loadFixture("company-enrich-zz9-no-such-startup-qx7.json")).headcountLatest).toBeUndefined();
  });
});
