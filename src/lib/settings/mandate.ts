// The firm mandate: what the fund invests in (sector, stage, geography, check size) plus the firm's priors
// (dilution per round, target return multiples). Entered by the user in /settings/mandate (PUT /api/settings/mandate) and
// stored as JSON on the server. Nothing here has a built-in value: an unset field stays unset and every score that
// needs it says so.
import fs from "node:fs";
import path from "node:path";

export type Range = { low: number; high: number };
export type Mandate = {
  sectors: string[];
  stages: string[];
  geos: string[];
  checkSizeUsd: { min?: number; max?: number };
  priors: {
    /** share of the company sold in a priced round, percent (e.g. 15–25) — used to turn round size into post-money */
    dilutionPct?: Range;
    /** the fund's target gross return multiple on an investment */
    returnMultiple?: Range;
  };
  updatedAt: string | null;
};

export const EMPTY_MANDATE: Mandate = { sectors: [], stages: [], geos: [], checkSizeUsd: {}, priors: {}, updatedAt: null };

const list = (v: unknown, field: string): string[] => {
  if (v == null) return [];
  const arr = typeof v === "string" ? v.split(",") : Array.isArray(v) ? v : null;
  if (!arr) throw new Error(`${field} must be a list of strings`);
  return [...new Set(arr.map((x) => String(x).trim()).filter(Boolean))].slice(0, 30);
};
const pos = (v: unknown, field: string): number | undefined => {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${field} must be a positive number`);
  return n;
};
const range = (v: unknown, field: string, max?: number): Range | undefined => {
  if (v == null) return undefined;
  const o = v as Record<string, unknown>;
  const low = pos(o.low, `${field}.low`), high = pos(o.high, `${field}.high`);
  if (low == null && high == null) return undefined;
  if (low == null || high == null) throw new Error(`${field} needs both low and high`);
  if (low > high) throw new Error(`${field}.low must be ≤ high`);
  if (max != null && high > max) throw new Error(`${field}.high must be ≤ ${max}`);
  return { low, high };
};

/** Validate an untrusted PUT body. */
export function parseMandate(body: unknown, now = new Date()): { ok: true; mandate: Mandate } | { ok: false; message: string } {
  if (!body || typeof body !== "object") return { ok: false, message: "body must be a JSON object" };
  const b = body as Record<string, unknown>;
  try {
    const check = (b.checkSizeUsd ?? {}) as Record<string, unknown>;
    const min = pos(check.min, "checkSizeUsd.min"), max = pos(check.max, "checkSizeUsd.max");
    if (min != null && max != null && min > max) throw new Error("checkSizeUsd.min must be ≤ max");
    const priors = (b.priors ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      mandate: {
        sectors: list(b.sectors, "sectors"),
        stages: list(b.stages, "stages"),
        geos: list(b.geos, "geos"),
        checkSizeUsd: { ...(min != null ? { min } : {}), ...(max != null ? { max } : {}) },
        priors: {
          ...(range(priors.dilutionPct, "priors.dilutionPct", 100) ? { dilutionPct: range(priors.dilutionPct, "priors.dilutionPct", 100) } : {}),
          ...(range(priors.returnMultiple, "priors.returnMultiple") ? { returnMultiple: range(priors.returnMultiple, "priors.returnMultiple") } : {}),
        },
        updatedAt: now.toISOString(),
      },
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export interface MandateStore {
  get(): Mandate;
  set(m: Mandate): Mandate;
}

export function createMandateStore(opts: { file: string | null; seed?: string | null }): MandateStore {
  let mem: Mandate | null = null;
  const read = (): Mandate => {
    if (mem) return mem;
    if (opts.file && fs.existsSync(opts.file)) {
      try {
        const parsed = parseMandate(JSON.parse(fs.readFileSync(opts.file, "utf8")));
        if (parsed.ok) mem = { ...parsed.mandate, updatedAt: (JSON.parse(fs.readFileSync(opts.file, "utf8")) as Mandate).updatedAt ?? null };
      } catch {
        /* unreadable file → unset mandate */
      }
    }
    if (!mem && opts.seed) {
      // Serverless (Vercel): the file lives in per-instance /tmp, so MANDATE_JSON pins the firm mandate across cold starts.
      try {
        const parsed = parseMandate(JSON.parse(opts.seed));
        if (parsed.ok) mem = { ...parsed.mandate, updatedAt: null };
      } catch {
        /* invalid MANDATE_JSON → unset mandate */
      }
    }
    return mem ?? EMPTY_MANDATE;
  };
  return {
    get: read,
    set(m) {
      mem = m;
      if (opts.file) {
        fs.mkdirSync(path.dirname(opts.file), { recursive: true });
        fs.writeFileSync(opts.file, JSON.stringify(m, null, 2));
      }
      return m;
    },
  };
}

function defaultFile(): string | null {
  const env = process.env.MANDATE_FILE?.trim();
  if (env === "memory") return null;
  return env || path.join(process.cwd(), ".cache", "mandate.json");
}

const g = globalThis as unknown as { __dealdeskMandate?: MandateStore };
export function mandateStore(): MandateStore {
  return (g.__dealdeskMandate ??= createMandateStore({ file: defaultFile(), seed: process.env.MANDATE_JSON?.trim() || null }));
}

/** Which mandate fields are unset, in words (shown next to the fit score). */
export function unsetMandateFields(m: Mandate): string[] {
  const out: string[] = [];
  if (!m.sectors.length) out.push("sectors");
  if (!m.stages.length) out.push("stages");
  if (!m.geos.length) out.push("geographies");
  if (m.checkSizeUsd.min == null && m.checkSizeUsd.max == null) out.push("check size");
  return out;
}
