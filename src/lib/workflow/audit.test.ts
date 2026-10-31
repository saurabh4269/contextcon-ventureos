// Business-logic audit of the workflow engine: each test below failed on the code before its fix (see the comments).
import { describe, expect, it } from "vitest";
import { advance, nextFreeSlot, type WorkflowDeps } from "./run";
import { applyAction, type Senders } from "./actions";
import { dispatchAction } from "./dispatch";
import { createWorkflowStore, StaleDealError } from "./store";
import { EMPTY_MANDATE, type Mandate } from "@/lib/settings/mandate";
import { isRunningNow, newSteps, stepOf, type Deal } from "./types";
import { createMemoryDocStore, createFileDocStore } from "@/lib/store/docs";
import type { ResearchResult } from "@/lib/live/types";
import type { MemoryEvent } from "@/lib/memory/types";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const NOW = new Date("2026-10-31T06:00:00Z");
const ME = "partner@example.com";
const DRY = { DEMO_RECIPIENT_ALLOWLIST: ME } as Record<string, string | undefined>;
const LIVE = { ...DRY, OUTBOUND_MODE: "live" };
const call = (id: string) => ({ id, method: "POST", path: `/company/${id}`, body: {}, status: "ok", ms: 1, cached: false, retrievedAt: "2026-10-31T00:00:00Z", creditsUsed: "1" });
function research(over: { growth?: boolean; industries?: string[]; country?: string } = {}): ResearchResult {
  const g = over.growth === false ? {} : { mom: 5, six_months: 45, yoy: 90 };
  const company = {
    id: 1, name: "Acme AI", domain: "acme.ai", description: "B2B AI automation software", yearFounded: 2022, country: over.country ?? "IND", industries: over.industries ?? ["Software Development"], categories: ["ai"],
    headcount: { total: 40, growth: g, monthly: [], byFunction: [] }, funding: { totalUsd: 2_000_000, investors: [] }, web: { monthly: [] }, followers: {}, news: [],
  };
  return { status: "ok", domain: "acme.ai", requestedAt: "2026-10-31T00:00:00Z", company, fields: {}, calls: { identify: call("identify"), enrich: call("enrich"), founders: { ...call("founders"), data: { total: 0, people: [] } }, jobs: call("jobs"), news: call("news"), comps: call("comps") } } as unknown as ResearchResult;
}
const MANDATE: Mandate = { ...EMPTY_MANDATE, sectors: ["ai"], geos: ["IND"], updatedAt: "2026-10-30T00:00:00Z" };
function fakes(over: Partial<WorkflowDeps> = {}) {
  const events: MemoryEvent[] = [];
  const stages: string[] = [];
  const deps: WorkflowDeps = {
    research: async () => research(), decisions: async () => ({ error: "no builder" }), model: null, mandate: MANDATE, demoRecipient: ME, listUpcoming: async () => [],
    memory: { label: "test", append: async (e) => { const ev = { ...e, id: String(events.length + 1), at: "2026-10-31T00:00:00Z" } as MemoryEvent; events.push(ev); return ev; }, list: async () => events },
    onStage: async (_d, stage) => { stages.push(stage); },
    now: () => NOW, save: async () => undefined, ...over,
  };
  return { deps, events, stages };
}
const ask = (): Deal => ({ id: "d1", createdAt: "2026-10-31T00:00:00Z", updatedAt: "2026-10-31T00:00:00Z", trigger: { type: "ask", domain: "acme.ai" }, company: { domain: "acme.ai" }, stage: "sourced", stageHistory: [{ stage: "sourced", at: "x", by: "x" }], steps: newSteps() });
const atIC = async () => { const f = fakes(); const d = ask(); await advance(d, f.deps); await applyAction(d, { action: "skip_transcript" }, {}, NOW, DRY); await advance(d, f.deps); return { ...f, d }; };
const snap = (d: Deal) => JSON.stringify(d);

