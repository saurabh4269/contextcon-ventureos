// Business-logic audit: each test names a bug that existed in scoring / valuation / mandate parsing / review values.
import { describe, expect, it, vi } from "vitest";
import { fixtureClient } from "@/test/crustdata";
import { isOk, ok, type ComputedField } from "@/lib/fields";
import { researchCompany } from "@/lib/live/research";
import { parseMandate, type Mandate } from "@/lib/settings/mandate";
import { compsMedianMultiple, criterionGeo, criterionSector, icMemoArr, valuationRange, type Peer, type PeerSearch } from "./local";
import { companyFields } from "./company-fields";
import { liveDealNumbers, liveDealValuation } from "./deal-numbers";
import { localDecisions, type DecisionsResponse } from "./decisions";
import { applyDecisionReviews, decisionItemKey } from "@/lib/exceptions/decisions";
import type { ExceptionItem } from "@/lib/exceptions/types";

vi.mock("server-only", () => ({}));

const e2b = async () => {
  const r = await researchCompany(fixtureClient(), "e2b.dev");
  if (r.status !== "ok") throw new Error(r.status);
  return r;
};
const mandate = (over: Record<string, unknown> = {}): Mandate => {
  const p = parseMandate({ priors: { dilutionPct: { low: 15, high: 25 }, returnMultiple: { low: 3, high: 10 } }, ...over });
  if (!p.ok) throw new Error(p.message);
  return p.mandate;
};
const peers = (data: Peer[]): PeerSearch => ({
  call: { id: "peers", method: "POST", path: "/company/search", body: {}, status: "ok", ms: 1, cached: false, retrievedAt: "2026-10-31T08:00:00Z", creditsUsed: "1", data },
  matched: ["sector"],
});
const withCompany = async (patch: (c: Awaited<ReturnType<typeof e2b>>["company"]) => void) => {
  const r = structuredClone(await e2b());
  patch(r.company);
  return r;
};

describe("sector matching", () => {
  it("a short sector (AI) does not match inside other words (retail, maintenance)", async () => {
    const r = await withCompany((c) => { c.industries = ["Retail"]; c.categories = ["Maintenance"]; c.description = "We sell retail maintenance contracts."; });
    expect(criterionSector(r, mandate({ sectors: ["AI"] }))).toMatchObject({ status: "ok", value: "not met" });
  });
  it("still matches the whole phrase and whole words", async () => {
    const r = await withCompany((c) => { c.industries = ["Artificial Intelligence"]; c.categories = []; c.description = undefined; });
    expect(criterionSector(r, mandate({ sectors: ["AI", "artificial intelligence"] }))).toMatchObject({ value: "met" });
  });
});

describe("geography matching", () => {
  const geo = async (country: string, hq: string, geos: string[]) => {
    const r = await withCompany((c) => { c.country = country; c.hq = hq; });
    const f = criterionGeo(r, mandate({ geos }));
    return isOk(f) ? f.value : "unavailable";
  };
  it.each([
    ["USA", "San Francisco, California", ["US"]],
    ["USA", "San Francisco, California", ["United States"]],
    ["United States", "New York", ["USA"]],
    ["India", "Bengaluru", ["IN"]],
    ["IN", "Bengaluru", ["India"]],
    ["United Kingdom", "London", ["UK"]],
    ["GB", "London", ["United Kingdom"]],
  ])("%s / %s matches mandate %j", async (country, hq, geos) => {
    expect(await geo(country, hq, geos)).toBe("met");
  });
  it("different countries do not match", async () => {
    expect(await geo("USA", "Austin", ["India", "IN"])).toBe("not met");
    expect(await geo("India", "Indiana", ["USA"])).toBe("not met");
  });
});

describe("ARR in $M", () => {
  it("a small revenue estimate is not rounded down to 0", async () => {
    const r = await withCompany((c) => { c.revenue = { lowUsd: 10_000, highUsd: 50_000 }; });
    const f = icMemoArr(r);
    expect(isOk(f) && f.value).toBe(0.03);
  });
  it("keeps one decimal for larger values", async () => {
    const r = await withCompany((c) => { c.revenue = { lowUsd: 1_000_000, highUsd: 2_500_000 }; });
    const f = icMemoArr(r);
    expect(isOk(f) && f.value).toBe(1.8);
  });
});

