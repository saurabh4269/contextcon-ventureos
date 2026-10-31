import type { Valuation } from "../types";

/** "$117–149M" */
export const fmtRange = (v: Pick<Valuation, "low" | "high" | "unit">) => (Number.isFinite(v.low) && Number.isFinite(v.high) ? `$${v.low}–${v.high}${v.unit}` : "—"); // NaN = no range in live data
/** "$133M" */
export const fmtMoney = (n: number, unit: Valuation["unit"] = "M") => `$${n}${unit}`;
/** Position of a value on the valuation axis, 0..100 (%). */
export const pct = (n: number, axis: Valuation["axis"]) => Math.max(0, Math.min(100, ((n - axis.min) / (axis.max - axis.min)) * 100));