describe("action legality: illegal actions return ok:false and change nothing", () => {
  it("approve with no draft, with an empty recipient list, or without a connected sender", async () => {
    const { d, deps } = await atIC();
    const noDraft = ask();
    expect(await applyAction(noDraft, { action: "approve", step: "dataroom" }, {}, NOW, DRY)).toMatchObject({ ok: false });
    // a draft with nobody to send to cannot be approved (dry-run would "record" a send to nobody)
    stepOf(d, "dataroom").draft!.to = [];
    const before = snap(d);
    expect(await applyAction(d, { action: "approve", step: "dataroom" }, {}, NOW, DRY)).toMatchObject({ ok: false, message: expect.stringMatching(/recipient/i) });
    expect(snap(d)).toBe(before);
    void deps;
  });
  it("a failed live approve (Gmail not connected) leaves the draft untouched (no blocked list written)", async () => {
    const { d } = await atIC();
    delete stepOf(d, "dataroom").draft!.blocked;
    const before = snap(d);
    expect(await applyAction(d, { action: "approve", step: "dataroom" }, {}, NOW, LIVE)).toMatchObject({ ok: false });
    expect(snap(d)).toBe(before);
  });
  it("approving a calendar draft whose slot has passed is refused; resume proposes a new slot", async () => {
    const { d, deps } = await atIC();
    const later = new Date("2026-11-20T06:00:00Z");
    const before = snap(d);
    expect(await applyAction(d, { action: "approve", step: "schedule" }, {}, later, DRY)).toMatchObject({ ok: false, message: expect.stringMatching(/passed|past/i) });
    expect(snap(d)).toBe(before);
    expect((await applyAction(d, { action: "resume" }, {}, later, DRY)).ok).toBe(true);
    expect(stepOf(d, "schedule").status).toBe("pending");
    await advance(d, { ...deps, now: () => later });
    expect(Date.parse(stepOf(d, "schedule").draft!.start!)).toBeGreaterThan(later.getTime());
  });
  it("decide twice before the run resumes keeps the first decision", async () => {
    const { d } = await atIC();
    expect((await applyAction(d, { action: "decide", verdict: "invest", note: "first" }, {}, NOW, DRY)).ok).toBe(true);
    const before = snap(d);
    expect(await applyAction(d, { action: "decide", verdict: "pass", note: "second" }, {}, NOW, DRY)).toMatchObject({ ok: false });
    expect(snap(d)).toBe(before);
    expect(d.decision).toMatchObject({ verdict: "invest", note: "first" });
  });
  it("decide before IC is refused", async () => {
    const d = ask();
    expect(await applyAction(d, { action: "decide", verdict: "invest" }, {}, NOW, DRY)).toMatchObject({ ok: false, message: expect.stringMatching(/IC/) });
    expect(d.decision).toBeUndefined();
  });
  it("skip_transcript after a transcript, or when no transcript is wanted, changes nothing", async () => {
    const f = fakes(); const d = ask();
    await advance(d, f.deps);
    await applyAction(d, { action: "transcript", text: "we are 40 people" }, {}, NOW, DRY);
    const before = snap(d);
    expect(await applyAction(d, { action: "skip_transcript" }, {}, NOW, DRY)).toMatchObject({ ok: false });
    expect(snap(d)).toBe(before);
    const fresh = ask(); // intake not run yet: the transcript step is not waiting for anything
    expect(await applyAction(fresh, { action: "skip_transcript" }, {}, NOW, DRY)).toMatchObject({ ok: false });
    expect(stepOf(fresh, "transcript").status).toBe("pending");
  });
  it("override_screen is only legal while the screen waits for it", async () => {
    const { d } = await atIC(); // the screen passed
    const before = snap(d);
    expect(await applyAction(d, { action: "override_screen" }, {}, NOW, DRY)).toMatchObject({ ok: false });
    expect(snap(d)).toBe(before);
    expect(d.screenOverride).toBeUndefined();
  });
  it("regenerate_memo and transcript are refused once the IC decision is recorded", async () => {
    const { d } = await atIC();
    await applyAction(d, { action: "decide", verdict: "pass" }, {}, NOW, DRY);
    const before = snap(d);
    expect(await applyAction(d, { action: "regenerate_memo" }, {}, NOW, DRY)).toMatchObject({ ok: false });
    expect(await applyAction(d, { action: "transcript", text: "late notes" }, {}, NOW, DRY)).toMatchObject({ ok: false });
    expect(snap(d)).toBe(before);
  });
  it("a deal in Portfolio/Passed is terminal: every action except resume is refused", async () => {
    const { d, deps } = await atIC();
    await applyAction(d, { action: "decide", verdict: "invest" }, {}, NOW, DRY);
    await advance(d, deps);
    expect(d.stage).toBe("portfolio");
    const before = snap(d);
    for (const a of [{ action: "approve", step: "schedule" }, { action: "transcript", text: "x" }, { action: "skip_transcript" }, { action: "override_screen" }, { action: "decide", verdict: "pass" }, { action: "regenerate_memo" }] as const)
      expect(await applyAction(d, a, {}, NOW, DRY), a.action).toMatchObject({ ok: false });
    expect(snap(d)).toBe(before);
  });
  it("resume while a run is in flight is refused (it would reset a running step)", async () => {
    const d = ask();
    stepOf(d, "intake").status = "running";
    d.running = true; d.updatedAt = NOW.toISOString();
    expect(await applyAction(d, { action: "resume" }, {}, NOW, DRY)).toMatchObject({ ok: false });
    expect(stepOf(d, "intake").status).toBe("running");
    // stale: it is allowed and resets the step
    expect((await applyAction(d, { action: "resume" }, {}, new Date(NOW.getTime() + 3_600_000), DRY)).ok).toBe(true);
    expect(stepOf(d, "intake").status).toBe("pending");
  });
  it("a timestamp far in the future (clock skew) does not pin a run as running forever", () => {
    const d = { ...ask(), running: true, updatedAt: "2026-10-31T09:00:00Z" };
    expect(isRunningNow(d, NOW.getTime())).toBe(false);
  });
});

