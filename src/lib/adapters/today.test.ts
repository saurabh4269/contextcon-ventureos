// Live Today adapter (synthetic inputs shaped like GET /api/exceptions, /api/deals/:domain/decisions, /api/pipeline/deals,
// Gmail thread metadata and calendar events). No real names, addresses or subjects.
import { describe, expect, it } from "vitest";
import { ok, unavailable } from "@/lib/fields";
import type { DecisionsResponse } from "@/lib/numbers/decisions";
import type { ExceptionsResponse } from "@/lib/exceptions/types";
import type { InboxThread } from "@/lib/google/gmail";
import type { PipelineDealRow } from "@/lib/inbox/pipeline";
import { fitSignals, inboundMetric, inboundWindow, knownDeals, meetingKind, pipelineWorkRow, realPipelineDeals, toTodaySummary, toWorkRow, type KnownDeal } from "./today";

const now = new Date("2026-10-31T06:00:00Z"); // 11:30 IST
const cite = { source: "Crustdata", endpoint: "POST /company/enrich", path: "[0].matches[0].company_data.taxonomy", retrievedAt: "2026-10-31T05:00:00.000Z" };
const decisions = (o: Record<string, unknown>): DecisionsResponse => ({
  fields: {
    fitScore: ok(67, "Share of scored mandate criteria met × 100", "2 of 3 scored criteria met", [cite]),
    criterionSector: ok("met", "m", "w", [cite]),
    criterionStage: ok("not met", "m", "w", [cite]),
    criterionGeo: ok("met", "m", "w", [cite]),
    criterionCheckSize: unavailable("No last round amount."),
    criterionMemory: ok("no prior decisions", "m", "w", [cite]),
    screenerVerdict: ok("Advance", "m", "w", [cite]),
    ...o,
  },
} as unknown as DecisionsResponse);

const item = (domain: string, at: string, status: "open" | "resolved" = "open") => ({ id: `ex_${domain}_${at}`, key: `deal:${domain}:x`, runId: null, kind: "low_confidence", title: "t", reason: "r", subject: { name: domain, domain }, evidence: [], actions: {}, status, createdAt: at });
const ex = (items: unknown[], runs: unknown[] = []) => ({ storage: "memory", open: 0, items, runs } as unknown as ExceptionsResponse);

describe("knownDeals", () => {
  it("collects domains from item subjects and deal runs, newest first, counting open items", () => {
    const k = knownDeals(ex(
      [item("alpha.test", "2026-10-30T10:00:00Z"), item("alpha.test", "2026-10-30T11:00:00Z", "resolved"), item("Beta.TEST", "2026-10-29T10:00:00Z")],
      [{ id: "deal:gamma.test:decisions", createdAt: "2026-10-31T01:00:00Z" }, { id: "agent:xyz", createdAt: "2026-10-31T02:00:00Z" }],
    ));
    expect(k.map((d) => d.domain)).toEqual(["gamma.test", "alpha.test", "beta.test"]);
    expect(k.find((d) => d.domain === "alpha.test")!.open).toBe(1);
  });
});

describe("toWorkRow", () => {
  const base: KnownDeal = { domain: "alpha.test", lastAt: "2026-10-31T04:00:00Z", open: 0 };
  it("takes the fit score and signals from decisions", () => {
    const r = toWorkRow({ ...base, decisions: decisions({}) }, now);
    expect(r.fit.score).toBe(67);
    expect(r.fit.signals!.map((s) => s.label)).toEqual(["sector met", "stage not met", "geography met"]);
    expect(r.action).toEqual({ kind: "memo", label: "Open memo", recommended: true });
    expect(r.href).toBe("/memo?id=alpha.test");
    expect(r.company.name).toBe("alpha.test"); // no research → the domain, never a made-up name
    expect(r.company.sector).toBe("—");
  });
  it("shows no number when the fit score is unavailable or decisions failed", () => {
    expect(toWorkRow({ ...base, decisions: decisions({ fitScore: unavailable("no criteria") }) }, now).fit.score).toBeNaN();
    const r = toWorkRow({ ...base, decisions: null }, now);
    expect(r.fit.score).toBeNaN();
    expect(r.fit.why).toMatch(/unavailable/);
  });
  it("sends deals with open review items to Review", () => {
    const r = toWorkRow({ ...base, open: 2, decisions: decisions({}) }, now);
    expect(r.action.kind).toBe("review");
    expect(r.href).toBe("/review");
  });
});

describe("fitSignals", () => {
  it("lists only met / not met criteria", () => {
    expect(fitSignals(decisions({}).fields as never).map((s) => s.effect)).toEqual(["up", "down", "up"]);
  });
});

