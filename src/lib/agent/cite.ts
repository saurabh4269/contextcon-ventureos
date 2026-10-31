// Citation checks for agent answers: every cell the model returns names the tool call (`ref`) and the JSON path in
// that call's raw Crustdata response. The server resolves the path and compares; the model's word is never taken.

const TOKEN = /\[(\d+)\]|\["([^"]+)"\]|([^.[\]]+)/g;

/** Resolve `companies[0].headcount.growth_percent.6m` (a leading `$.` is ignored). `undefined` when the path misses. */
export function resolvePath(root: unknown, path: string): unknown {
  let cur: unknown = root;
  const p = path.trim().replace(/^\$\.?/, "");
  for (const m of p.matchAll(TOKEN)) {
    if (cur == null || typeof cur !== "object") return undefined;
    const key = m[1] ?? m[2] ?? m[3]!;
    cur = Array.isArray(cur) && m[1] == null && !/^\d+$/.test(key) ? undefined : (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export type CellCheck =
  | { status: "verified"; value: unknown; source: unknown }
  | { status: "corrected"; value: unknown; source: unknown; claimed: unknown }
  | { status: "unavailable"; value: null; reason: string };

const num = (v: unknown) => {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return NaN;
  const s = v.replace(/[,%\s]/g, "");
  return /^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s) ? Number(s) : NaN;
};
const norm = (v: unknown) => String(v).toLowerCase().replace(/\s+/g, " ").trim();

/** Compare a claimed value with the value at `path` in `response`. */
export function checkCell(claimed: unknown, response: unknown, path: string | undefined): CellCheck {
  if (!path) return { status: "unavailable", value: null, reason: "No citation path was given for this value, so it is not shown." };
  const source = resolvePath(response, path);
  if (source === undefined) return { status: "unavailable", value: null, reason: `The cited path ${path} does not exist in the Crustdata response.` };
  if (source === null || (Array.isArray(source) && source.length === 0) || source === "")
    return { status: "unavailable", value: null, reason: `Crustdata returned no value at ${path}.` };
  if (claimed == null || claimed === "") return { status: "corrected", value: source, source, claimed };
  if (typeof source === "number") {
    const c = num(claimed);
    const ok = Number.isFinite(c) && Math.abs(c - source) <= Math.max(0.051, Math.abs(source) * 0.01);
    return ok ? { status: "verified", value: claimed, source } : { status: "corrected", value: source, source, claimed };
  }
  if (typeof source === "string" || typeof source === "boolean") {
    const a = norm(source), b = norm(claimed);
    return a === b || a.includes(b) || b.includes(a) ? { status: "verified", value: claimed, source } : { status: "corrected", value: source, source, claimed };
  }
  const json = norm(JSON.stringify(source));
  return json.includes(norm(claimed)) ? { status: "verified", value: claimed, source } : { status: "corrected", value: JSON.stringify(source).slice(0, 200), source, claimed };
}