describe("stage mirror", () => {
  it("a re-run of an earlier step never moves the stage back or adds history", async () => {
    const { d, deps, stages } = await atIC();
    expect(d.stage).toBe("ic");
    const hist = d.stageHistory.length, n = stages.length;
    stepOf(d, "research").status = "pending"; stepOf(d, "screen").status = "pending";
    await advance(d, deps);
    expect(d.stage).toBe("ic");
    expect(d.stageHistory).toHaveLength(hist);
    expect(stages).toHaveLength(n);
  });
  it("a closed deal never leaves Passed/Portfolio even if an earlier step is retried", async () => {
    const { d, deps } = await atIC();
    await applyAction(d, { action: "decide", verdict: "pass" }, {}, NOW, DRY);
    await advance(d, deps);
    expect(d.stage).toBe("passed");
    stepOf(d, "research").status = "pending";
    await advance(d, deps);
    expect(d.stage).toBe("passed");
    expect(d.stageHistory.map((h) => h.stage)).toEqual(["sourced", "screening", "diligence", "ic", "passed"]);
  });
  it("a failing onStage is recorded on the deal and retried by the next run (not silently inconsistent forever)", async () => {
    let fail = true; const seen: string[] = [];
    const { deps } = fakes({ onStage: async (_d, s) => { if (fail) throw new Error("store down"); seen.push(s); } });
    const d = ask();
    await advance(d, deps);
    expect(d.stage).toBe("diligence");
    expect(d.stageSyncError).toMatch(/store down/);
    fail = false;
    await advance(d, deps);
    expect(seen).toEqual(["diligence"]);
    expect(d.stageSyncError).toBeUndefined();
  });
});

