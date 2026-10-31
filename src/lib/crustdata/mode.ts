export class CrustdataConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrustdataConfigError";
  }
}

/** When true, Crustdata client may load JSON from docs/crustdata/fixtures (tests / local demo). */
export function crustdataFixturesEnabled(): boolean {
  return process.env.DEALDESK_FIXTURES === "1";
}

export function resolveCrustdataMode(opts?: {
  apiKey?: string;
  forceFixture?: boolean;
}): "live" | "fixture" {
  if (opts?.forceFixture) return "fixture";
  if (process.env.DEALDESK_FORCE_FIXTURE === "1") return "fixture";
  if (process.env.CRUSTDATA_FORCE_FIXTURE === "1") return "fixture";
  const key = (opts?.apiKey ?? process.env.CRUSTDATA_API_KEY)?.trim();
  if (key) return "live";
  if (crustdataFixturesEnabled()) return "fixture";
  throw new CrustdataConfigError(
    "Crustdata is not configured: set CRUSTDATA_API_KEY for live API calls, or DEALDESK_FIXTURES=1 to use checked-in fixtures in tests.",
  );
}
