// Local deal decisions over the checked-in E2B captures (test-only fixtureClient), a mandate entered in the test,
// and hand-built peers. Covers the scoring rules, the peer multiple / valuation fallbacks and "unavailable" reasons.
import { describe, expect, it } from "vitest";
import { fixtureClient } from "@/test/crustdata";
import { isOk, type ComputedField } from "@/lib/fields";
import { uncitedOk } from "@/lib/provenance";
import { researchCompany, searchPeers } from "@/lib/live/research";
import type { ExceptionItem } from "@/lib/exceptions/types";
import { EMPTY_MANDATE, parseMandate, type Mandate } from "@/lib/settings/mandate";
import { computeLocalDeal, criterionMemory, type Peer, type PeerSearch } from "./local";
import { liveDealNumbers, liveDealValuation } from "./deal-numbers";
import { companyFields } from "./company-fields";
import { localDecisions } from "./decisions";

const e2b = async () => {
  const r = await researchCompany(fixtureClient(), "e2b.dev");
  if (r.status !== "ok") throw new Error(r.status);
  return r;
};
const mandate = (over: Record<string, unknown> = {}): Mandate => {
  const p = parseMandate({ sectors: ["Artificial Intelligence"], stages: ["series_a"], geos: ["USA"], checkSizeUsd: { min: 250_000, max: 2_000_000 }, priors: { dilutionPct: { low: 15, high: 25 }, returnMultiple: { low: 3, high: 10 } }, ...over }, new Date("2026-10-31T08:00:00Z"));
  if (!p.ok) throw new Error(p.message);
  return p.mandate;
};
const peerCall = (data: Peer[], status: "ok" | "error" = "ok"): PeerSearch => ({
  call: { id: "peers", method: "POST", path: "/company/search", body: {}, status, ms: 1, cached: false, retrievedAt: "2026-10-31T08:00:00Z", creditsUsed: "1", ...(status === "error" ? { error: "HTTP 400 bad filter" } : { data }) },
  matched: ["sector", "stage", "geo"],
});
// post-money = round ÷ 20% (dilution midpoint); multiple = post ÷ revenue midpoint → 5×, 15×, 2.5× → median 5×
const PEERS: Peer[] = [
  { id: 1, name: "Peer A", domain: "a.example", lastRoundType: "series_a", lastRoundUsd: 2_000_000, revenueLowUsd: 1_000_000, revenueHighUsd: 3_000_000 },
  { id: 2, name: "Peer B", domain: "b.example", lastRoundType: "series_a", lastRoundUsd: 3_000_000, revenueLowUsd: 500_000, revenueHighUsd: 1_500_000 },
  { id: 3, name: "Peer C", domain: "c.example", lastRoundType: "seed", lastRoundUsd: 1_000_000, revenueLowUsd: 1_000_000, revenueHighUsd: 3_000_000 },
  { id: 4, name: "Peer D (no revenue)", lastRoundUsd: 5_000_000 },
];
const val = (f: ComputedField<unknown>) => (isOk(f) ? f.value : `unavailable: ${f.status === "unavailable" ? f.reason : ""}`);
const reason = (f: ComputedField<unknown>) => (f.status === "unavailable" ? f.reason : "");