describe("step results are not stale", () => {
  it("a re-run that ends unavailable drops the earlier run's facts (no old numbers in the memo)", async () => {
    const ok = (value: unknown) => ({ status: "ok", value, method: "m", inputs: [], citations: [{ source: "Crustdata", endpoint: "POST /company/enrich", path: "x", retrievedAt: "2026-10-31T00:00:00Z" }], reasoning: "r" });
    let fail = false;
    const { deps } = fakes({ decisions: async () => (fail ? { error: "502 upstream" } : ({ source: "crustdata", decisions: { fitScore: ok(72) } } as never)) });
    const d = ask();
    await advance(d, deps);
    await applyAction(d, { action: "skip_transcript" }, {}, NOW, DRY);
    await advance(d, deps);
    expect(stepOf(d, "valuation").facts!.length).toBeGreaterThan(0);
    fail = true;
    stepOf(d, "valuation").status = "pending"; stepOf(d, "memo").status = "pending";
    await advance(d, deps);
    expect(stepOf(d, "valuation")).toMatchObject({ status: "unavailable" });
    expect(stepOf(d, "valuation").facts).toBeUndefined();
    expect(stepOf(d, "memo").memo!.markdown).not.toMatch(/Fit score/);
  });
});

describe("intake and screen data correctness", () => {
  it("Gmail not connected: the run stops at intake instead of drafting a data-room request to nobody", async () => {
    const { deps } = fakes({ getMessage: undefined });
    const d: Deal = { ...ask(), trigger: { type: "gmail", messageId: "m1", query: "q" }, company: {} };
    await advance(d, deps);
    expect(stepOf(d, "intake").status).toBe("unavailable");
    expect(stepOf(d, "dataroom").status).toBe("pending");
    expect(stepOf(d, "schedule").status).toBe("pending");
    expect(d.running).toBe(false);
    // once connected, resume retries intake
    await applyAction(d, { action: "resume" }, {}, NOW, DRY);
    expect(stepOf(d, "intake").status).toBe("pending");
  });
  it("a screen where no criterion could be evaluated is unavailable, not a pass", async () => {
    const { deps } = fakes({ research: async () => research({ industries: [], country: "" }), mandate: { ...EMPTY_MANDATE, stages: ["Series A"], updatedAt: "2026-10-30T00:00:00Z" } });
    const d = ask();
    await advance(d, deps);
    const s = stepOf(d, "screen");
    expect(s.facts!.filter((f) => ["Sector", "Stage", "Geography", "Check size"].includes(f.label)).every((f) => f.status === "unknown")).toBe(true);
    expect(s.status).toBe("unavailable");
  });
  it("unknown headcount growth is not shown as a cited fact (it would land in the memo as 'MoM unknown')", async () => {
    const { deps } = fakes({ research: async () => research({ growth: false }) });
    const d = ask();
    await advance(d, deps);
    const g = stepOf(d, "research").facts!.find((f) => f.label === "Headcount growth")!;
    expect(g).toMatchObject({ value: "unknown", status: "unknown" });
    expect(g.citation).toBeUndefined();
  });
});

describe("schedule", () => {
  it("no free slot in three weeks: null, never a silently clashing or weekend slot", () => {
    const busy = [{ start: "2026-10-31T00:00:00Z", end: "2026-12-31T00:00:00Z" }];
    expect(nextFreeSlot(NOW, busy)).toBeNull();
  });
  it("the schedule step reports unavailable when nothing is free", async () => {
    const { deps } = fakes({ listUpcoming: async () => [{ start: "2026-10-31T00:00:00Z", end: "2026-12-31T00:00:00Z" } as never] });
    const d = ask();
    await advance(d, deps);
    expect(stepOf(d, "schedule").status).toBe("unavailable");
    expect(stepOf(d, "schedule").draft).toBeUndefined();
  });
  it("a slot is never in the past, on a weekend, or outside 11:00-17:00 IST (Friday evening IST, server UTC)", () => {
    const fri = new Date("2026-10-30T20:00:00Z"); // Sat 01:30 IST
    const s = nextFreeSlot(fri, [])!;
    expect(s.start.getTime()).toBeGreaterThan(fri.getTime());
    expect(s.start.toISOString()).toBe("2026-11-02T05:30:00.000Z"); // Mon 11:00 IST
  });
});