describe("comps and valuation guards", () => {
  const good: Peer[] = [
    { id: 1, name: "A", lastRoundUsd: 2_000_000, revenueLowUsd: 1_000_000, revenueHighUsd: 3_000_000 },
    { id: 2, name: "B", lastRoundUsd: 3_000_000, revenueLowUsd: 500_000, revenueHighUsd: 1_500_000 },
  ];
  it("peers with a negative round or negative revenue are ignored, not turned into a negative multiple", () => {
    const bad: Peer[] = [{ id: 3, name: "Neg", lastRoundUsd: -5_000_000, revenueLowUsd: 1_000_000, revenueHighUsd: 1_000_000 }, { id: 4, name: "NegRev", lastRoundUsd: 5_000_000, revenueLowUsd: -3_000_000, revenueHighUsd: -1_000_000 }];
    const f = compsMedianMultiple(peers([...good, ...bad]), mandate());
    expect(f).toMatchObject({ status: "ok", value: 10 }); // median of 5× and 15×
    expect(JSON.stringify(f)).not.toMatch(/Neg/);
  });
  it("a swapped revenue range (low > high) still gives low <= high valuation", async () => {
    const r = await withCompany((c) => { c.revenue = { lowUsd: 4_000_000, highUsd: 2_000_000 }; });
    const comps = compsMedianMultiple(peers(good), mandate());
    const { low, high } = valuationRange(r, comps, mandate());
    if (!isOk(low) || !isOk(high)) throw new Error("expected ok");
    expect((low.value as { amount: number }).amount).toBeLessThanOrEqual((high.value as { amount: number }).amount);
  });
});

describe("mandate parsing", () => {
  it("dedupes lists case-insensitively and keeps the first spelling", () => {
    const p = parseMandate({ sectors: "AI, ai, Fintech, FINTECH", stages: ["Seed", "seed"], geos: ["US", "us"] });
    expect(p).toMatchObject({ ok: true, mandate: { sectors: ["AI", "Fintech"], stages: ["Seed"], geos: ["US"] } });
  });
  it.each([
    ["1.5M", 1_500_000],
    ["$2,000,000", 2_000_000],
    ["250k", 250_000],
    ["1.2B", 1_200_000_000],
    ["2,000,000", 2_000_000],
  ])("check size string #%# %s → %d USD", (s, n) => {
    const p = parseMandate({ checkSizeUsd: { min: s } });
    expect(p).toMatchObject({ ok: true, mandate: { checkSizeUsd: { min: n } } });
  });
  it.each([["₹2 crore"], ["abc"], ["NaN"], ["Infinity"], ["1.5MM"], [true], [{}], [[1]]])("garbage check size %j is rejected", (v) => {
    expect(parseMandate({ checkSizeUsd: { max: v } })).toMatchObject({ ok: false });
  });
  it("rejects non-string list items", () => {
    expect(parseMandate({ sectors: [{ a: 1 }] })).toMatchObject({ ok: false });
  });
});

describe("values entered in Review", () => {
  const base = async (): Promise<DecisionsResponse> => {
    const r = await e2b();
    return localDecisions("e2b.dev", liveDealNumbers(companyFields(r)), liveDealValuation());
  };
  const item = (key: string, value: string): ExceptionItem =>
    ({ id: "x1", key: decisionItemKey("e2b.dev", key), kind: "missing_data", status: "edited", runId: "r", resolution: { action: "edit", value, at: "2026-10-31T08:00:00Z", by: "me" } }) as unknown as ExceptionItem;
  const edit = async (key: string, value: string) => (await applyDecisionReviews(await base(), [item(key, value)])).decisions[key as "fitScore"] as ComputedField<unknown>;

  it.each([["abc"], ["NaN"], ["150"], ["-5"], ["Infinity"], [""], ["  "]])("fit score entry %j is rejected, not stored", async (v) => {
    const f = await edit("fitScore", v);
    expect(f.status).toBe("unavailable");
  });
  it.each([["85", 85], ["85%", 85], [" 72.4 ", 72], ["0", 0], ["100", 100]])("fit score entry %j is stored as the number %d", async (v, n) => {
    const f = await edit("fitScore", v);
    expect(isOk(f) && f.value).toBe(n);
  });
  it.each([["abc"], ["-2"], ["NaN"]])("ARR (USD M) entry %j is rejected", async (v) => {
    expect((await edit("icMemoArrUsedM", v)).status).toBe("unavailable");
  });
  it.each([["2.5", 2.5], ["$2.5M", 2.5], ["2,500,000", 2.5], ["$750k", 0.75]])("ARR entry %j → %d USD M", async (v, n) => {
    const f = await edit("icMemoArrUsedM", v);
    expect(isOk(f) && f.value).toBe(n);
  });
  it("a text decision (verdict) is trimmed and kept; blank is rejected", async () => {
    const f = await edit("screenerVerdict", "  Advance  ");
    expect(isOk(f) && f.value).toBe("Advance");
    expect((await edit("screenerVerdict", "   ")).status).toBe("unavailable");
  });
});

void ok;
