/**
 * DEALDESK_DATA_MODE=demo|live (server env, read per request).
 * - demo (default when unset): screens render port/src/fixtures and show a "Demo data" badge; /api/live/* is disabled.
 * - live: wired screens call /api/live/* (real Crustdata); missing keys surface as "not connected", never fixtures.
 * Any other value is a configuration error — we do not guess.
 */
export type DataMode = "demo" | "live";

export class DataModeConfigError extends Error {
  constructor(value: string) {
    super(`DEALDESK_DATA_MODE must be "demo" or "live" (got "${value}")`);
    this.name = "DataModeConfigError";
  }
}

export function resolveDataMode(env: Record<string, string | undefined> = process.env): DataMode {
  const raw = env.DEALDESK_DATA_MODE?.trim().toLowerCase();
  if (!raw) return "demo";
  if (raw === "demo" || raw === "live") return raw;
  throw new DataModeConfigError(env.DEALDESK_DATA_MODE!);
}
