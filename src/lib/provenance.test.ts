// "Every number shown has a source": real E2B captures → research fields → deal page model. Any ok value without a
// usable source (endpoint + JSON path, or URL, plus retrieval time) fails this test.
import { fixtureClient } from "@/test/crustdata";
import { describe, expect, it } from "vitest";
import type { Why } from "@port/types";
import { toLiveDeal } from "@/lib/adapters/deal";
import { ok, unavailable, type ComputedField } from "@/lib/fields";
import { researchCompany } from "@/lib/live/research";
import type { ResearchResult } from "@/lib/live/types";
import { liveDealNumbers, liveDealValuation } from "@/lib/numbers/deal-numbers";
import { companyFields } from "@/lib/numbers/company-fields";
import { enforceCited, uncitedOk, whyFromAgentCell, whyFromDecision, whyFromField } from "./provenance";

type Ok = Extract<ResearchResult, { status: "ok" }>;
const e2b = async () => (await researchCompany(fixtureClient(), "e2b.dev")) as Ok;
const cite = { source: "Crustdata", endpoint: "POST /company/enrich", path: "[0].matches[0].company_data.headcount.total", retrievedAt: "2026-10-31T07:51:39.241Z" };

/** Every `why` in a payload, with its JSON path. */
function whys(v: unknown, p = "$", out: { p: string; why: Why; holder: Record<string, unknown> }[] = []) {
  if (!v || typeof v !== "object") return out;
  if (Array.isArray(v)) v.forEach((x, i) => whys(x, `${p}[${i}]`, out));
  else {
    const o = v as Record<string, unknown>;
    if (o.why && typeof o.why === "object") out.push({ p, why: o.why as Why, holder: o });
    for (const [k, x] of Object.entries(o)) if (k !== "why") whys(x, `${p}.${k}`, out);
  }
  return out;
}

describe("every shown value has a source", () => {
  it("research fields: no ok value without endpoint + path (or URL) and retrievedAt", async () => {
    const r = await e2b();
    expect(Object.values(r.fields).some((f) => f.status === "ok")).toBe(true);
    expect(uncitedOk(r.fields)).toEqual([]);
    expect(uncitedOk(liveDealNumbers(companyFields(r)))).toEqual([]);
    expect(uncitedOk(liveDealValuation())).toEqual([]);
  });

  it("deal page: every sourced value has clickable chips with IST retrieval time and the cached flag", async () => {
    const d = toLiveDeal(await e2b(), new Date("2026-10-31T08:00:00Z"));
    const all = whys(d);
    expect(all.length).toBeGreaterThan(15);
    for (const { p, why } of all) {
      if (why.status === "unavailable") {
        expect(why.summary, p).toBeTruthy(); // says why
        continue;
      }
      expect(why.sources.length, `${p} has no source`).toBeGreaterThan(0);
      for (const s of why.sources) {
        expect(!!s.url || (!!s.endpoint && !!s.path), `${p} source has no endpoint+path or URL`).toBe(true);
        expect(s.retrieved, `${p} source has no retrieval time`).toMatch(/IST$/);
        expect(typeof s.cached, `${p} source has no cached flag`).toBe("boolean");
      }
    }
  });

  it("deal page: every displayed number carries a why (a value without one fails)", async () => {
    const d = toLiveDeal(await e2b(), new Date("2026-10-31T08:00:00Z"));
    const shown: { p: string; value: string; why?: Why }[] = [
      ...(d.header.metrics ?? []).map((m) => ({ p: `metric ${m.id}`, value: m.value, why: m.why })),
      ...Object.values(d.sections ?? {}).flatMap((s) =>
        s.kind === "overview" ? [...s.kpis.map((k) => ({ p: `kpi ${k.id}`, value: k.value, why: k.why })), ...s.facts.map((f) => ({ p: `fact ${f.k}`, value: f.v, why: f.why }))]
        : s.kind === "team" ? s.stats.map((x) => ({ p: `team ${x.id}`, value: x.value, why: x.why }))
        : s.kind === "market" ? s.comps.map((c) => ({ p: `comp ${c.company.name}`, value: c.raised, why: c.why }))
        : s.kind === "valuation" ? s.stats.map((x) => ({ p: `valuation ${x.id}`, value: x.value, why: x.why }))
        : [],
      ),
    ];
    expect(shown.length).toBeGreaterThan(10);
    for (const x of shown.filter((x) => /\d/.test(x.value))) {
      expect(x.why, `${x.p} = ${x.value} has no why`).toBeTruthy();
      expect(x.why!.status, `${x.p} = ${x.value}`).not.toBe("unavailable");
    }
  });

  it("a 'verified' check on a KPI means a usable citation, not merely an ok status", async () => {
    const d = toLiveDeal(await e2b(), new Date("2026-10-31T08:00:00Z"));
    const ov = d.sections!.overview!;
    if (ov.kind !== "overview") throw new Error("overview");
    for (const k of ov.kpis) if (k.verified) expect(k.why?.sources.length, k.id).toBeGreaterThan(0);
  });
});

