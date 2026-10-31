// fromSourcingRun: clean rows auto-complete; only conflicting / relaxed / unverifiable rows and over-budget runs reach a person.
import { describe, expect, it } from "vitest";
import type { AgentRow, RunSummary } from "@/lib/sourcing/run";
import { ok, unavailable } from "@/lib/fields";
import { fromSourcingRun } from "./rules";

const cite = { source: "Crustdata", endpoint: "POST /company/search", path: "companies[0]", retrievedAt: "2026-10-31T07:51:39.241Z" };
const row = (id: number, name: string, over: Partial<AgentRow> = {}): AgentRow => ({
  id,
  rank: id,
  name,
  domain: `${name.toLowerCase()}.example`,
  relaxed: [],
  founded: ok(2021, "Read", "Founded 2021", [cite]),
  hq: ok("Bengaluru, India", "Read", "HQ", [cite]),
  headcountNow: ok(52, "Read", "52", [cite]),
  headcountThen: ok({ value: 40, date: "2026-04-01" }, "Read", "40", [cite]),
  growth: ok(30, "Ratio", "+30%", [cite]),
  growthWindow: "6m" as AgentRow["growthWindow"],
  series: [],
  funding: ok({ total: { amount: 5_000_000, currency: "USD" }, lastRound: "seed", lastDate: "2025-01-01", lastAmount: null }, "Read", "Raised", [cite]),
  founders: ok([{ name: "A Founder", prior: [], priorSource: "person/search", citations: [cite] }], "Read", "Founders", [cite]),
  checks: [{ label: "Sector", ok: true, detail: "fintech" }],
  errors: [],
  sourceCitation: cite,
  ...over,
});
const summary = (over: Partial<RunSummary> = {}): RunSummary => ({
  runId: "run1", request: "fintechs in Bengaluru", sentence: "3 fintechs.", requested: 3, returned: 3, dropped: 0, relaxed: [], rankingReason: "", credits: 5,
  liveCalls: 4, cachedCalls: 0, failedCalls: 0, startedAt: "2026-10-31T07:50:00Z", finishedAt: "2026-10-31T07:51:00Z", ms: 60_000, rowOrder: [1, 2, 3], ...over,
});

describe("fromSourcingRun", () => {
  it("auto-completes clean rows and raises one item per problem", () => {
    const rows = [
      row(1, "Clean"),
      row(2, "Conflict", { checks: [{ label: "Headcount", ok: false, detail: "enrich says 900, request wants < 200" }] }),
      row(3, "Gaps", { hq: unavailable("No HQ indexed."), founders: unavailable("No founders found."), checks: [{ label: "Stage", ok: null, detail: "no funding round indexed" }] }),
    ];
    const d = fromSourcingRun(summary(), rows, [], { creditLimit: 40 });
    expect(d.run.autoCompleted).toBe(1);
    expect(d.raise.map((r) => [r.kind, r.target?.row])).toEqual([["conflicting_data", 1], ["missing_data", 2]]);
    expect(d.raise[0]!.evidence[0]).toMatchObject({ value: "enrich says 900, request wants < 200", citation: cite });
    expect(d.run.artefact?.rows.map((r) => r.name)).toEqual(["Clean", "Conflict", "Gaps"]);
  });

  it("an expensive or short run asks a person to confirm", () => {
    const d = fromSourcingRun(summary({ credits: 55, returned: 1, rowOrder: [1] }), [row(1, "Clean")], [], { creditLimit: 40 });
    expect(d.raise.map((r) => r.kind)).toEqual(["credit_threshold", "low_confidence"]);
    expect(d.raise[0]!.title).toBe("Run used 55 Crustdata credits");
  });
});
