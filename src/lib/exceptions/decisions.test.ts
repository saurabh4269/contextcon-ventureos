// Deal decisions ↔ review queue: unavailable / partial-input decisions are raised once; a person's edit fills the
// decision cited to the review item; a rejected low-confidence decision is withheld.
import { describe, expect, it, vi } from "vitest";
import { fixtureClient } from "@/test/crustdata";
import { isOk } from "@/lib/fields";
import { uncitedOk } from "@/lib/provenance";
import { researchCompany } from "@/lib/live/research";
import { companyFields } from "@/lib/numbers/company-fields";
import { liveDealNumbers, liveDealValuation } from "@/lib/numbers/deal-numbers";
import { localDecisions, type DecisionsResponse } from "@/lib/numbers/decisions";
import { computeLocalDeal, type PeerSearch } from "@/lib/numbers/local";
import { EMPTY_MANDATE, parseMandate } from "@/lib/settings/mandate";
import { createExceptionStore } from "./store";
import { decisionItemKey, fromDecisions, partialInputs, REVIEWED_DECISIONS, withReview } from "./decisions";

vi.mock("server-only", () => ({}));

const at = new Date("2026-10-31T08:00:00Z");
const store = () => createExceptionStore({ file: null, now: () => at });
const local = async (): Promise<DecisionsResponse> => {
  const r = await researchCompany(fixtureClient(), "e2b.dev");
  if (r.status !== "ok") throw new Error(r.status);
  return localDecisions("e2b.dev", liveDealNumbers(companyFields(r)), liveDealValuation());
};
const cite = { source: "Crustdata", endpoint: "POST /company/enrich", path: "[0].industries[0]", retrievedAt: "2026-10-31T07:59:00.000Z" };

