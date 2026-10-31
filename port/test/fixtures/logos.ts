/**
 * Company marks for the fictional companies in the demo data: free placeholder logo marks from logoipsum.com
 * (icon only, the placeholder wordmark is dropped), each on a white 32px tile. Files live in public/logos/companies/
 * (mirrored in port/src/assets/logos/companies/; see SOURCES.md there). Real companies get no mark here and fall back
 * to <CompanyLogo>'s hashed monogram tile. In production, `logoUrl` comes from the company record (e.g. Crustdata).
 */
export const LOGO_BASE = "/logos/companies/";
const SLUGS = ["acme", "arcline", "atlas-logistics", "brightline", "brightside", "clearwater", "closeloop", "corvid", "fathom", "fernway", "gridline", "harbor-ai", "helio-sensors", "keel", "keystone-group", "ledgerly", "meridian", "mosaic-health", "nexaflow", "northwind-capital", "orbital", "pinecrest", "project-falcon", "project-halyard", "project-meridian", "quarry", "relay", "sable", "tallow", "tidepool", "vantage"] as const;

export const COMPANY_LOGOS: Record<string, string> = Object.fromEntries(SLUGS.map((s) => [s, `${LOGO_BASE}${s}.svg`]));

export const slugCo = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Attach `logoUrl` to every company-shaped object ({ name, initial }) found in the fixtures. Idempotent. */
export function attachLogos(x: unknown, seen = new WeakSet<object>()): void {
  if (!x || typeof x !== "object" || seen.has(x)) return;
  seen.add(x);
  const o = x as Record<string, unknown>;
  if (typeof o.name === "string" && typeof o.initial === "string" && !o.logoUrl) {
    const url = COMPANY_LOGOS[slugCo(o.name)];
    if (url && Object.isExtensible(o)) o.logoUrl = url;
  }
  for (const v of Object.values(o)) attachLogos(v, seen);
}
