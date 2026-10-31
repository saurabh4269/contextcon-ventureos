// Parsing of numbers typed by a person (Settings mandate, Review edits). Garbage is rejected (undefined), never NaN.

const AMOUNT = /^(\d+(?:\.\d+)?|\.\d+)\s*(k|m|mn|b|bn)?$/i;
const SCALE: Record<string, number> = { k: 1e3, m: 1e6, mn: 1e6, b: 1e9, bn: 1e9 };

/** "1.5M" → 1_500_000, "$2,000,000" / "2,00,000" → digits, "250k" → 250_000. Undefined for anything else (negative,
 *  NaN, Infinity, a currency other than $/USD, unknown suffix). Numbers pass through when finite. */
export function parseUsdAmount(v: unknown): { amount: number; suffixed: boolean } | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? { amount: v, suffixed: false } : undefined;
  if (typeof v !== "string") return undefined;
  const s = v.trim().replace(/^(?:usd|\$)\s*/i, "").replace(/,/g, "");
  const m = AMOUNT.exec(s);
  if (!m) return undefined;
  const amount = Number(m[1]) * (m[2] ? SCALE[m[2].toLowerCase()]! : 1);
  return Number.isFinite(amount) ? { amount, suffixed: !!m[2] } : undefined;
}

/** A $M figure for display/storage: two decimals below $1M (so $30K is not 0), one decimal above. */
export const roundM = (m: number): number => (Math.abs(m) < 1 ? Math.round(m * 100) / 100 : Math.round(m * 10) / 10);

/** Share of the company as a whole number 0..100 ("85", "85%", "72.4"); undefined otherwise. */
export function parseScore(v: string): number | undefined {
  const m = /^(\d+(?:\.\d+)?|\.\d+)\s*%?$/.exec(v.trim());
  if (!m) return undefined;
  const n = Math.round(Number(m[1]));
  return n >= 0 && n <= 100 ? n : undefined;
}

/** An ARR typed in Review → USD M. "$2.5M", "750k" carry their unit; a bare number below 100,000 is read as $M ("2.5"),
 *  from 100,000 up as whole dollars ("2,500,000"). */
export function parseArrM(v: string): number | undefined {
  const p = parseUsdAmount(v);
  if (!p) return undefined;
  const m = p.suffixed || p.amount >= 100_000 ? p.amount / 1e6 : p.amount;
  return roundM(m);
}
