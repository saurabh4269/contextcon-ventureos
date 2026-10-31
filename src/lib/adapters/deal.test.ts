import { describe, expect, it } from "vitest";
import { createCrustdataClient } from "@/lib/crustdata";
import { researchCompany } from "@/lib/live/research";
import type { ResearchResult } from "@/lib/live/types";
import { toLiveDeal, toSignalGraph } from "./deal";

const now = new Date("2026-10-31T06:00:00Z");
async function e2b() {
  const r = await researchCompany(createCrustdataClient({ forceFixture: true }), "e2b.dev");
  if (r.status !== "ok") throw new Error(`expected ok, got ${r.status}`);
  return r as Extract<ResearchResult, { status: "ok" }>;
}

describe("toLiveDeal (real E2B captures)", () => {
  it("header metrics show the live values with an explanation on hover", async () => {
    const d = toLiveDeal(await e2b(), now);
    const m = Object.fromEntries(d.header.metrics!.map((x) => [x.id, x]));
    expect(m.hc!.value).toBe("52");
    expect(m.hc!.hint).toContain("headcount.total");
    expect(m.raised!.value).toBe("$35M");
    expect(m.round!.value).toBe("Series A");
    expect(m.roles!.value).toBe("32");
    expect(d.header.fit).toBeUndefined(); // no thesis → no fit pill
    expect(d.header.valuation).toBeUndefined();
  });

  it("every shown number is either explained or explicitly unavailable", async () => {
    const d = toLiveDeal(await e2b(), now);
    for (const m of d.header.metrics!) expect(m.hint, m.id).toBeTruthy();
    const ov = d.sections!.overview!;
    if (ov.kind !== "overview") throw new Error();
    for (const k of ov.kpis) expect(k.hint, k.id).toBeTruthy();
  });

  it("signal graph uses real calls, real latencies, and leaves the score unscored", async () => {
    const r = await e2b();
    const g = toSignalGraph(r, now);
    expect(g.calls.map((c) => c.path)).toEqual(["/company/identify", "/company/enrich", "/person/search", "/job/search", "/web/search/live", "/company/search"]);
    expect(g.fit.unscored?.reason).toMatch(/thesis/);
    expect(g.fit.contributions).toEqual([]);
    expect(g.calls.find((c) => c.id === "founders")?.chips.find((c) => c.id === "name")?.value).toBe("Vasek Mlejnsky");
    // every chip carries a real response path
    for (const c of g.calls) for (const ch of c.chips) expect(ch.path ?? ch.field).toBeTruthy();
    // timeline only references calls/chips that exist
    for (const e of g.timeline) if ("call" in e) expect(g.calls.some((c) => c.id === e.call)).toBe(true);
  });

  it("team links founders to the live person page by profile URL", async () => {
    const team = toLiveDeal(await e2b(), now).sections!.team!;
    if (team.kind !== "team") throw new Error();
    expect(team.people[0]?.href).toBe("/person?linkedin=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fmlejva&domain=e2b.dev");
  });
});
