import type { DealHeader, Valuation } from "../../src/types";

/** GET /api/deals/[id]/valuation — invest mode is always pre-money. */
export const nexaValuation: Valuation = {
  basis: "pre-money",
  currency: "USD",
  unit: "M",
  low: 117,
  high: 149,
  cap: 133,
  ask: 180,
  capRationale: "9.1× verified ARR of $14.6M, the top of what the firm has paid for close software. Above it we’d be paying for the deck number.",
  source: { kind: "xlsx", label: "Valuation model · Our case", n: 12 },
  axis: { min: 91, max: 191 },
  methods: [
    { label: "Public comps", low: 109, high: 153 },
    { label: "Private comps", low: 121, high: 165 },
    { label: "DCF", low: 115, high: 149 },
  ],
};
/** Banking: EV only. */
export const halyardFootballField: Valuation = {
  basis: "EV",
  currency: "USD",
  unit: "M",
  low: 125,
  high: 160,
  cap: 140,
  capRationale: "Midpoint we defend with buyers: precedents at 11.4× FY25 EBITDA, trimmed for the lease gain.",
  source: { kind: "xlsx", label: "Halyard model · Valuation tab" },
  axis: { min: 90, max: 190 },
  methods: [
    { label: "Trading comps", low: 112, high: 150 },
    { label: "Precedent transactions", low: 125, high: 168 },
    { label: "DCF", low: 118, high: 156 },
  ],
};
export const nexaHeader: DealHeader = {
  company: { id: "nexaflow", name: "NexaFlow", initial: "N", line: "Month-end close", dark: true },
  stageLabel: "Due diligence",
  subtitle: "Month-end close software · Series B",
  files: { reviewed: 31, total: 40 },
  icLabel: "IC Mon 2 Nov",
  flags: ["high", "high", "mid", "mid", "low"],
  valuation: nexaValuation,
};
