// The deal page's signal graph tells the user when Crustdata was down (stale cache, with the IST fetch time) and
// offers "did you mean" for a typo'd domain without picking one.
import { fixtureClient } from "@/test/crustdata";
import { describe, expect, it } from "vitest";
import { researchCompany } from "@/lib/live/research";
import type { LiveCall, ResearchResult } from "@/lib/live/types";
import { noMatchSignals, toSignalGraph } from "./deal";

const now = new Date("2026-10-31T06:00:00Z");

describe("signal graph robustness labels", () => {
  it("a stale call carries a 'cached' chip with the outage note; fresh calls do not", async () => {
    const r = (await researchCompany(fixtureClient(), "e2b.dev")) as Extract<ResearchResult, { status: "ok" }>;
    const note = "Crustdata unavailable (HTTP 503); showing the response cached at 31 Oct 2026, 13:00 IST";
    const stale = { ...r, calls: { ...r.calls, jobs: { ...r.calls.jobs, stale: true, cached: true, note } } };
    const g = toSignalGraph(stale, now);
    const jobs = g.calls.find((c) => c.id === "jobs")!;
    expect(jobs.chips.find((c) => c.id === "stale")).toMatchObject({ field: "cached", value: "stale", path: note });
    expect(jobs.chips[0]!.id).not.toBe("stale"); // the data chips still lead
    expect(g.calls.find((c) => c.id === "enrich")!.chips.some((c) => c.id === "stale")).toBe(false);
  });

  it("no-match shows did-you-mean suggestions only when the route found some", () => {
    const identify: LiveCall = { id: "identify", method: "POST", path: "/company/identify", body: { domains: ["strpe.com"] }, status: "no_match", ms: 300, cached: false, retrievedAt: "2026-10-31T07:51:39.241Z", creditsUsed: "0" };
    const plain = noMatchSignals("strpe.com", identify, "2026-10-31T07:51:39.241Z");
    expect(plain.calls[0]!.chips.map((c) => c.id)).toEqual(["m"]);
    const withNote = noMatchSignals("strpe.com", { ...identify, note: "No company found for the domain strpe.com. Did you mean Stripe (stripe.com)?" }, "2026-10-31T07:51:39.241Z");
    expect(withNote.calls[0]!.chips[1]).toMatchObject({ field: "did you mean", value: "Stripe (stripe.com)" });
    const staleNote = noMatchSignals("strpe.com", { ...identify, stale: true, note: "Crustdata unavailable (HTTP 503); showing the response cached at 31 Oct 2026, 13:00 IST" }, "2026-10-31T07:51:39.241Z");
    expect(staleNote.calls[0]!.chips.some((c) => c.id === "dym")).toBe(false);
  });
});