describe("decisions → review queue", () => {
  it("every unavailable reviewed decision becomes one missing_data item with its reason, deduped across reads", async () => {
    const s = store();
    const a = withReview(await local(), s);
    expect(a.review!.open.map((x) => x.key).sort()).toEqual([...REVIEWED_DECISIONS].sort());
    expect(s.list({ status: "open" }).items.every((x) => x.kind === "missing_data" && x.reason.length > 40 && x.subject?.domain === "e2b.dev")).toBe(true);
    withReview(await local(), s);
    expect(s.openCount()).toBe(REVIEWED_DECISIONS.length);
    expect(s.list().runs[0]).toMatchObject({ id: "deal:e2b.dev:decisions", source: "deal", status: "waiting_on_person" });
  });

  it("?review=0 records nothing", async () => {
    const s = store();
    withReview(await local(), s, { raise: false });
    expect(s.openCount()).toBe(0);
  });

  it("a value entered in review fills the decision as ok, cited to the review item and labelled as yours; never re-raised", async () => {
    const s = store();
    withReview(await local(), s);
    const item = s.list({ status: "open" }).items.find((x) => x.key === decisionItemKey("e2b.dev", "screenerVerdict"))!;
    s.resolveException(item.id, "edit", { value: "Advance to diligence" });
    const b = withReview(await local(), s);
    const v = b.decisions.screenerVerdict;
    if (!isOk(v)) throw new Error("screenerVerdict should be ok after the edit");
    expect(v.value).toBe("Advance to diligence");
    expect(v.citations[0]).toMatchObject({ source: "Deal Desk review queue (entered by you)", endpoint: `POST /api/exceptions/${item.id}`, path: "resolution.value", retrievedAt: at.toISOString() });
    expect(b.fields.screenerVerdict).toEqual(v);
    expect(uncitedOk(b)).toEqual([]);
    expect(b.review!.open.map((x) => x.key)).not.toContain("screenerVerdict");
    expect(b.review!.resolved).toEqual([{ id: item.id, key: "screenerVerdict", status: "edited" }]);
    expect(s.list({ status: "all" }).items.filter((x) => x.key === item.key)).toHaveLength(1);
  });

  it("approving 'keep unavailable' leaves it unavailable and closes the item", async () => {
    const s = store();
    withReview(await local(), s);
    const item = s.list({ status: "open" }).items.find((x) => x.key.endsWith(":fitScore"))!;
    s.resolveException(item.id, "approve");
    const b = withReview(await local(), s);
    expect(b.decisions.fitScore.status).toBe("unavailable");
    expect(b.review!.open.map((x) => x.key)).not.toContain("fitScore");
  });

  it("an ok decision on partial inputs is low confidence; complete ones auto-complete; rejecting withholds it", async () => {
    const base = await local();
    const fit = { status: "ok" as const, value: 71, method: "thesis gates", reasoning: "Sector and stage match.", citations: [cite], inputs: [{ name: "sector", value: "AI infra" }, { name: "check size", value: null }] };
    const verdict = { ...fit, value: "Advance", inputs: [{ name: "sector", value: "AI infra" }] };
    expect(partialInputs(fit)).toEqual(["check size"]);
    const r: DecisionsResponse = { ...base, decisions: { ...base.decisions, fitScore: fit, screenerVerdict: verdict } };
    const d = fromDecisions(r);
    expect(d.run.autoCompleted).toBe(1);
    const low = d.raise.find((x) => x.key.endsWith(":fitScore"))!;
    expect(low).toMatchObject({ kind: "low_confidence", proposed: { value: 71 } });
    expect(low.evidence.some((e) => e.citation?.path === cite.path)).toBe(true);
    const s = store();
    withReview(r, s);
    const item = s.list({ status: "open" }).items.find((x) => x.kind === "low_confidence")!;
    s.resolveException(item.id, "reject", { note: "check size unknown" });
    const after = withReview(r, s);
    expect(after.decisions.fitScore).toMatchObject({ status: "unavailable" });
    expect((after.decisions.fitScore as { reason: string }).reason).toMatch(/rejected.*check size unknown/);
    expect(after.decisions.screenerVerdict).toMatchObject({ status: "ok", value: "Advance" });
  });
  it("locally computed decisions: no mandate → raised with the Settings reason; a full mandate → scored, not raised as missing", async () => {
    const r = await researchCompany(fixtureClient(), "e2b.dev");
    if (r.status !== "ok") throw new Error(r.status);
    const peers: PeerSearch = { call: { id: "peers", method: "POST", path: "/company/search", body: {}, status: "ok" as const, ms: 1, cached: false, retrievedAt: at.toISOString(), creditsUsed: "1", data: [] }, matched: ["sector"] };
    const decide = (m: typeof EMPTY_MANDATE) => {
      const l = computeLocalDeal(r, m, peers, [], "deal:e2b.dev:decisions");
      return localDecisions("e2b.dev", { ...liveDealNumbers(companyFields(r)), ...l.numbers }, { ...liveDealValuation(), ...l.valuation }, l.screenerVerdict);
    };
    const s1 = store();
    withReview(decide(EMPTY_MANDATE), s1);
    const fitItem = s1.list({ status: "open" }).items.find((x) => x.key.endsWith(":fitScore"))!;
    expect(fitItem).toMatchObject({ kind: "missing_data", reason: expect.stringMatching(/\/settings\/mandate/) });
    const p = parseMandate({ sectors: ["Artificial Intelligence"], stages: ["series_a"], geos: ["USA"], checkSizeUsd: { max: 2_000_000 }, priors: { dilutionPct: { low: 15, high: 25 }, returnMultiple: { low: 3, high: 10 } } });
    if (!p.ok) throw new Error(p.message);
    const s2 = store();
    const b = withReview(decide(p.mandate), s2);
    expect(b.decisions.fitScore).toMatchObject({ status: "ok", value: 100 });
    expect(b.decisions.screenerVerdict).toMatchObject({ status: "ok", value: "Advance" });
    expect(s2.list({ status: "open" }).items.filter((x) => x.kind === "missing_data").map((x) => x.key)).not.toContain(decisionItemKey("e2b.dev", "fitScore"));
    expect(uncitedOk(b)).toEqual([]);
  });
});

