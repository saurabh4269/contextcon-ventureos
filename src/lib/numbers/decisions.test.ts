import { fixtureClient } from "@/test/crustdata";
import { describe, expect, it, vi } from "vitest";
import { isOk } from "@/lib/fields";
import { uncitedOk } from "@/lib/provenance";
import { researchCompany } from "@/lib/live/research";
import { toLiveDeal, toValuationSection, withDecisionFit } from "@/lib/adapters/deal";
import { companyFields } from "./company-fields";
import { liveDealNumbers, liveDealValuation } from "./deal-numbers";
import { DECISION_KEYS, fromBuilderField, localDecisions, withBuilder } from "./decisions";

const e2b = async () => {
  const r = await researchCompany(fixtureClient(), "e2b.dev");
  if (r.status !== "ok") throw new Error(r.status);
  return r;
};
const local = async () => localDecisions("e2b.dev", liveDealNumbers(companyFields(await e2b())), liveDealValuation());

const builderBody = (fields: Record<string, unknown>) => ({ dealId: "d1", companyDomain: "e2b.dev", decisions: fields, endpoints: {}, fields });
const fetchOf = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
const okBuilder = (value: unknown, source = "crustdata") => ({ status: "ok", value, inputs: [{ label: "Hard fit", value: "yes", source: "screener" }], method: "runScreener thesis gates", citations: [{ label: "Sector", value: "AI infra", source, ref: "industries[0]" }], reasoning: "Matches the thesis." });

describe("GET /api/deals/:id/decisions (builder contract)", () => {
  it("has the builder's shape and every decision key; nothing ok without a usable citation", async () => {
    const d = await local();
    expect(d).toMatchObject({ dealId: "e2b.dev", companyDomain: "e2b.dev", source: "crustdata" });
    expect(Object.keys(d.decisions).sort()).toEqual([...DECISION_KEYS].sort());
    for (const k of DECISION_KEYS) expect(d.endpoints[k]).toMatch(/^\/api\/deals\/e2b\.dev\//);
    expect(uncitedOk(d)).toEqual([]);
  });

  it("this build never invents a decision: pipeline decisions unavailable with reasons, Crustdata numbers still live", async () => {
    const d = await local();
    for (const k of DECISION_KEYS) {
      expect(d.decisions[k].status).toBe("unavailable");
      expect((d.decisions[k] as { reason: string }).reason.length).toBeGreaterThan(20);
    }
    expect(d.fields.headcountLatest).toMatchObject({ status: "ok", value: 52 });
  });

  it("without DEALDESK_BUILDER_URL the builder is reported not configured and no call is made", async () => {
    const f = fetchOf({});
    const d = await withBuilder(await local(), { baseUrl: "", fetchImpl: f });
    expect(d.builder).toEqual({ status: "not_configured" });
    expect(f).not.toHaveBeenCalled();
  });

  it("builder decisions are used with citations re-anchored to our call (endpoint, path, time)", async () => {
    const f = fetchOf(builderBody({ fitScore: okBuilder(78), screenerVerdict: okBuilder("Advance") }));
    const d = await withBuilder(await local(), { baseUrl: "https://builder.example/", fetchImpl: f });
    expect(d.source).toBe("crustdata+builder");
    expect(d.builder?.status).toBe("used");
    const fit = d.decisions.fitScore;
    if (!isOk(fit)) throw new Error("fitScore should be ok");
    expect(fit.value).toBe(78);
    expect(fit.citations[0]).toMatchObject({ source: "Deal Desk builder · crustdata", endpoint: "GET /api/deals/e2b.dev/decisions", path: "fields.fitScore.citations[0]", ref: "industries[0]" });
    expect(uncitedOk(d)).toEqual([]);
    expect(d.decisions.valuationRange.status).toBe("unavailable");
  });

  it("drops builder fields that cite fixture/sample/demo data or carry no citations", () => {
    const call = { url: "u", endpoint: "GET /x", retrievedAt: new Date().toISOString() };
    expect(fromBuilderField("fitScore", okBuilder(80, "fixture"), call)).toBeNull();
    expect(fromBuilderField("fitScore", { ...okBuilder(80), citations: [] }, call)).toBeNull();
    expect(fromBuilderField("fitScore", { ...okBuilder(80), method: "demo seed" }, call)).toBeNull();
    expect(fromBuilderField("fitScore", { status: "unavailable", reason: "no" }, call)).toBeNull();
  });

  it("builder errors fall back to this build's honest values", async () => {
    const d1 = await withBuilder(await local(), { baseUrl: "https://b", fetchImpl: fetchOf({ error: "Deal not found" }, 404) });
    expect(d1.builder).toMatchObject({ status: "unavailable" });
    expect(d1.decisions.fitScore.status).toBe("unavailable");
    const boom = vi.fn(async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    const d2 = await withBuilder(await local(), { baseUrl: "https://b", fetchImpl: boom });
    expect(d2.builder?.reason).toMatch(/unreachable/);
  });
});

describe("deal page from decisions", () => {
  it("valuation section shows decision stats, all '—' with reasons in this build", async () => {
    const s = toValuationSection((await local()).fields);
    expect(s.stats!.map((x) => x.id)).toEqual(["fit", "screener", "diligence", "low", "high", "ask", "rml", "rmh", "comps"]);
    expect(s.stats!.every((x) => x.value === "—" && /^Unavailable: /.test(x.hint ?? ""))).toBe(true);
  });

  it("an ok fitScore scores the fit tile and header pill; unavailable keeps it unscored with the decision's reason", async () => {
    const deal = toLiveDeal(await e2b(), new Date("2026-10-31T08:00:00Z"));
    const d = await withBuilder(await local(), { baseUrl: "https://b", fetchImpl: fetchOf(builderBody({ fitScore: okBuilder(78), screenerVerdict: okBuilder("Advance") })) });
    const scored = withDecisionFit(deal, d.decisions);
    expect(scored.header.fit).toEqual({ score: 78 });
    expect(scored.signals!.fit).toMatchObject({ base: { value: 78 }, unscored: undefined, recommendation: { label: "Advance" } });
    const un = withDecisionFit(deal, (await local()).decisions);
    expect(un.header.fit).toBeUndefined();
    expect(un.signals!.fit.unscored!.reason).toMatch(/firm thesis/);
  });
});
