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

// Defaults when a decision was not computed for the deal. Normally src/lib/numbers/local.ts (firm mandate × live
// Crustdata research × peers) replaces every one of these with a value or a specific reason.
const LOCAL =
  "Not computed for this deal: local decisions need the firm mandate (Settings → Firm mandate, /settings/mandate) and live Crustdata research; a builder backend (DEALDESK_BUILDER_URL) can also supply it.";
const REASONS: Record<DealNumberKey, string> = {
  fitScore: `Fit score is scored against the firm mandate. ${LOCAL}`,
  criterionSector: `Sector criterion is scored against the firm mandate. ${LOCAL}`,
  criterionStage: `Stage criterion is scored against the firm mandate. ${LOCAL}`,
  criterionGeo: `Geography criterion is scored against the firm mandate. ${LOCAL}`,
  criterionCheckSize: `Check-size criterion compares the last round with the firm's check range. ${LOCAL}`,
  criterionMemory: `Memory criterion reads the firm's past review-queue decisions. ${LOCAL}`,
  returnMultipleLow: `Return multiples are the firm's target-return prior. ${LOCAL}`,
  returnMultipleHigh: `Return multiples are the firm's target-return prior. ${LOCAL}`,
  compsMedianMultiple: `The comps multiple is derived from live Crustdata peers and the firm's dilution prior. ${LOCAL}`,
  growthYoY: "",
  headcountLatest: "",
  lastFundingUsdM: "",
  diligenceVerdict: `The diligence verdict follows the screener verdict and live risk flags. ${LOCAL}`,
  icMemoArrUsedM: `ARR used in the IC memo is the Crustdata revenue estimate (no data room is connected). ${LOCAL}`,
  icMemoValuation: `IC memo valuation is the locally computed valuation range. ${LOCAL}`,
  icMemoCompsLine: `IC memo comps line lists live Crustdata peers. ${LOCAL}`,
};

/** Live deal (id = company domain): the three Crustdata-backed fields computed; the rest stay unavailable until local.ts fills them. */
export function liveDealNumbers(company: CompanyFields): DealNumbers {
  const out = Object.fromEntries(DEAL_NUMBER_KEYS.map((k) => [k, unavailable(REASONS[k])])) as DealNumbers;
  out.headcountLatest = company.headcountLatest;
  out.growthYoY = company.growthYoY;
  out.lastFundingUsdM = company.lastFunding; // builder key name; value is Money {amount, currency}
  return out;
}

export function liveDealValuation(): DealValuation {
  const v = `Valuation is the revenue estimate × peer multiple, or the last round ÷ the firm dilution prior. ${LOCAL}`;
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
