// Helpers shared by the extra agent tools. Tools may return a projection of the raw Crustdata response in
// `ToolExecution.data` (some keys dropped), but never rename keys or reorder arrays, so every JSON path the model
// cites against `data` resolves to the same value in Crustdata's original response.
import type { ToolExecution } from "../contract";

export const clampInt = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Non-empty trimmed strings from a model-supplied array (anything else is dropped). */
export const strings = (v: unknown, max: number): string[] =>
  (Array.isArray(v) ? v : typeof v === "string" ? [v] : [])
    .filter((x): x is string | number => typeof x === "string" || typeof x === "number")
    .map((x) => String(x).trim())
    .filter(Boolean)
    .slice(0, max);

export const ints = (v: unknown, max: number): number[] =>
  (Array.isArray(v) ? v : v == null ? [] : [v]).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0).slice(0, max);

export const exec = (
  method: "GET" | "POST",
  path: string,
  body: Record<string, unknown>,
  call: Promise<{ data: unknown; meta: ToolExecution["meta"] }>,
  project: (data: unknown) => unknown = (d) => d,
): Promise<ToolExecution> => call.then(({ data, meta }) => ({ method, path, body, data: project(data), meta }));

/** Copy of `obj` with only `keys` (absent keys stay absent; values untouched). */
export const pick = (obj: unknown, keys: readonly string[]): Record<string, unknown> | unknown => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const o = obj as Record<string, unknown>;
  return Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
};
