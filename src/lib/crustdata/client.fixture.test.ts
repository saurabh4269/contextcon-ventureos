import { describe, expect, it } from "vitest";
import { createCrustdataClient } from "./client";
import { CrustdataConfigError } from "./mode";
import { fixtureClient } from "@/test/crustdata";
import { jobSearchByCompanyId } from "./job-queries";
import { founderPersonSearchBody } from "./person-queries";
import { hasCrustdataCompanyMatch, primaryCompanyMatch } from "./match";
import { CRUSTDATA_DEMO_E2B } from "./demo-targets";

describe("Crustdata client over the real E2B captures (injected fetch)", () => {
  const client = () => fixtureClient();

  it("refuses to construct without an API key (no fixture fallback)", () => {
    expect(() => createCrustdataClient({ apiKey: " " })).toThrow(CrustdataConfigError);
  });

  it("returns an empty job search when the company id has no fixture", async () => {
    const { data, meta } = await client().searchJobs(jobSearchByCompanyId(9999999, 5));
    expect(meta.cached).toBe(false);
    expect(data.job_listings).toHaveLength(0);
  });

  it("loads E2B job listings keyed by company id", async () => {
    const { data } = await client().searchJobs(jobSearchByCompanyId(CRUSTDATA_DEMO_E2B.crustdataCompanyId, 5));
    expect(data.total_count).toBe(32);
    expect(data.job_listings[0]?.job_details?.title).toBeTruthy();
  });

  it("loads E2B founders from the person search capture", async () => {
    const { data } = await client().searchPeople(founderPersonSearchBody(CRUSTDATA_DEMO_E2B.crustdataCompanyId, 5));
    expect(data.profiles.map((p) => p.basic_profile?.name)).toContain("Vasek Mlejnsky");
  });

  it("resolves e2b.dev through identify", async () => {
    const { data } = await client().identifyCompany({ domains: ["e2b.dev"] });
    expect(primaryCompanyMatch(data)?.id).toBe(CRUSTDATA_DEMO_E2B.crustdataCompanyId);
  });

  it("treats empty identify matches as unresolved", () => {
    expect(hasCrustdataCompanyMatch([{ matched_on: "missing.example", matches: [] }])).toBe(false);
  });
});
