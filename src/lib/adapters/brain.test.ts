// Live Firm brain: synthetic memory events (no real company data).
import { describe, expect, it } from "vitest";
import type { MemoryEvent } from "@/lib/memory/types";
import { EMPTY_MANDATE } from "@/lib/settings/mandate";
import { growth, toLiveBrain } from "./brain";

const now = new Date("2026-10-31T06:00:00Z");
const ev = (id: number, kind: string, at: string, extra: Partial<MemoryEvent> = {}): MemoryEvent => ({ id: String(id), at, kind, actor: { type: "user" }, subject: { type: "company", id: `c${id}.test`, label: `C${id}` }, summary: `${kind} ${id}`, data: null, source: "test", ...extra });
const events = [
  ev(1, "research.run", "2026-09-10T00:00:00Z"),
  ev(2, "memo.drafted", "2026-10-29T00:00:00Z"),
  ev(3, "workflow.decision", "2026-10-30T00:00:00Z", { data: { verdict: "invest" } }),
  ev(4, "workflow.decision", "2026-10-30T01:00:00Z", { data: { verdict: "pass", note: "Market too small" } }),
  ev(5, "workflow.decision", "2026-10-30T02:00:00Z", { data: { verdict: "pass" } }),
];

describe("toLiveBrain", () => {
  const d = toLiveBrain({ events, storage: { kind: "file", durable: false, label: "Instance /tmp files (not durable)", note: "n" }, mandate: { ...EMPTY_MANDATE, sectors: ["AI"], geos: ["IND"], priors: { returnMultiple: { low: 3, high: 8 } } }, now });
  it("memories are the events, newest first, in real categories with real counts", () => {
    expect(d.total).toBe(5);
    expect(d.memories.map((m) => m.id)).toEqual(["5", "4", "3", "2", "1"]);
    expect(Object.fromEntries(d.kinds.map((k) => [k.id, k.count]))).toEqual({ all: "5", decisions: "3", pass: "2", anti: "0", memos: "1", research: "1" });
    expect(d.memories.find((m) => m.id === "4")!.kindId).toBe("pass");
    expect(d.weekDelta).toBe(4);
  });
  it("outcomes are the IC decisions with no invented result; pass reasons from the partner's note", () => {
    expect(d.outcomes.map((o) => [o.company, o.decision, o.tone])).toEqual([["C5", "passed", "neutral"], ["C4", "passed", "neutral"], ["C3", "invested", "neutral"]]);
    expect(d.passReasons).toEqual([{ label: "Market too small", n: 1 }, { label: "No reason recorded", n: 1 }]);
    expect(d.passCount).toBe(2);
    expect(d.antiPortfolio).toEqual([]);
    expect(d.proposals).toEqual([]);
  });
  it("thesis and priors come from the firm mandate; storage is named when not durable", () => {
    expect(d.thesis!.map((t) => [t.field, t.text])).toEqual([["Sectors", "AI"], ["Geographies", "IND"]]);
    expect(d.priors).toEqual([{ label: "Target return multiple", value: "3–8×", basis: "Firm mandate" }]);
    expect(d.scope).toBe("Deal Desk · instance /tmp files (not durable)");
    expect(d.learnedOvernight.text).toBe("");
    expect(d.mcp.url).toBe("");
  });
  it("growth starts at 0 the month before the first memory", () => {
    expect(growth(events, now).trend).toEqual([0, 1, 5]);
    expect(growth([], now).trend).toEqual([]);
  });
});