describe("pipeline rows", () => {
  const p = (domain: string, source: PipelineDealRow["source"], name: string): PipelineDealRow => ({ domain, name, href: `/deal?domain=${domain}`, source, at: "2026-10-30T09:00:00Z" });
  it("keeps researched companies and pitch-like inbound only", () => {
    const rows = realPipelineDeals([p("a.test", "inbound", "Acme seed pitch"), p("b.test", "inbound", "Your weekly digest"), p("c.test", "researched", "c.test")]);
    expect(rows.map((r) => r.domain)).toEqual(["a.test", "c.test"]);
  });
  it("shows the domain (no subject text) with fit —", () => {
    const r = pipelineWorkRow(p("a.test", "inbound", "Acme seed pitch"), now);
    expect(r.company.name).toBe("a.test");
    expect(r.fit.score).toBeNaN();
    expect(r.action.kind).toBe("claim");
    expect(r.href).toBe("/deal?domain=a.test");
  });
});

describe("inbound window", () => {
  const t = (subject: string, at: string) => ({ id: at, subject, lastMessageAt: at } as unknown as InboxThread);
  it("counts pitch-like threads per IST day; complete when not truncated", () => {
    const w = inboundWindow([t("Seed round deck", "2026-10-31T03:00:00Z"), t("Lunch?", "2026-10-31T03:00:00Z"), t("Pitch: synthetic", "2026-10-28T03:00:00Z")], now, { span: 7, fetchedSince: "2026-10-17T06:00:00Z", truncated: false });
    expect(w.series).toHaveLength(7);
    expect(w.series[6]).toBe(1);
    expect(w.total).toBe(2);
    expect(w.complete).toBe(true);
    expect(w.prior).toBe(0);
    expect(inboundMetric(w, 7).value).toBe("2");
  });
  it("says unavailable when Gmail failed", () => {
    expect(inboundMetric({ unavailable: "Gmail is not connected." }, 7)).toMatchObject({ value: "—", delta: "unavailable", series: [] });
  });
});

describe("meetings", () => {
  it("only shows events whose title names a kind", () => {
    expect(meetingKind("IC: synthetic co")).toBe("ic");
    expect(meetingKind("Founder intro call")).toBe("founder");
    expect(meetingKind("Dentist")).toBeNull();
  });
  it("the card gets an honest empty text: the calendar's failure, or no matching meeting", () => {
    const base = { now, greeting: "", open: 0, inboundSpan: 7, inbound: { unavailable: "x" }, deals: [], ask: { prompt: "", chips: [], placeholder: "" } };
    expect(toTodaySummary({ ...base, meetings: [] }).meetingsEmpty).toBe("No upcoming IC, board, LP or founder meetings on your calendar.");
    expect(toTodaySummary({ ...base, meetings: [], meetingsUnavailable: "Google Calendar is not connected." }).meetingsEmpty).toBe("Google Calendar is not connected.");
  });
});

describe("toTodaySummary", () => {
  it("merges known deals and pipeline companies without duplicates; empty sources give empty lists", () => {
    const d = toTodaySummary({
      now, greeting: "Good morning, Test", open: 1, inboundSpan: 7, inbound: { unavailable: "x" }, meetings: [], ask: { prompt: "", chips: [], placeholder: "" },
      deals: [{ domain: "alpha.test", lastAt: "2026-10-31T04:00:00Z", open: 1, decisions: decisions({}) }],
      pipeline: [{ domain: "alpha.test", name: "alpha", href: "/deal?domain=alpha.test", source: "inbound", at: "2026-10-31T00:00:00Z" }, { domain: "beta.test", name: "beta", href: "/deal?domain=beta.test", source: "researched", at: "2026-10-30T00:00:00Z" }],
    });
    expect(d.rows.map((r) => r.id)).toEqual(["alpha.test", "beta.test"]);
    expect(d.rows.map((r) => r.stage)).toEqual(["new", "new"]); // nobody moved them: New
    expect(d.hero.value).toBe(1);
    expect(d.waiting!.items.map((w) => w.kind)).toEqual(["review"]);
    expect(d.date).toBe("Saturday, 31 October");
    const empty = toTodaySummary({ now, greeting: "", open: 0, inboundSpan: 7, inbound: { unavailable: "x" }, meetings: [], deals: [], ask: { prompt: "", chips: [], placeholder: "" } });
    expect(empty.rows).toEqual([]);
    expect(empty.sub).toBe("Nothing waits for you in Review.");
  });
  it("stages come from the deal-stage rows; closed deals are not work for today", () => {
    const d = toTodaySummary({
      now, greeting: "", open: 0, inboundSpan: 7, inbound: { unavailable: "x" }, meetings: [], ask: { prompt: "", chips: [], placeholder: "" }, deals: [],
      pipeline: [
        { domain: "alpha.test", name: "Alpha", href: "/workflow?id=w1", source: "tracked", at: "2026-10-31T00:00:00Z", stage: "ic", owner: null, workflowId: "w1" },
        { domain: "omega.test", name: "Omega", href: "/workflow?id=w2", source: "tracked", at: "2026-10-30T00:00:00Z", stage: "portfolio", owner: null, workflowId: "w2" },
      ],
    });
    expect(d.rows.map((r) => [r.id, r.stage, r.href, r.company.name])).toEqual([["alpha.test", "ic", "/workflow?id=w1", "Alpha"]]);
  });
});
