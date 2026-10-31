// Live Portfolio: synthetic workflow deals (no real company data).
import { describe, expect, it } from "vitest";
import { portfolioFrom } from "@/lib/portfolio";
import { newSteps, type Deal } from "@/lib/workflow/types";
import type { StageRecord } from "@/lib/deals/stages";
import { NO_KPIS, toLivePortfolio } from "./portfolio";

const cite = { source: "Crustdata", endpoint: "POST /company/enrich", path: "headcount.total", retrievedAt: "2026-10-31T05:00:00.000Z" };
function deal(id: string, stage: Deal["stage"], over: Partial<Deal> = {}): Deal {
  const steps = newSteps();
  steps.find((s) => s.id === "research")!.facts = [
    { label: "Headcount", value: "46", status: "info", citation: cite },
    { label: 'Claim "team of 60"', value: "Crustdata headcount.total: 46", status: "contradicted", citation: cite },
    { label: "Headcount by month", value: "…", status: "info", citation: cite },
  ];
  steps.find((s) => s.id === "memo")!.memo = { markdown: "# m", sources: [cite], model: null };
  return { id, createdAt: "2026-10-30T00:00:00Z", updatedAt: "2026-10-31T00:00:00Z", trigger: { type: "ask", domain: `${id}.test` }, company: { domain: `${id}.test`, name: id.toUpperCase() }, stage, stageHistory: [{ stage: "sourced", at: "2026-10-30T00:00:00Z", by: "x" }, { stage, at: "2026-10-31T01:00:00Z", by: "Ada" }], steps, ...over };
}

describe("portfolio", () => {
  it("only deals that reached Portfolio, newest first, with their cited facts and contradicted claims", () => {
    const rows = portfolioFrom([deal("a", "portfolio", { decision: { verdict: "invest", by: "Ada", at: "2026-10-31T02:00:00Z" } }), deal("b", "ic"), deal("c", "passed")], []);
    expect(rows.map((r) => r.domain)).toEqual(["a.test"]);
    expect(rows[0]).toMatchObject({ workflowId: "a", by: "Ada", investedAt: "2026-10-31T02:00:00Z", memo: { model: null, sources: 1 } });
    expect(rows[0]!.facts.map((f) => f.label)).toEqual(["Headcount"]);
    expect(rows[0]!.contradicted).toEqual(['"team of 60" — Crustdata headcount.total: 46']);
  });
  it("a stage record moved to Portfolio without a workflow still lists, with no facts", () => {
    const s: StageRecord = { domain: "z.test", stage: "portfolio", history: [{ stage: "portfolio", at: "2026-10-31T03:00:00Z", by: "Ada", actor: "user" }], owner: null, updatedAt: "2026-10-31T03:00:00Z" };
    expect(portfolioFrom([], [s])).toMatchObject([{ domain: "z.test", workflowId: null, facts: [] }]);
  });
  it("adapter: no KPI numbers, the reason instead; each company has its own panel; empty → no companies", () => {
    const d = toLivePortfolio(portfolioFrom([deal("a", "portfolio")], []), { kind: "file", durable: false, label: "Instance /tmp files (not durable)", note: "n" });
    expect(d.unknownKpis).toBe(NO_KPIS);
    expect(d.companies[0]).toMatchObject({ arr: "—", burn: "—", arrTrend: [], alert: { label: "Invested", tone: "ok" } });
    expect(Number.isFinite(d.companies[0]!.runwayMonths)).toBe(false);
    expect(d.panels!["a.test"]!.facts.map((f) => [f.label, f.source.kind])).toEqual([["Headcount", "crust"], ["Decided", "db"]]);
    expect(d.panels!["a.test"]!.action.id).toBe("workflow:a");
    expect(d.sub).toBe("instance /tmp files (not durable)");
    expect(toLivePortfolio([]).companies).toEqual([]);
  });
});