describe("guards and decisions", () => {
  it("uncitedOk finds ok values without a usable source, nested ones included; enforceCited withholds them", () => {
    const bare = ok(52, "Read", "52 people", []);
    const noTime = ok(52, "Read", "52 people", [{ source: "Crustdata", endpoint: "POST /company/enrich", path: "x" }]);
    const good = ok(52, "Read", "52 people", [cite]);
    const verdict = ok("pass", "Rule", "All criteria met", [cite], [{ name: "stage", value: ok("series_a", "Read", "Series A", []) }]);
    expect(uncitedOk({ bare, noTime, good, verdict })).toEqual(["$.bare", "$.noTime", "$.verdict.inputs[0].value"]);
    const out = enforceCited({ bare, good } as Record<string, ComputedField<unknown>>);
    expect(out.good).toBe(good);
    expect(out.bare).toMatchObject({ status: "unavailable", reason: expect.stringMatching(/^Withheld: no source/) });
  });

  it("a decision's why lists each criterion with its verdict, value and own sources", () => {
    const why = whyFromDecision(ok("Advance", "Rule: all criteria pass", "Stage and size fit the mandate.", [cite]), [
      { name: "Stage", field: ok({ pass: true, value: "series_a" }, "Read", "Series A", [cite]) },
      { name: "Check size", field: unavailable("No mandate configured.") },
    ]);
    expect(why.status).toBe("ok");
    expect(why.evidence.map((e) => [e.name, e.verdict])).toEqual([["Stage", "pass"], ["Check size", "unknown"]]);
    expect(why.evidence[0]!.why?.sources[0]).toMatchObject({ endpoint: "POST /company/enrich", retrieved: "31 Oct 2026, 13:21 IST" });
    expect(why.evidence[1]!.why).toMatchObject({ status: "unavailable", summary: "No mandate configured." });
  });

  it("money evidence keeps its own currency; unavailable fields say why; agent corrections show both values", () => {
    const why = whyFromField(ok({ amount: 2_500_000_000, currency: "INR" }, "Read", "Raised", [cite], [{ name: "amount", value: { amount: 2_500_000_000, currency: "INR" } }]));
    expect(why.evidence[0]!.value).toMatch(/₹.*\(INR\)$/);
    expect(whyFromField(unavailable("Not indexed."))).toMatchObject({ status: "unavailable", summary: "Not indexed.", sources: [] });
    const corrected = whyFromAgentCell({ value: 52, claimed: 80, status: "corrected", citation: { ref: "c1", method: "POST", endpoint: "/company/enrich", path: "headcount.total", retrievedAt: cite.retrievedAt } }, [
      { ref: "c1", method: "POST", path: "/company/enrich", retrievedAt: cite.retrievedAt, cached: true, creditsUsed: "2" },
    ]);
    expect(corrected).toMatchObject({ status: "corrected", sources: [{ cached: true, credits: "2", path: "headcount.total" }] });
    expect(corrected.summary).toMatch(/model said 80.*holds 52/);
  });
});