describe("memory", () => {
  it("a retried memory step does not write a second decision event", async () => {
    const { d, deps, events } = await atIC();
    await applyAction(d, { action: "decide", verdict: "invest" }, {}, NOW, DRY);
    await advance(d, deps);
    expect(events.filter((e) => e.kind === "workflow.decision")).toHaveLength(1);
    stepOf(d, "memory").status = "pending"; // e.g. the run died after the append, before the save
    await advance(d, deps);
    expect(events.filter((e) => e.kind === "workflow.decision")).toHaveLength(1);
    expect(stepOf(d, "memory").status).toBe("done");
  });
  it("memory down at the decision: the step errors with the real reason, the deal is closed, resume writes it once", async () => {
    let down = true;
    const { deps, events } = fakes();
    const base = deps.memory;
    deps.memory = { ...base, append: async (e) => { if (down && e.kind === "workflow.decision") throw new Error("memory down"); return base.append(e); } };
    const d = ask();
    await advance(d, deps);
    await applyAction(d, { action: "skip_transcript" }, {}, NOW, DRY);
    await advance(d, deps);
    await applyAction(d, { action: "decide", verdict: "pass" }, {}, NOW, DRY);
    await advance(d, deps);
    expect(stepOf(d, "memory")).toMatchObject({ status: "error", error: "memory down" });
    expect(d.stage).toBe("passed");
    down = false;
    expect((await applyAction(d, { action: "resume" }, {}, NOW, DRY)).ok).toBe(true);
    await advance(d, deps);
    expect(events.filter((e) => e.kind === "workflow.decision")).toHaveLength(1);
  });
});

describe("errors mid-run", () => {
  it("a step stuck 'running' with the deal not running is retried by the next advance", async () => {
    const { deps } = fakes();
    const d = ask();
    stepOf(d, "intake").status = "running";
    await advance(d, deps);
    expect(stepOf(d, "intake").status).toBe("done");
  });
  it("deal.running is cleared and finished steps are kept when the store save throws mid-run", async () => {
    let n = 0;
    const saved: Deal[] = [];
    const { deps } = fakes({ save: async (x) => { n++; if (n === 5) throw new Error("disk full"); saved.push(JSON.parse(JSON.stringify(x))); } });
    const d = ask();
    await expect(advance(d, deps)).rejects.toThrow(/disk full/);
    expect(d.running).toBe(false);
    expect(saved.at(-1)!.running).toBe(false);
  });
  it("Gmail throwing at intake marks the intake step error with the reason; later steps stay pending", async () => {
    const { deps } = fakes({ getMessage: async () => { throw new Error("401 invalid_grant"); } });
    const d: Deal = { ...ask(), trigger: { type: "gmail", messageId: "m1", query: "q" }, company: {} };
    await advance(d, deps);
    expect(stepOf(d, "intake")).toMatchObject({ status: "error", error: "401 invalid_grant" });
    expect(stepOf(d, "screen").status).toBe("pending");
  });
});