describe("computeLocalDeal", () => {
  it("no mandate: fit, screener, priors-based fields are unavailable and say where to enter the mandate", async () => {
    const d = computeLocalDeal(await e2b(), EMPTY_MANDATE, peerCall(PEERS), [], "run");
    expect(reason(d.numbers.fitScore!)).toMatch(/No firm mandate is set.*\/settings\/mandate/);
    expect(reason(d.screenerVerdict)).toMatch(/needs the fit score/);
    expect(reason(d.numbers.returnMultipleLow!)).toMatch(/unset/);
    expect(reason(d.numbers.compsMedianMultiple!)).toMatch(/dilution prior/);
    expect(reason(d.valuation.low!)).toMatch(/dilution prior/);
    // the revenue estimate is Crustdata data, not a firm prior: still computed
    expect(val(d.numbers.icMemoArrUsedM!)).toBe(0.8);
  });

  it("every criterion met → fit 100, Advance, Proceed to diligence; return multiples are labelled assumptions", async () => {
    const d = computeLocalDeal(await e2b(), mandate(), peerCall(PEERS), [], "run");
    expect(val(d.numbers.fitScore!)).toBe(100);
    expect(val(d.screenerVerdict)).toBe("Advance");
    expect(val(d.numbers.diligenceVerdict!)).toBe("Proceed to diligence");
    expect([val(d.numbers.returnMultipleLow!), val(d.numbers.returnMultipleHigh!)]).toEqual([3, 10]);
    const rml = d.numbers.returnMultipleLow!;
    if (!isOk(rml)) throw new Error("rml");
    expect(rml.method).toMatch(/^Assumption/);
    expect(rml.citations[0]).toMatchObject({ source: "Firm mandate (entered in Settings)", note: expect.stringMatching(/Assumption/) });
    expect(uncitedOk(d)).toEqual([]);
  });

  it("a hard gate not met declines (and diligence does not proceed); a soft miss is Review", async () => {
    const r = await e2b();
    const geo = computeLocalDeal(r, mandate({ geos: ["India"] }), peerCall(PEERS), [], "run");
    expect(val(geo.numbers.fitScore!)).toBe(75);
    expect(val(geo.screenerVerdict)).toBe("Decline");
    expect(val(geo.numbers.diligenceVerdict!)).toBe("Do not proceed");
    // E2B's last round is $21M; a $50M check does not fit in it
    const check = computeLocalDeal(r, mandate({ checkSizeUsd: { min: 10_000_000, max: 50_000_000 } }), peerCall(PEERS), [], "run");
    expect(val(check.numbers.criterionCheckSize!)).toBe("not met");
    expect(val(check.screenerVerdict)).toBe("Review");
  });

  it("unset mandate fields are not scored and are named", async () => {
    const d = computeLocalDeal(await e2b(), mandate({ stages: [], checkSizeUsd: {} }), peerCall(PEERS), [], "run");
    const fit = d.numbers.fitScore!;
    if (!isOk(fit)) throw new Error("fit");
    expect(fit.value).toBe(100);
    expect(fit.reasoning).toMatch(/Not scored: Stage, Check size.*mandate fields unset: stages, check size/);
  });

  it("peer median multiple × revenue estimate gives the valuation range; citations are not repeated", async () => {
    const d = computeLocalDeal(await e2b(), mandate(), peerCall(PEERS), [], "run");
    expect(val(d.numbers.compsMedianMultiple!)).toBe(5);
    expect(d.valuation.low).toMatchObject({ status: "ok", value: { amount: 2_500_000, currency: "USD" } });
    expect(d.valuation.high).toMatchObject({ status: "ok", value: { amount: 5_000_000, currency: "USD" } });
    expect(val(d.numbers.icMemoValuation!)).toBe("$2.5M–$5M");
    const memo = d.numbers.icMemoValuation!;
    if (!isOk(memo)) throw new Error("memo");
    const keys = memo.citations.map((c) => `${c.source}|${c.endpoint}|${c.path}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(val(d.numbers.icMemoCompsLine!)).toMatch(/^4 peers matched on sector, stage, geo: Peer A \(series_a, \$2M\).*median implied multiple 5× revenue\.$/);
  });

  it("multiples below 1× keep two decimals instead of reading as 0×", async () => {
    const tiny: Peer[] = [
      { id: 1, name: "Big rev", lastRoundUsd: 1_000_000, revenueLowUsd: 100_000_000, revenueHighUsd: 100_000_000 },
      { id: 2, name: "Big rev 2", lastRoundUsd: 2_000_000, revenueLowUsd: 100_000_000, revenueHighUsd: 100_000_000 },
    ];
    const d = computeLocalDeal(await e2b(), mandate(), peerCall(tiny), [], "run");
    expect(val(d.numbers.compsMedianMultiple!)).toBe(0.08); // (0.05 + 0.1) / 2 = 0.075
  });

  it("too few peers with revenue → no multiple; valuation falls back to last round ÷ dilution prior", async () => {
    const d = computeLocalDeal(await e2b(), mandate(), peerCall(PEERS.slice(3)), [], "run");
    expect(reason(d.numbers.compsMedianMultiple!)).toMatch(/only 0 of 1 peers .* at least 2/);
    // $21M ÷ 25% = $84M; ÷ 15% = $140M
    expect(d.valuation.low).toMatchObject({ status: "ok", value: { amount: 84_000_000 } });
    expect(d.valuation.high).toMatchObject({ status: "ok", value: { amount: 140_000_000 } });
  });

  it("a failed peer search is reported, never treated as 'no peers'", async () => {
    const d = computeLocalDeal(await e2b(), mandate(), peerCall([], "error"), [], "run");
    expect(reason(d.numbers.compsMedianMultiple!)).toMatch(/Peer search failed .*HTTP 400 bad filter/);
    expect(reason(d.numbers.icMemoCompsLine!)).toMatch(/Peer search failed/);
  });

  it("feeds localDecisions: decisions computed locally replace the 'not computed' defaults", async () => {
    const r = await e2b();
    const local = computeLocalDeal(r, mandate(), peerCall(PEERS), [], "run");
    const d = localDecisions("e2b.dev", { ...liveDealNumbers(companyFields(r)), ...local.numbers }, { ...liveDealValuation(), ...local.valuation }, local.screenerVerdict);
    expect(val(d.decisions.fitScore)).toBe(100);
    expect(val(d.decisions.screenerVerdict)).toBe("Advance");
    expect(val(d.decisions.valuationRange)).toBe("$2.5M–$5M");
    expect(uncitedOk(d)).toEqual([]);
  });
});

describe("criterionMemory", () => {
  const item = (status: ExceptionItem["status"], runId: string, domain = "e2b.dev"): ExceptionItem => ({ id: `${status}-${runId}`, key: "k", runId, kind: "missing_data", title: "t", reason: "r", subject: { name: "E2B", domain }, evidence: [], actions: {} as ExceptionItem["actions"], status, createdAt: "2026-10-30T08:00:00Z" });
  it("neutral without history; not met when most past decisions were rejections; ignores this run and other companies", () => {
    expect(val(criterionMemory("e2b.dev", [], "run"))).toBe("no prior decisions");
    expect(val(criterionMemory("e2b.dev", [item("rejected", "a"), item("rejected", "b"), item("approved", "c")], "run"))).toBe("not met");
    expect(val(criterionMemory("e2b.dev", [item("rejected", "run"), item("rejected", "x", "other.com"), item("approved", "c")], "run"))).toBe("met");
  });
});

describe("searchPeers", () => {
  it("relaxes geography then stage when Crustdata returns too few peers; each attempt is a real filter", async () => {
    const log: { method: string; path: string; body: unknown }[] = [];
    const r = await e2b();
    const p = await searchPeers(fixtureClient(log), r.company);
    expect(p.call.status).toBe("ok");
    expect(p.matched).toEqual(["sector"]);
    const fields = log.filter((x) => x.path === "/company/search").map((x) => (x.body as { filters: { conditions: { field: string }[] } }).filters.conditions.map((c) => c.field));
    expect(fields).toEqual([
      ["taxonomy.professional_network_industry", "funding.last_round_type", "locations.country", "funding.last_round_amount_usd"],
      ["taxonomy.professional_network_industry", "funding.last_round_type", "funding.last_round_amount_usd"],
      ["taxonomy.professional_network_industry", "locations.country", "funding.last_round_amount_usd"],
      ["taxonomy.professional_network_industry", "funding.last_round_amount_usd"],
    ]);
  });
});
