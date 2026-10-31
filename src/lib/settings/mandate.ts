// The firm mandate: what the fund invests in (sector, stage, geography, check size) plus the firm's priors
// (dilution per round, target return multiples). Entered by the user in /settings/mandate (PUT /api/settings/mandate) and
// stored as JSON on the server. Nothing here has a built-in value: an unset field stays unset and every score that
// needs it says so.
import fs from "node:fs";
import path from "node:path";
import { docStore, type DocStore, type StorageInfo } from "@/lib/store/docs";

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
  /** partners a deal meeting can be booked with, by sector focus (optional; the deal workflow's schedule step uses it) */
  partners?: { name: string; focus: string[] }[];
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

const partners = (v: unknown): { name: string; focus: string[] }[] | undefined => {
  if (v == null) return undefined;
  if (!Array.isArray(v)) throw new Error("partners must be a list of { name, focus }");
  const out = v.map((p, i) => {
    const o = (p ?? {}) as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    if (!name) throw new Error(`partners[${i}].name is required`);
    return { name, focus: list(o.focus, `partners[${i}].focus`).map((f) => f.toLowerCase()) };
  });
  return out.length ? out.slice(0, 20) : undefined;
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
        ...(partners(b.partners) ? { partners: partners(b.partners) } : {}),
        updatedAt: now.toISOString(),
      },
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Where the mandate in use comes from (shown in Settings and returned by GET /api/settings/mandate). */
export type MandateSource = { kind: "stored" | "env" | "unset"; writable: boolean; note: string; storage: StorageInfo };

export interface MandateStore {
  get(): Promise<Mandate>;
  source(): Promise<{ mandate: Mandate; source: MandateSource }>;
  set(m: Mandate): Promise<{ ok: true; mandate: Mandate; source: MandateSource } | { ok: false; status: 409; message: string }>;
}

export const NS_SETTINGS = "settings";
const MANDATE_ID = "mandate";

const parseSeed = (seed: string | null | undefined): Mandate | null => {
  if (!seed) return null;
  try {
    const parsed = parseMandate(JSON.parse(seed));
    return parsed.ok ? { ...parsed.mandate, updatedAt: null } : null;
  } catch {
    return null; // invalid MANDATE_JSON → as if unset
  }
};
const reparse = (raw: unknown): Mandate | null => {
  const parsed = parseMandate(raw);
  return parsed.ok ? { ...parsed.mandate, updatedAt: typeof (raw as Mandate | null)?.updatedAt === "string" ? (raw as Mandate).updatedAt : null } : null;
};

/**
 * One mandate for the whole app (deal decisions, the workflow screener, valuation priors, Settings):
 *   · a mandate saved in Settings, when the store is durable (Postgres, or local files on one server);
 *   · else MANDATE_JSON (server env);
 *   · else unset (every score that needs it says so).
 * On a deploy without a durable store (Vercel /tmp), a saved mandate would exist on one instance only, so MANDATE_JSON
 * wins there and Settings refuses to save (409) with the reason. Without MANDATE_JSON it saves per instance, labelled.
 */
export function createMandateStore(opts: { docs: DocStore; seed?: string | null; legacyFile?: string | null }): MandateStore {
  const seed = parseSeed(opts.seed);
  const stored = async (): Promise<Mandate | null> => {
    const doc = await opts.docs.get<unknown>(NS_SETTINGS, MANDATE_ID);
    if (doc) return reparse(doc);
    // pre-store local file (.cache/mandate.json): read once so a local mandate is not lost
    if (opts.legacyFile && fs.existsSync(opts.legacyFile)) {
      try { return reparse(JSON.parse(fs.readFileSync(opts.legacyFile, "utf8"))); } catch { return null; }
    }
    return null;
  };
  const resolve = async (): Promise<{ mandate: Mandate; source: MandateSource }> => {
    const storage = opts.docs.info();
    if (!storage.durable && seed) return { mandate: seed, source: { kind: "env", writable: false, storage, note: `From MANDATE_JSON. ${storage.note} So the env mandate is the one source; change MANDATE_JSON or set DATABASE_URL to edit it here.` } };
    const s = await stored();
    if (s) return { mandate: s, source: { kind: "stored", writable: true, storage, note: `Saved in Settings. ${storage.note}` } };
    if (seed) return { mandate: seed, source: { kind: "env", writable: true, storage, note: "From MANDATE_JSON until you save a mandate here." } };
    return { mandate: EMPTY_MANDATE, source: { kind: "unset", writable: true, storage, note: `No mandate yet. ${storage.note}` } };
  };
  return {
    get: async () => (await resolve()).mandate,
    source: resolve,
    async set(m) {
      const storage = opts.docs.info();
      if (!storage.durable && seed) return { ok: false, status: 409, message: `Not saved: this deploy has no durable store (no DATABASE_URL), so the firm mandate comes from MANDATE_JSON for every server instance. Change MANDATE_JSON, or set DATABASE_URL to save it here.` };
      await opts.docs.put(NS_SETTINGS, MANDATE_ID, m);
      return { ok: true, ...(await resolve()) };
    },
  };
}

/** The app's mandate store (durable store + MANDATE_JSON). */
export function mandateStore(env: Record<string, string | undefined> = process.env): MandateStore {
  return createMandateStore({ docs: docStore(env), seed: env.MANDATE_JSON?.trim() || null, legacyFile: env.VERCEL ? null : path.join(process.cwd(), ".cache", "mandate.json") });
}

/** The firm mandate in use right now (one source for decisions, the workflow and valuation). */
export const firmMandate = (): Promise<Mandate> => mandateStore().get();

/** Which mandate fields are unset, in words (shown next to the fit score). */
export function unsetMandateFields(m: Mandate): string[] {
  const out: string[] = [];
  if (!m.sectors.length) out.push("sectors");
  if (!m.stages.length) out.push("stages");
  if (!m.geos.length) out.push("geographies");
  if (m.checkSizeUsd.min == null && m.checkSizeUsd.max == null) out.push("check size");
  return out;
}
