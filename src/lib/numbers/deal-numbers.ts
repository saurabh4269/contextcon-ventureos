// GET /api/deals/:id/numbers and /valuation — interim implementation of the builder's contract (builder-main a5330b1).
// Swapping to the builder's backend means replacing this module with calls to its API; the route
// handlers and the UI only depend on the `DealNumbers` / `DealValuation` shapes below.
import { unavailable, type ComputedField } from "@/lib/fields";
import type { CompanyFields } from "./company-fields";

export const DEAL_NUMBER_KEYS = [
  "fitScore",
  "criterionSector",
  "criterionStage",
  "criterionGeo",
  "criterionCheckSize",
  "criterionMemory",
  "returnMultipleLow",
  "returnMultipleHigh",
  "compsMedianMultiple",
  "growthYoY",
  "headcountLatest",
  "lastFundingUsdM",
  "diligenceVerdict",
  "icMemoArrUsedM",
  "icMemoValuation",
  "icMemoCompsLine",
] as const;
export type DealNumberKey = (typeof DEAL_NUMBER_KEYS)[number];
export type DealNumbers = Record<DealNumberKey, ComputedField<unknown>>;

export const VALUATION_KEYS = ["low", "high", "cap", "ask", "returnMultipleLow", "returnMultipleHigh", "compsMedianMultiple"] as const;
export type DealValuation = Record<(typeof VALUATION_KEYS)[number], ComputedField<unknown>>;

/** `source` names where the computed values come from; money values are {amount, currency} (see docs/API.md). */
export type NumbersResponse = { id: string; source: "crustdata"; fields: DealNumbers };
export type ValuationResponse = { id: string; source: "crustdata"; explainable: DealValuation };

const PIPELINE =
  "Computed by the Deal Desk pipeline (builder backend: data-room ingest, firm mandate, scoring/LLM); not available in this build.";
const REASONS: Record<DealNumberKey, string> = {
  fitScore: `Fit score needs the firm thesis and scoring model. ${PIPELINE}`,
  criterionSector: `Sector criterion is scored against the firm mandate. ${PIPELINE}`,
  criterionStage: `Stage criterion is scored against the firm mandate. ${PIPELINE}`,
  criterionGeo: `Geography criterion is scored against the firm mandate. ${PIPELINE}`,
  criterionCheckSize: `Check-size criterion needs the round terms and the firm's check range. ${PIPELINE}`,
  criterionMemory: `Memory criterion reads the firm brain (past decisions). ${PIPELINE}`,
  returnMultipleLow: `Return multiples need entry price, ownership and exit model. ${PIPELINE}`,
  returnMultipleHigh: `Return multiples need entry price, ownership and exit model. ${PIPELINE}`,
  compsMedianMultiple: "Crustdata has no revenue or valuation multiples for comparable companies; the builder derives them from its pricing comps. Not available in this build.",
  growthYoY: "",
  headcountLatest: "",
  lastFundingUsdM: "",
  diligenceVerdict: `Diligence verdicts come from claim tie-outs against the data room. ${PIPELINE}`,
  icMemoArrUsedM: `ARR used in the IC memo comes from verified room financials. ${PIPELINE}`,
  icMemoValuation: `IC memo valuation comes from the pricing model. ${PIPELINE}`,
  icMemoCompsLine: `IC memo comps line comes from the pricing model. ${PIPELINE}`,
};

/** Live deal (id = company domain): the three Crustdata-backed fields computed, everything else honestly unavailable. */
export function liveDealNumbers(company: CompanyFields): DealNumbers {
  const out = Object.fromEntries(DEAL_NUMBER_KEYS.map((k) => [k, unavailable(REASONS[k])])) as DealNumbers;
  out.headcountLatest = company.headcountLatest;
  out.growthYoY = company.growthYoY;
  out.lastFundingUsdM = company.lastFunding; // builder key name; value is Money {amount, currency}
  return out;
}

export function liveDealValuation(): DealValuation {
  const v = `Valuation needs verified revenue and the pricing model. ${PIPELINE}`;
  return {
    low: unavailable(v),
    high: unavailable(v),
    cap: unavailable("A valuation cap comes from the round's term sheet (SAFE/note), which this build does not ingest."),
    ask: unavailable("The founder's ask comes from the pitch/term sheet, which this build does not ingest."),
    returnMultipleLow: unavailable(REASONS.returnMultipleLow),
    returnMultipleHigh: unavailable(REASONS.returnMultipleHigh),
    compsMedianMultiple: unavailable(REASONS.compsMedianMultiple),
  };
}

/** Same numbers for a deal the API cannot resolve at all (wrong id in this mode). */
export function unresolvedDeal(reason: string): { fields: DealNumbers; explainable: DealValuation } {
  return {
    fields: Object.fromEntries(DEAL_NUMBER_KEYS.map((k) => [k, unavailable(reason)])) as DealNumbers,
    explainable: Object.fromEntries(VALUATION_KEYS.map((k) => [k, unavailable(reason)])) as DealValuation,
  };
}
