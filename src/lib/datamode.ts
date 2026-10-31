/**
 * DEALDESK_DATA_MODE=demo|live (server env, read per request).
 * - demo (default when unset): the restored screens render port/src/fixtures so the live site keeps its current look.
 *   /api/live/* still runs. A URL that names a real source (domain, LinkedIn, ?q=) overlays Crustdata on that same screen.
 * - live: wired screens call /api/live/* for the whole page; missing keys surface as "not connected", never fixtures.
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

const trim = (v?: string) => v?.trim() || undefined;

/** Fixture deal (?id=helio, ?restricted) stays dummy. ?domain= / ?company= researches that company on Crustdata. */
export function namedLiveDeal(q: { domain?: string; company?: string; id?: string; restricted?: string }): string | undefined {
  if (q.id || q.restricted) return undefined;
  return trim(q.domain) ?? trim(q.company);
}

/** Fixture people (?id=ananya-rao) stay dummy. ?linkedin= enriches that profile on Crustdata. */
export function namedLivePerson(q: { linkedin?: string; id?: string }): string | undefined {
  if (q.id) return undefined;
  return trim(q.linkedin);
}

/** Fixture Ask frames (?frame=) stay dummy. ?q= runs the research agent on that request. */
export function namedLiveQuery(q: { q?: string; frame?: string }): string | undefined {
  if (q.frame) return undefined;
  return trim(q.q);
}

/** Fixture Helio agent (?frame=, ?view=flow) stays dummy. ?q= runs the sourcing agent on that request. */
export function namedLiveAgent(q: { q?: string; frame?: string; view?: string; agent?: string }): string | undefined {
  if (q.frame || q.view === "flow" || q.agent === "inbound") return undefined;
  return trim(q.q);
}