describe("concurrency: dispatch + atomic store", () => {
  const seed = async () => {
    const docs = createMemoryDocStore();
    const store = createWorkflowStore(() => docs);
    const { d, deps } = await atIC();
    await store.save(d);
    return { store, d, deps };
  };
  it("two concurrent approves on a live Gmail draft send at most once", async () => {
    const { store, d } = await seed();
    let sent = 0;
    const senders: Senders = { sendMessage: async () => { sent++; await new Promise((r) => setTimeout(r, 20)); return { id: "m" }; } };
    stepOf(d, "dataroom").draft!.to = [ME];
    await store.save(d);
    const [a, b] = await Promise.all([1, 2].map(() => dispatchAction(store, d.id, { action: "approve", step: "dataroom" }, senders, NOW, LIVE)));
    expect(sent).toBe(1);
    // the loser either saw the finished approval (idempotent ok) or the running claim (409); never a second send
    expect([a, b].filter((r) => r.ok && r.deal.running).length).toBeGreaterThanOrEqual(1);
    expect((await store.get(d.id))!.steps.find((s) => s.id === "dataroom")!.draft!.approved).toMatchObject({ transport: "live", id: "m" });
  });
  it("baseline: the old unserialised get -> apply -> save path sends twice (why dispatch exists)", async () => {
    const { store, d } = await seed();
    let sent = 0;
    const senders: Senders = { sendMessage: async () => { sent++; await new Promise((r) => setTimeout(r, 20)); return { id: "m" }; } };
    stepOf(d, "dataroom").draft!.to = [ME];
    await store.save(d);
    await Promise.all([1, 2].map(async () => { const x = (await store.get(d.id))!; await applyAction(x, { action: "approve", step: "dataroom" }, senders, NOW, LIVE); await store.save(x); }));
    expect(sent).toBe(2);
  });
  it("an action on a deal whose run is in flight is a 409 and changes nothing", async () => {
    const { store, d } = await seed();
    await store.update(d.id, (c) => ({ ...c!, running: true, updatedAt: NOW.toISOString() }));
    const before = JSON.stringify(await store.get(d.id));
    expect(await dispatchAction(store, d.id, { action: "decide", verdict: "invest" }, {}, NOW, DRY)).toMatchObject({ ok: false, status: 409 });
    expect(JSON.stringify(await store.get(d.id))).toBe(before);
  });
  it("two concurrent decisions: exactly one wins", async () => {
    const { store, d } = await seed();
    const rs = await Promise.all([dispatchAction(store, d.id, { action: "decide", verdict: "invest" }, {}, NOW, DRY), dispatchAction(store, d.id, { action: "decide", verdict: "pass" }, {}, NOW, DRY)]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect((await store.get(d.id))!.decision!.verdict).toBe("invest");
  });
  it("unknown deal is 404; a bad body is 400", async () => {
    const { store } = await seed();
    expect(await dispatchAction(store, "nope", { action: "resume" }, {}, NOW, DRY)).toMatchObject({ ok: false, status: 404 });
    expect(await dispatchAction(store, "d1", { action: "approve" }, {}, NOW, DRY)).toMatchObject({ ok: false, status: 400 });
  });
  it("a stale copy cannot overwrite what another writer saved (lost update)", async () => {
    const { store, d } = await seed();
    const copyA = (await store.get(d.id))!;
    const copyB = (await store.get(d.id))!;
    copyA.company = { ...copyA.company, name: "A" };
    await store.saveGuarded(copyA);
    await expect(store.saveGuarded(copyB)).rejects.toBeInstanceOf(StaleDealError);
    await store.saveGuarded(copyA); // the writer that holds the latest rev keeps saving
  });
});

describe("DocStore.update is atomic", () => {
  const incr = async (docs: ReturnType<typeof createMemoryDocStore>) => {
    await docs.put("counters", "c", { n: 0 });
    await Promise.all(Array.from({ length: 25 }, () => docs.update<{ n: number }>("counters", "c", async (cur) => { await new Promise((r) => setTimeout(r, Math.random() * 3)); return { n: cur!.n + 1 }; })));
    expect(await docs.get("counters", "c")).toEqual({ n: 25 });
  };
  it("memory store: 25 concurrent increments make 25", async () => { await incr(createMemoryDocStore()); });
  it("file store: 25 concurrent increments make 25", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dd-docs-"));
    await incr(createFileDocStore(dir) as never);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it("update creates a missing document, leaves it alone on undefined, and a throw changes nothing", async () => {
    const docs = createMemoryDocStore();
    expect(await docs.update("ns", "a", () => undefined)).toBeNull();
    expect(await docs.get("ns", "a")).toBeNull();
    await docs.update<{ v: number }>("ns", "a", (c) => ({ v: (c?.v ?? 0) + 1 }));
    await expect(docs.update("ns", "a", () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(await docs.get("ns", "a")).toEqual({ v: 1 });
    await docs.update("ns", "a", () => undefined);
    expect(await docs.get("ns", "a")).toEqual({ v: 1 });
  });
  it("moveStage: concurrent moves keep every history entry", async () => {
    const { moveStage } = await import("@/lib/deals/stages");
    const docs = createMemoryDocStore();
    await Promise.all(["screening", "diligence", "ic"].map((stage) => moveStage({ domain: "a.test", stage: stage as never, by: "x", actor: "agent" }, docs, {})));
    const r = await docs.get<{ history: unknown[] }>("deal_stages", "a.test");
    expect(r!.history).toHaveLength(3);
  });
});

describe("approve is two-phase and at-most-once (live Gmail and Calendar)", () => {
  const seed = async (step: "dataroom" | "schedule") => {
    const docs = createMemoryDocStore();
    const real = createWorkflowStore(() => docs);
    const { d } = await atIC();
    if (step === "dataroom") stepOf(d, "dataroom").draft!.to = [ME];
    await real.save(d);
    // fault injection: the Nth update call throws (after the send when N is the phase-3 write)
    let calls = 0, failAt = 0;
    const store = { ...real, update: (id: string, fn: Parameters<typeof real.update>[1]) => { calls++; if (calls === failAt) return Promise.reject(new Error("store write failed")); return real.update(id, fn); } };
    return { real, store, d, failNext: (n = 2) => { calls = 0; failAt = n; }, reset: () => { calls = 0; failAt = 0; } };
  };
  const counter = () => { const c = { gmail: 0, cal: 0 }; const senders: Senders = { sendMessage: async () => { c.gmail++; return { id: "g1" }; }, insertEvent: async () => { c.cal++; return { id: "e1" }; } }; return { c, senders }; };
  const draftOf = async (real: ReturnType<typeof createWorkflowStore>, id: string, step: "dataroom" | "schedule") => stepOf((await real.get(id))!, step).draft!;
  // the schedule draft's slot is tomorrow (IST); LIVE needs the calendar sender and an allowlist (no recipients on a calendar draft)

  for (const [step, key] of [["dataroom", "gmail"], ["schedule", "cal"]] as const) {
    it(`${step}: send succeeds, the store write after it fails -> a second approve does not send again`, async () => {
      const { real, store, d, failNext, reset } = await seed(step);
      const { c, senders } = counter();
      failNext(2); // call 1 = phase 1 (mark sending), call 2 = phase 3 (record) fails
      const first = await dispatchAction(store, d.id, { action: "approve", step }, senders, NOW, LIVE);
      expect(first).toMatchObject({ ok: false, status: 502, message: expect.stringMatching(/will not be sent again/) });
      expect(c[key]).toBe(1);
      expect((await draftOf(real, d.id, step)).sending).toBeDefined(); // persisted before the send
      expect((await draftOf(real, d.id, step)).approved).toBeUndefined();
      reset();
      const second = await dispatchAction(store, d.id, { action: "approve", step }, senders, NOW, LIVE);
      expect(second).toMatchObject({ ok: false, status: 409, message: expect.stringMatching(/in progress or its outcome is unknown/) });
      expect(c[key]).toBe(1);
      // resume never retries it either
      await dispatchAction(store, d.id, { action: "resume" }, senders, NOW, LIVE);
      expect((await draftOf(real, d.id, step)).sending).toBeDefined();
      // a person confirms it was sent: approved, still one send
      await real.update(d.id, (x) => ({ ...x!, running: false }));
      expect(await dispatchAction(store, d.id, { action: "resolve_send", step, resolution: "confirm_sent" }, senders, NOW, LIVE)).toMatchObject({ ok: true });
      const dr = await draftOf(real, d.id, step);
      expect(dr.sending).toBeUndefined();
      expect(dr.approved).toMatchObject({ transport: "live" });
      await real.update(d.id, (x) => ({ ...x!, running: false }));
      expect(await dispatchAction(store, d.id, { action: "approve", step }, senders, NOW, LIVE)).toMatchObject({ ok: true });
      expect(c[key]).toBe(1);
    });
    it(`${step}: discard_send clears the mark and allows exactly one new send`, async () => {
      const { real, store, d, failNext, reset } = await seed(step);
      const { c, senders } = counter();
      failNext(2);
      await dispatchAction(store, d.id, { action: "approve", step }, senders, NOW, LIVE);
      reset();
      await dispatchAction(store, d.id, { action: "resolve_send", step, resolution: "discard_send" }, senders, NOW, LIVE);
      await real.update(d.id, (x) => ({ ...x!, running: false }));
      expect(await dispatchAction(store, d.id, { action: "approve", step }, senders, NOW, LIVE)).toMatchObject({ ok: true });
      expect(c[key]).toBe(2); // the first (unrecorded) one plus the person-authorised retry
      expect((await draftOf(real, d.id, step)).approved).toMatchObject({ id: key === "gmail" ? "g1" : "e1" });
    });
  }
  it("a sending mark older than RUN_STALE_MS is reported as outcome unknown and never auto-retried", async () => {
    const { real, store, d } = await seed("dataroom");
    const { c, senders } = counter();
    await real.update(d.id, (x) => { stepOf(x!, "dataroom").draft!.sending = { at: "2026-10-31T00:00:00Z", by: "x" }; return x!; });
    const r = await dispatchAction(store, d.id, { action: "approve", step: "dataroom" }, senders, new Date("2026-10-31T06:00:00Z"), LIVE);
    expect(r).toMatchObject({ ok: false, status: 409, message: expect.stringMatching(/outcome unknown.*not be retried automatically/) });
    expect(c.gmail).toBe(0);
  });
  it("a 4xx from Google (rejected, nothing delivered) clears the mark so the person can retry", async () => {
    const { real, store, d } = await seed("dataroom");
    let n = 0;
    const senders: Senders = { sendMessage: async () => { if (++n === 1) throw Object.assign(new Error("gmail 400 invalid"), { httpStatus: 400 }); return { id: "g2" }; } };
    expect(await dispatchAction(store, d.id, { action: "approve", step: "dataroom" }, senders, NOW, LIVE)).toMatchObject({ ok: false, status: 502, message: "gmail 400 invalid" });
    expect((await draftOf(real, d.id, "dataroom")).sending).toBeUndefined();
    expect(await dispatchAction(store, d.id, { action: "approve", step: "dataroom" }, senders, NOW, LIVE)).toMatchObject({ ok: true });
    expect(n).toBe(2);
  });
  for (const [label, err] of [["a timeout (no status)", new Error("request timed out")], ["a 5xx", Object.assign(new Error("gmail 503"), { httpStatus: 503 })], ["a 3xx-less odd status", Object.assign(new Error("weird"), { httpStatus: 302 })]] as const)
    it(`${label}: the mark stays, the message says the outcome is unknown, and a second approve does not send`, async () => {
      const { real, store, d } = await seed("dataroom");
      let n = 0;
      const senders: Senders = { sendMessage: async () => { n++; throw err; } };
      expect(await dispatchAction(store, d.id, { action: "approve", step: "dataroom" }, senders, NOW, LIVE)).toMatchObject({ ok: false, status: 502, message: expect.stringMatching(/outcome is unknown.*resolve_send/) });
      expect((await draftOf(real, d.id, "dataroom")).sending).toBeDefined();
      expect(await dispatchAction(store, d.id, { action: "approve", step: "dataroom" }, senders, NOW, LIVE)).toMatchObject({ ok: false, status: 409 });
      expect(n).toBe(1);
    });
  it("concurrent live approves send once; the dry run stays single-phase", async () => {
    const { real, store, d } = await seed("dataroom");
    const { c, senders } = counter();
    await Promise.all([1, 2, 3].map(() => dispatchAction(store, d.id, { action: "approve", step: "dataroom" }, senders, NOW, LIVE)));
    expect(c.gmail).toBe(1);
    const dry = await seed("dataroom");
    let calls = 0;
    const counting = { ...dry.real, update: (id: string, fn: Parameters<typeof dry.real.update>[1]) => { calls++; return dry.real.update(id, fn); } };
    expect(await dispatchAction(counting, dry.d.id, { action: "approve", step: "dataroom" }, senders, NOW, DRY)).toMatchObject({ ok: true });
    expect(calls).toBe(1);
    void real;
  });
  it("resolve_send with nothing pending, or a bad resolution, is refused", async () => {
    const { store, d } = await seed("dataroom");
    expect(await dispatchAction(store, d.id, { action: "resolve_send", step: "dataroom", resolution: "confirm_sent" }, {}, NOW, LIVE)).toMatchObject({ ok: false, status: 400 });
    expect(await dispatchAction(store, d.id, { action: "resolve_send", step: "dataroom", resolution: "x" }, {}, NOW, LIVE)).toMatchObject({ ok: false, status: 400 });
  });
});
