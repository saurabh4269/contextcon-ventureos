import { describe, expect, it } from "vitest";
import { advance, type WorkflowDeps } from "./run";
import { applyAction } from "./actions";
import { EMPTY_MANDATE } from "@/lib/settings/mandate";
import { newSteps, stepOf, type Deal } from "./types";
import type { ResearchResult } from "@/lib/live/types";

const deal = (): Deal => ({ id: "d1", createdAt: "2026-10-31T00:00:00Z", updatedAt: "2026-10-31T00:00:00Z", trigger: { type: "ask", domain: "acme.ai" }, company: { domain: "acme.ai" }, stage: "sourced", stageHistory: [], steps: newSteps() });
const NOW = new Date("2026-10-31T06:00:00Z");
const mk = (over: Partial<WorkflowDeps>): WorkflowDeps => ({
  research: async () => ({ status: "error", domain: "acme.ai", message: "HTTP 500 from Crustdata" }) as unknown as ResearchResult,
  decisions: async () => ({ error: "no builder" }), model: null,
  memory: { label: "t", append: async () => { throw new Error("memory down"); }, list: async () => { throw new Error("memory down"); } },
  mandate: { ...EMPTY_MANDATE, sectors: ["ai"], updatedAt: "2026-10-30T00:00:00Z" },
  now: () => NOW, save: async () => undefined, ...over,
});

describe("workflow failure handling", () => {
  it("a Crustdata error is reported as a failure, not as no match", async () => {
    const d = await advance(deal(), mk({}));
    expect(stepOf(d, "screen").summary).toContain("Crustdata failed: HTTP 500");
    expect(stepOf(d, "research").summary).toContain("Crustdata failed: HTTP 500");
    expect(stepOf(d, "research").summary).not.toMatch(/No Crustdata match/);
  });
  it("a memory failure at the screen step does not fail the step; it shows precedents as unavailable", async () => {
    const r = { status: "no_match", domain: "acme.ai" } as unknown as ResearchResult;
    const d = await advance(deal(), mk({ research: async () => r }));
    expect(stepOf(d, "screen").summary).toContain("No Crustdata match");
    expect(d.running).toBe(false);
  });
  it("resume retries an unavailable step except one a person skipped", async () => {
    const d = deal();
    stepOf(d, "research").status = "unavailable"; stepOf(d, "research").transport = "live";
    Object.assign(stepOf(d, "transcript"), { status: "unavailable", transport: "person" });
    expect((await applyAction(d, { action: "resume" }, {}, NOW, {})).ok).toBe(true);
    expect(stepOf(d, "research").status).toBe("pending");
    expect(stepOf(d, "transcript").status).toBe("unavailable");
  });
});

describe("applyAction input validation", () => {
  it("rejects approve without a valid step, a non-string transcript and a missing body instead of throwing", async () => {
    const d = deal();
    expect(await applyAction(d, { action: "approve" } as never, {}, NOW, {})).toMatchObject({ ok: false });
    expect(await applyAction(d, { action: "transcript", text: 42 } as never, {}, NOW, {})).toMatchObject({ ok: false });
    expect(await applyAction(d, null as never, {}, NOW, {})).toMatchObject({ ok: false });
  });
});
