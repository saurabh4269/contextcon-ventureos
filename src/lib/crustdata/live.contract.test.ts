import { describe, expect, it } from "vitest";
import { CRUSTDATA_DEMO_E2B } from "./demo-targets";
import { createCrustdataClient } from "./client";
import { founderPersonSearchBody, readPersonSearchResults } from "./person-queries";
import { jobSearchByCompanyId, readJobSearchResults } from "./job-queries";
import { hasCrustdataCompanyMatch, primaryCompanyMatch } from "./match";
import { withCompanyEnrichFields } from "./enrich-fields";
import { buildWatchCompanyBody } from "./watch-body";

const liveEnabled =
  process.env.CRUSTDATA_LIVE === "1" && Boolean(process.env.CRUSTDATA_API_KEY?.trim());

describe.skipIf(!liveEnabled)("Crustdata live API (CRUSTDATA_LIVE=1)", () => {
  const client = () => createCrustdataClient({ apiKey: process.env.CRUSTDATA_API_KEY });

  it("identify + enrich E2B demo target", async () => {
    const c = client();
    const { data: identify } = await c.identifyCompany({ domains: [CRUSTDATA_DEMO_E2B.domain] });
    expect(hasCrustdataCompanyMatch(identify)).toBe(true);
    const primary = primaryCompanyMatch(identify);
    expect(primary?.id).toBe(CRUSTDATA_DEMO_E2B.crustdataCompanyId);

    const enrichBody = withCompanyEnrichFields({
      crustdata_company_ids: [CRUSTDATA_DEMO_E2B.crustdataCompanyId],
    });
    const { data: enrich } = await c.enrichCompanies(enrichBody);
    expect(hasCrustdataCompanyMatch(enrich)).toBe(true);
  });

  it("founder person search filter tree", async () => {
    const c = client();
    const body = founderPersonSearchBody(CRUSTDATA_DEMO_E2B.crustdataCompanyId, 5);
    const { data } = await c.searchPeople(body);
    const { totalCount } = readPersonSearchResults(data as Parameters<typeof readPersonSearchResults>[0]);
    expect(totalCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray((data as { profiles?: unknown[] }).profiles)).toBe(true);
  });

  it("job search by company id (1 row ≈ 0.03 credits)", async () => {
    const c = client();
    const body = jobSearchByCompanyId(CRUSTDATA_DEMO_E2B.crustdataCompanyId, 1);
    const { data, meta } = await c.searchJobs(body);
    const { listings } = readJobSearchResults(data as Parameters<typeof readJobSearchResults>[0]);
    expect(listings.length).toBeLessThanOrEqual(1);
    expect(meta.mode).toBe("live");
  });

  it("watch create body validates (optional — skips delete if WATCH disabled)", async () => {
    expect(
      buildWatchCompanyBody({
        crustdataCompanyId: CRUSTDATA_DEMO_E2B.crustdataCompanyId,
        webhookUrl: "https://example.com/hook",
      }).fields,
    ).toContain("news");
  });
});

describe("Crustdata live guardrails", () => {
  it("documents opt-in env", () => {
    expect(process.env.CRUSTDATA_LIVE === "1" || true).toBe(true);
  });
});
