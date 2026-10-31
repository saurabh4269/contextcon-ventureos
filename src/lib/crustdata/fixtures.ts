// Checked-in Crustdata fixtures for unit tests (docs/crustdata/fixtures): real E2B responses captured live on
// 2026-10-31 (api 2025-11-01, emails/phones stripped) plus empty/no-match shapes. The app never reads these: demo mode
// renders port/src/fixtures, live mode calls the API.
import fs from "node:fs";
import path from "node:path";
import { crustdataFixturesEnabled } from "./mode";
import { CRUSTDATA_DEMO_E2B } from "./demo-targets";

const FIXTURE_ROOT = path.join(process.cwd(), "docs/crustdata/fixtures");

/** Map Crustdata company id → domain for fixture lookup (tests only). */
export const FIXTURE_COMPANY_ID_DOMAINS: Record<number, string> = {
  [CRUSTDATA_DEMO_E2B.crustdataCompanyId]: CRUSTDATA_DEMO_E2B.domain,
};

export function domainForFixtureCompanyId(id: number): string | undefined {
  return FIXTURE_COMPANY_ID_DOMAINS[id];
}

/** Derive fixture file slug from domain (e.g. acme-robotics.com → acme-robotics). */
export function fixtureSlugFromDomain(domain: string): string {
  const key = domain.toLowerCase().replace(/^www\./, "");
  const withoutTld = key.replace(/\.[a-z]{2,}(?:\.[a-z]{2,})?$/i, "");
  return withoutTld.replace(/\./g, "-");
}

export function loadFixture<T>(name: string): T {
  const file = path.join(FIXTURE_ROOT, name);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing Crustdata fixture ${name} (expected at ${file})`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

const domainFixtureName = (prefix: string, domain: string) => `${prefix}-${fixtureSlugFromDomain(domain)}.json`;

export function hasFixtureForDomain(prefix: string, domain: string): boolean {
  return fs.existsSync(path.join(FIXTURE_ROOT, domainFixtureName(prefix, domain)));
}

/**
 * Domain fixture only. The builder's version fell back to `{prefix}-acme-robotics.json` for unknown domains, which made
 * any domain "match" Acme in fixture mode; that fallback is removed.
 */
export function loadFixtureForDomain<T>(prefix: string, domain?: string): T {
  if (!domain?.trim()) {
    throw new Error(`Crustdata fixture load requires a company domain (prefix=${prefix})`);
  }
  const named = domainFixtureName(prefix, domain);
  if (!hasFixtureForDomain(prefix, domain)) {
    throw new Error(`No Crustdata fixture ${named} for domain ${domain}.`);
  }
  return loadFixture<T>(named);
}

export function hasFixtureForCompanyId(prefix: string, companyId: number): boolean {
  const domain = FIXTURE_COMPANY_ID_DOMAINS[companyId];
  if (domain) return hasFixtureForDomain(prefix, domain);
  return fs.existsSync(path.join(FIXTURE_ROOT, `${prefix}-id-${companyId}.json`));
}

export function loadFixtureForCompanyId<T>(prefix: string, companyId?: number): T {
  if (companyId == null || !Number.isFinite(companyId)) {
    throw new Error(`Crustdata fixture load requires company id (prefix=${prefix})`);
  }
  const domain = FIXTURE_COMPANY_ID_DOMAINS[companyId];
  if (domain) return loadFixtureForDomain<T>(prefix, domain);
  const byId = `${prefix}-id-${companyId}.json`;
  if (fs.existsSync(path.join(FIXTURE_ROOT, byId))) return loadFixture<T>(byId);
  throw new Error(`No Crustdata fixture for company id ${companyId} (prefix=${prefix}).`);
}

export function loadWatchCreateFixture(): { id: string | number; status?: string } {
  return loadFixture("watch-company-create.json");
}

export const FIXTURE_LABEL = "[FIXTURE — not live Crustdata data. Set CRUSTDATA_API_KEY for production responses.]";

export { crustdataFixturesEnabled };
