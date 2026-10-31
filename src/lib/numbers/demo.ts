// DEMO DATA MODULE — the only place demo-mode deal numbers come from (DEALDESK_DATA_MODE=demo, shown with the
// "Demo data" badge). Values are derived from the UI's demo fixtures (port/src/fixtures, an invented company "Helio
// Sensors") and carried in the same ComputedField shape as live numbers; every citation says "Demo data".
import { ok, unavailable, type Citation, type ComputedField } from "@/lib/fields";
import { helioFit, helioGrowth, helioSections, helioValuation } from "@port/fixtures/helio";
import { helioMemoDocData } from "@port/fixtures/heliomemo";
import { DEAL_NUMBER_KEYS, VALUATION_KEYS, type DealNumbers, type DealValuation } from "./deal-numbers";

const demoCite = (path: string): Citation => ({ source: "Demo data (invented fixture, not a real company)", path });
const NOT_IN_DEMO = "Not part of the demo data set.";
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};

function helioNumbers(): { fields: DealNumbers; explainable: DealValuation } {
  const overview = helioSections.overview, market = helioSections.market, team = helioSections.team;
  const thesis = overview.kind === "overview" ? overview.thesis : [];
  const crit = (label: string): ComputedField<unknown> => {
    const t = thesis.find((x) => x.label === label);
    return t
      ? ok(t.ok, "Demo fixture: thesis checklist item", `Demo thesis item "${label}" is ${t.ok ? "met" : "not met"}.`, [demoCite("port/src/fixtures/helio.ts#helioSections.overview.thesis")], [{ name: label, value: t.ok }])
      : unavailable(NOT_IN_DEMO);
  };
  const multiples = market.kind === "market" ? market.comps.filter((c) => !c.us).map((c) => ({ name: c.company.name, x: Number.parseFloat(c.multiple) })) : [];
  const runRateM = (helioGrowth.verified[helioGrowth.verified.length - 1]! * 12) / 1000;
  const hc = team.kind === "team" ? team.stats.find((s) => s.id === "hc") : undefined;
  const v = helioValuation;
  const vc = demoCite("port/src/fixtures/helio.ts#helioValuation");
  const fields = Object.fromEntries(DEAL_NUMBER_KEYS.map((k) => [k, unavailable(NOT_IN_DEMO)])) as DealNumbers;
  Object.assign(fields, {
    fitScore: ok(helioFit.score, "Demo fixture: fit score as authored", `Demo fit score ${helioFit.score} (signals: ${helioFit.signals.map((s) => s.label).join("; ")}).`, [demoCite("port/src/fixtures/helio.ts#helioFit")], helioFit.signals.map((s) => ({ name: s.label, value: s.effect }))),
    criterionSector: crit("B2B industrial"),
    criterionStage: crit("Seed"),
    criterionCheckSize: crit("$1.5M ask in range"),
    compsMedianMultiple: multiples.length
      ? ok(median(multiples.map((m) => m.x)), "median of the demo comps' run-rate multiples (this deal excluded)", `Median of ${multiples.map((m) => `${m.name} ${m.x}×`).join(", ")}.`, [demoCite("port/src/fixtures/helio.ts#helioSections.market.comps")], multiples.map((m) => ({ name: m.name, value: m.x })))
      : unavailable(NOT_IN_DEMO),
    headcountLatest: hc ? ok(Number(hc.value), "Demo fixture: team stat as authored", `Demo team of ${hc.value}.`, [demoCite("port/src/fixtures/helio.ts#helioSections.team.stats")], [{ name: "headcount", value: hc.value }]) : unavailable(NOT_IN_DEMO),
    diligenceVerdict: ok(helioMemoDocData.override.agent.verdict, "Demo fixture: memo recommendation as authored", `Demo recommendation: ${helioMemoDocData.override.agent.verdict}.`, [demoCite("port/src/fixtures/heliomemo.ts#override.agent.verdict")], []),
    icMemoArrUsedM: ok(Math.round(runRateM * 100) / 100, "last verified monthly revenue × 12 ÷ 1000 ($K → $M)", `Run-rate from the demo's last verified MRR ($${helioGrowth.verified[helioGrowth.verified.length - 1]}K × 12).`, [demoCite("port/src/fixtures/helio.ts#helioGrowth.verified")], [{ name: "last verified MRR ($K)", value: helioGrowth.verified[helioGrowth.verified.length - 1] }]),
    icMemoValuation: ok(`$${v.low}–${v.high}M pre, cap $${v.cap}M`, "Demo fixture: valuation range and cap as authored", v.capRationale, [vc], [{ name: "low", value: v.low }, { name: "high", value: v.high }, { name: "cap", value: v.cap }]),
    icMemoCompsLine: multiples.length
      ? ok(`Comps price at ${Math.min(...multiples.map((m) => m.x))}–${Math.max(...multiples.map((m) => m.x))}× run-rate`, "min–max of the demo comps' multiples", `Range across ${multiples.length} demo comps.`, [demoCite("port/src/fixtures/helio.ts#helioSections.market.comps")], multiples.map((m) => ({ name: m.name, value: m.x })))
      : unavailable(NOT_IN_DEMO),
  } satisfies Partial<DealNumbers>);
  const explainable = Object.fromEntries(VALUATION_KEYS.map((k) => [k, unavailable(NOT_IN_DEMO)])) as DealValuation;
  Object.assign(explainable, {
    low: ok(v.low, "Demo fixture as authored", `Demo range low $${v.low}M pre-money.`, [vc], [{ name: "low", value: v.low }]),
    high: ok(v.high, "Demo fixture as authored", `Demo range high $${v.high}M pre-money.`, [vc], [{ name: "high", value: v.high }]),
    cap: ok(v.cap, "Demo fixture as authored", v.capRationale, [vc], [{ name: "cap", value: v.cap }]),
    ...(v.ask != null ? { ask: ok(v.ask, "Demo fixture as authored", `Demo founder ask $${v.ask}M pre-money.`, [vc], [{ name: "ask", value: v.ask }]) } : {}),
    compsMedianMultiple: fields.compsMedianMultiple,
  });
  return { fields, explainable };
}

const DEMO_DEALS: Record<string, () => { fields: DealNumbers; explainable: DealValuation }> = { helio: helioNumbers };

export function demoDeal(id: string) {
  return DEMO_DEALS[id]?.();
}
export const DEMO_DEAL_IDS = Object.keys(DEMO_DEALS);
