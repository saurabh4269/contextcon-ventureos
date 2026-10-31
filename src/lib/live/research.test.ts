import { fixtureClient } from "@/test/crustdata";
import { describe, expect, it } from "vitest";
import { CrustdataApiError, type CrustdataClient } from "@/lib/crustdata";
import { researchCompany, lookupCompany, enrichPerson } from "./research";
import { failureFrom } from "./failure";

// fixtureClient() = the real client over E2B captures from 2026-10-31 (docs/crustdata/fixtures); no network.

describe("researchCompany (real E2B captures)", () => {
  it("normalizes the live E2B values", async () => {
    const r = await researchCompany(fixtureClient(), "e2b.dev");
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.company).toMatchObject({ id: 1083252, name: "E2B", domain: "e2b.dev", yearFounded: 2023 });
    expect(r.company.headcount.total).toBe(52);
    expect(Math.round(r.company.headcount.growth.six_months!)).toBe(73);
    expect(r.company.funding).toMatchObject({ lastRoundType: "series_a", totalUsd: 35_000_000 });
    // timeseries come back unsorted from the API: monthly() must be oldest → newest
    const dates = r.company.headcount.monthly.map((p) => p.date);
    expect([...dates].sort()).toEqual(dates);
    expect(r.calls.jobs.data?.total).toBe(32);
    expect(r.calls.founders.data?.people.map((p) => p.name)).toEqual(["Vasek Mlejnsky", "Tomas Valenta"]);
    // zero-width characters are stripped from names
    expect(r.calls.founders.data?.people[1]?.name).toBe("Tomas Valenta");
    // web search results that do not mention E2B are dropped
    expect(r.calls.news.data?.results.every((x) => /e2b/i.test(`${x.title} ${x.snippet}`))).toBe(true);
    // enrich news keeps high-confidence items only (drops "Pepperdine E2B")
    expect(r.company.news.some((n) => /Pepperdine/.test(n.title))).toBe(false);
  });

  it("reports an unknown domain as no_match (identify matches: [])", async () => {
    const r = await researchCompany(fixtureClient(), "zz9-no-such-startup-qx7.com");
    expect(r).toMatchObject({ status: "no_match", domain: "zz9-no-such-startup-qx7.com" });
  });

  it("never reports an API error as no_match", async () => {
    const broken = { identifyCompany: async () => { throw new CrustdataApiError(401, { error: { type: "unauthorized", message: "Invalid API key in request." } }); } } as unknown as CrustdataClient;
    await expect(lookupCompany(broken, "e2b.dev")).rejects.toThrow(/401/);
    let caught: unknown;
    try { await researchCompany(broken, "e2b.dev"); } catch (e) { caught = e; }
    expect(failureFrom(caught)).toMatchObject({ status: "error", upstreamStatus: 401 });
  });

  it("keeps the other calls when one secondary call fails", async () => {
    const c = fixtureClient();
    const flaky = Object.assign(Object.create(Object.getPrototypeOf(c)), c, { searchJobs: async () => { throw new CrustdataApiError(500, { error: "boom" }); } }) as CrustdataClient;
    const r = await researchCompany(flaky, "e2b.dev");
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.calls.jobs).toMatchObject({ status: "error" });
    expect(r.calls.jobs.error).toMatch(/500/);
    expect(r.calls.founders.status).toBe("ok");
  });

  it("enriches a founder profile", async () => {
    const r = await enrichPerson(fixtureClient(), "https://www.linkedin.com/in/mlejva");
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.person.name).toBe("Vasek Mlejnsky");
    expect(r.person.current[0]?.company).toBe("E2B");
    expect(r.person.past.length).toBeGreaterThan(0);
  });
});
