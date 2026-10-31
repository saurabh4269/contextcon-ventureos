import { describe, expect, it } from "vitest";
import { companyDomainFrom, extractClaims } from "./extract";
import { blockedRecipients, outboundMode } from "@/lib/outbound";
import { advance, billedCredits, checkClaims, nextFreeSlot, validateMemo, type WorkflowDeps } from "./run";
import { applyAction } from "./actions";
import { EMPTY_MANDATE, type Mandate } from "@/lib/settings/mandate";
import { maskEmail, toPublicDeal } from "./public";
import { isRunningNow, newSteps, RUN_STALE_MS, stepOf, type Deal } from "./types";
import type { ResearchResult } from "@/lib/live/types";
import type { MemoryEvent } from "@/lib/memory/types";

const call = (id: string) => ({ id, method: "POST", path: `/company/${id}`, body: {}, status: "ok", ms: 1, cached: false, retrievedAt: "2026-10-31T00:00:00Z", creditsUsed: "1" });
function research(over: { country?: string; total?: number; six?: number; founded?: number } = {}): ResearchResult {
  const company = {
    id: 1, name: "Acme AI", domain: "acme.ai", description: "B2B AI automation software for lenders", yearFounded: over.founded ?? 2022, country: over.country ?? "IND", industries: ["Software Development"], categories: ["ai"],
    headcount: { total: over.total ?? 40, growth: { mom: 5, six_months: over.six ?? 45, yoy: 90 }, monthly: [{ date: "2026-09-30", v: 38 }, { date: "2026-10-31", v: 40 }], byFunction: [] },
    funding: { totalUsd: 2_000_000, investors: [] }, web: { monthly: [] }, followers: {}, news: [],
  };
  return {
    status: "ok", domain: "acme.ai", requestedAt: "2026-10-31T00:00:00Z", company, fields: {},
    calls: { identify: call("identify"), enrich: call("enrich"), founders: { ...call("founders"), data: { total: 1, people: [{ name: "Asha Rao", title: "CEO", current: [], past: [{ company: "Razorpay" }], schools: [] }] } }, jobs: call("jobs"), news: call("news"), comps: call("comps") },
  } as unknown as ResearchResult;
}

// a test fund mandate (what a firm would enter in Settings → Firm mandate)
const MANDATE: Mandate = { ...EMPTY_MANDATE, sectors: ["ai"], geos: ["IND"], partners: [{ name: "Partner A", focus: ["ai"] }], updatedAt: "2026-10-30T00:00:00Z" };

function fakes(r: ResearchResult = research(), mandate: Mandate = MANDATE) {
  const events: MemoryEvent[] = [];
  const saves: string[] = [];
  const stages: string[] = [];
  const deps: WorkflowDeps = {
    getMessage: async (id) => ({ id, threadId: "t1", from: "Asha Rao", fromAddress: "asha@acme.ai", to: "me", subject: "Acme AI — raising seed", date: "2026-10-30T00:00:00Z", snippet: "", body: "We are a team of 40, growing 20% MoM, founded in 2022 and raised $2M." }),
    research: async () => r,
    decisions: async () => ({ error: "no builder" }),
    listUpcoming: async () => [],
    model: null,
    memory: { label: "test memory", append: async (e) => { const ev = { ...e, id: String(events.length + 1), at: "2026-10-31T00:00:00Z" } as MemoryEvent; events.push(ev); return ev; }, list: async () => events },
    mandate,
    demoRecipient: ME,
    onStage: async (_d, stage, by, actor) => { stages.push(`${stage}:${actor}:${by}`); },
    now: () => new Date("2026-10-31T06:00:00Z"),
    save: async (d) => { saves.push(d.steps.map((s) => s.status[0]).join("")); },
  };
  return { deps, events, saves, stages };
}
const newDeal = (trigger: Deal["trigger"] = { type: "gmail", messageId: "m1", query: "q" }): Deal => ({ id: "d1", createdAt: "2026-10-31T00:00:00Z", updatedAt: "2026-10-31T00:00:00Z", trigger, company: {}, stage: "sourced", stageHistory: [{ stage: "sourced", at: "x", by: "x" }], steps: newSteps() });
const ME = "partner@example.com";
const DRY = { DEMO_RECIPIENT_ALLOWLIST: ME } as Record<string, string | undefined>;
const LIVE = { ...DRY, OUTBOUND_MODE: "live" };

describe("extract", () => {
  it("company domain from sender, skipping freemail; else from body", () => {
    expect(companyDomainFrom({ fromAddress: "a@acme.ai", subject: "", body: "" })).toBe("acme.ai");
    expect(companyDomainFrom({ fromAddress: "a@gmail.com", subject: "Intro", body: "see www.foo.io and linkedin.com" })).toBe("foo.io");
    expect(companyDomainFrom({ fromAddress: "a@gmail.com", subject: "hi", body: "no links" })).toBeNull();
  });
  it("claims", () => {
    const c = extractClaims("Team of 40, growing 20% MoM, 150% YoY, founded in 2022, raised $2.5M");
    expect(Object.fromEntries(c.map((x) => [x.key, x.value]))).toEqual({ growth_mom: 20, growth_yoy: 150, headcount: 40, founded: 2022, raised: 2_500_000 });
  });
});

describe("outbound allowlist", () => {
  it("blocks anyone not allowlisted; dry_run by default", () => {
    expect(blockedRecipients([ME, "x@acme.ai"], DRY)).toEqual(["x@acme.ai"]);
    expect(blockedRecipients([ME], {})).toEqual([ME]); // empty allowlist blocks everyone
    expect(outboundMode(DRY)).toBe("dry_run");
    expect(outboundMode({ OUTBOUND_LIVE: "1" })).toBe("live");
  });
});

describe("workflow run", () => {
  it("full flow: waits for transcript, then IC decision, then writes memory", async () => {
    const { deps, events, stages } = fakes();
    const deal = newDeal();
    await advance(deal, deps);
    expect(deal.steps.map((s) => s.status)).toEqual(["done", "done", "done", "done", "done", "waiting", "pending", "pending", "pending", "pending"]);
    expect(stepOf(deal, "transcript").needs).toBe("transcript");
    expect(deal.stage).toBe("diligence");
    const claims = stepOf(deal, "research").facts!.filter((f) => f.label.startsWith("Claim"));
    expect(claims.map((f) => f.status)).toEqual(["contradicted", "verified", "verified", "verified"]); // 20% MoM vs 5%
    expect(claims[0]!.citation).toMatchObject({ source: "Crustdata", path: "headcount.growth_percent.mom" });

    expect((await applyAction(deal, { action: "transcript", text: "Sample transcript: we now have 45 employees." }, {}, deps.now(), DRY)).ok).toBe(true);
    await advance(deal, deps);
    expect(stepOf(deal, "transcript").status).toBe("done");
    expect(stepOf(deal, "valuation").status).toBe("unavailable");
    expect(stepOf(deal, "memo").memo!.markdown).toMatch(/\[\d+\]/);
    expect(stepOf(deal, "pipeline")).toMatchObject({ status: "waiting", needs: "ic_decision" });
    expect(deal.stage).toBe("ic");

    await applyAction(deal, { action: "decide", verdict: "invest" }, {}, deps.now(), DRY);
    await advance(deal, deps);
    expect(deal.stage).toBe("portfolio");
    expect(deal.stageHistory.map((h) => h.stage)).toEqual(["sourced", "screening", "diligence", "ic", "portfolio"]);
    expect(stepOf(deal, "memory").status).toBe("done");
    // the memo and the decision are both firm memory entries
    expect(events.map((e) => e.kind)).toEqual(["memo.drafted", "workflow.decision"]);
    const decision = events.find((e) => e.kind === "workflow.decision")!;
    expect(decision).toMatchObject({ data: { verdict: "invest" } });
    expect((decision.data as { contradicted: string[] }).contradicted.length).toBeGreaterThan(0);
    // every stage move is mirrored to the deal-stage store; the IC decision is the person's
    expect(stages).toEqual(["screening:agent:Screener", "diligence:agent:Research agent", "ic:agent:Pipeline", "portfolio:user:Partner (you)"]);

    // a second deal sees the first as a precedent
    const d2 = newDeal({ type: "ask", domain: "other.ai" });
    d2.id = "d2";
    await advance(d2, deps);
    expect(stepOf(d2, "screen").facts!.some((f) => f.label.startsWith("Precedent"))).toBe(true);
  });

  it("screen fail waits for override; override continues", async () => {
    const { deps } = fakes(research({ country: "USA" }));
    const deal = newDeal();
    await advance(deal, deps);
    expect(stepOf(deal, "screen")).toMatchObject({ status: "waiting", needs: "approve_screen" });
    expect(stepOf(deal, "dataroom").status).toBe("pending");
    await applyAction(deal, { action: "override_screen" }, {}, deps.now(), DRY);
    await advance(deal, deps);
    expect(stepOf(deal, "screen").status).toBe("done");
    expect(stepOf(deal, "transcript").status).toBe("waiting");
  });

  it("no fund mandate configured → screen unavailable (no built-in defaults) and the flow continues", async () => {
    const { deps } = fakes(research(), EMPTY_MANDATE);
    const deal = newDeal();
    await advance(deal, deps);
    expect(stepOf(deal, "screen")).toMatchObject({ status: "unavailable" });
    expect(stepOf(deal, "screen").summary).toMatch(/no fund mandate configured/);
    expect(stepOf(deal, "schedule").facts!.find((f) => f.label === "Partner")).toMatchObject({ value: "not configured" });
    expect(stepOf(deal, "transcript").status).toBe("waiting");
  });

  it("screen gates are the mandate criteria deal decisions use, cited to Crustdata and the mandate", async () => {
    const { deps } = fakes();
    const deal = newDeal();
    await advance(deal, deps);
    const f = stepOf(deal, "screen").facts!;
    expect(f.find((x) => x.label === "Sector")).toMatchObject({ status: "pass", citation: { source: "Crustdata" } });
    expect(f.find((x) => x.label === "Geography")).toMatchObject({ status: "pass" });
    expect(f.find((x) => x.label === "Stage")).toMatchObject({ status: "unknown" }); // mandate has no stages set
    expect(stepOf(deal, "schedule").facts!.find((x) => x.label === "Partner")!.value).toMatch(/^Partner A/);
  });

  it("skip transcript → unavailable and the flow continues", async () => {
    const { deps } = fakes();
    const deal = newDeal();
    await advance(deal, deps);
    await applyAction(deal, { action: "skip_transcript" }, {}, deps.now(), DRY);
    await advance(deal, deps);
    expect(stepOf(deal, "transcript").status).toBe("unavailable");
    expect(stepOf(deal, "pipeline").needs).toBe("ic_decision");
  });

  it("drafts are never sent in dry_run, and blocked recipients are never sent even in live mode", async () => {
    const { deps } = fakes();
    const deal = newDeal();
    await advance(deal, deps);
    const dr = stepOf(deal, "dataroom").draft!;
    expect(dr.to).toEqual(["asha@acme.ai"]);
    expect(dr.blocked).toEqual(["asha@acme.ai"]);
    let sent = 0;
    const senders = { sendMessage: async () => { sent++; return { id: "x" }; }, insertEvent: async () => { sent++; return { id: "e" }; } };
    await applyAction(deal, { action: "approve", step: "dataroom" }, senders, deps.now(), LIVE);
    expect(sent).toBe(0);
    expect(dr.approved).toMatchObject({ transport: "dry_run" });
    await applyAction(deal, { action: "approve", step: "schedule" }, senders, deps.now(), DRY);
    expect(sent).toBe(0);
    expect(stepOf(deal, "schedule").draft!.approved!.result).toMatch(/Dry run/);
    expect(stepOf(deal, "schedule").draft!.to).toEqual([]);
  });

  it("ask trigger drafts to the demo recipient; live + allowlisted sends once", async () => {
    const { deps } = fakes();
    const deal = newDeal({ type: "ask", domain: "acme.ai" });
    await advance(deal, deps);
    const dr = stepOf(deal, "dataroom").draft!;
    expect(dr.to).toEqual([ME]);
    let sent = 0;
    await applyAction(deal, { action: "approve", step: "dataroom" }, { sendMessage: async () => { sent++; return { id: "m" }; } }, deps.now(), LIVE);
    expect(sent).toBe(1);
    expect(dr.approved).toMatchObject({ transport: "live", id: "m" });
  });
});

describe("claims and credits", () => {
  it("a transcript's \"team of 60\" is contradicted by Crustdata headcount 46 (and 45 vs 46 is verified)", () => {
    const co = (research({ total: 46 }) as Extract<ResearchResult, { status: "ok" }>).company;
    const [sixty] = checkClaims(extractClaims("We are a team of 60 engineers and operators."), co);
    expect(sixty).toMatchObject({ status: "contradicted", actual: 46, path: "headcount.total", shown: "Crustdata headcount.total: 46" });
    expect(checkClaims(extractClaims("we are 45 people"), co)[0]!.status).toBe("verified");
  });
  it("transcript claims are checked against Crustdata with citations", async () => {
    const { deps } = fakes(research({ total: 46 }));
    const deal = newDeal({ type: "ask", domain: "acme.ai" });
    await advance(deal, deps);
    await applyAction(deal, { action: "transcript", text: "Founder: we are a team of 60 and grew 50% in the last 6 months." }, {}, deps.now(), DRY);
    await advance(deal, deps);
    const said = stepOf(deal, "transcript").facts!.filter((f) => f.label.startsWith("Said in meeting"));
    expect(said.map((f) => [f.label, f.status])).toEqual([['Said in meeting: "50% in the last 6 months"', "verified"], ['Said in meeting: "team of 60"', "contradicted"]]);
    expect(said[1]!.citation).toMatchObject({ source: "Crustdata", path: "headcount.total" });
  });
  it("billed credits: uncached calls only, rounded to 2 decimals; all cached → 0 and flagged", () => {
    const r = research() as Extract<ResearchResult, { status: "ok" }>;
    const odd = { ...r, calls: { ...r.calls, enrich: { ...r.calls.enrich, creditsUsed: "2" }, founders: { ...r.calls.founders, creditsUsed: "0.99" }, jobs: { ...r.calls.jobs, creditsUsed: "0.03" }, comps: { ...r.calls.comps, creditsUsed: "0.35" }, news: { ...r.calls.news, creditsUsed: "1" }, identify: { ...r.calls.identify, creditsUsed: "0" } } };
    expect(billedCredits(odd)).toEqual({ credits: 4.37, cached: false });
    const cached = { ...odd, calls: Object.fromEntries(Object.entries(odd.calls).map(([k, c]) => [k, { ...c, cached: true }])) } as typeof odd;
    expect(billedCredits(cached)).toEqual({ credits: 0, cached: true });
  });
  it("valuation facts use plain labels and formatted money", async () => {
    const { deps } = fakes();
    const ok = (value: unknown) => ({ status: "ok", value, method: "m", inputs: [], citations: [{ source: "Crustdata", endpoint: "POST /company/enrich", path: "x", retrievedAt: "2026-10-31T00:00:00Z" }], reasoning: "r" });
    deps.decisions = async () => ({ source: "crustdata", decisions: { fitScore: ok(72.456), screenerVerdict: ok("Advance"), valuationRange: { status: "unavailable", reason: "no revenue" } } }) as never;
    const deal = newDeal({ type: "ask", domain: "acme.ai" });
    await advance(deal, deps);
    await applyAction(deal, { action: "skip_transcript" }, {}, deps.now(), DRY);
    await advance(deal, deps);
    const f = stepOf(deal, "valuation").facts!;
    expect(f.map((x) => [x.label, x.value])).toEqual([["Fit score", "72.46"], ["Screener verdict", "Advance"], ["Valuation range", "unavailable"], ["Return multiple (low)", "not computed"], ["Return multiple (high)", "not computed"], ["Comps median multiple", "not computed"]]);
  });
});

describe("public view and running state", () => {
  it("masks addresses, drops the founder email body, keeps facts", async () => {
    const { deps } = fakes();
    const deal = newDeal();
    await advance(deal, deps);
    const pub = toPublicDeal(deal);
    expect(JSON.stringify(pub)).not.toContain("asha@acme.ai");
    expect(pub.email).toMatchObject({ fromAddress: "a•••@acme.ai", subject: "Acme AI — raising seed" });
    expect(pub.email).not.toHaveProperty("body");
    expect(stepOf(pub as Deal, "dataroom").draft!.to).toEqual(["a•••@acme.ai"]);
    expect(maskEmail(null)).toBeNull();
  });
  it("a run that stopped saving long ago is not running any more", () => {
    const d = { ...newDeal(), running: true, updatedAt: "2026-10-31T00:00:00Z" };
    expect(isRunningNow(d, Date.parse("2026-10-31T00:01:00Z"))).toBe(true);
    expect(isRunningNow(d, Date.parse("2026-10-31T00:00:00Z") + RUN_STALE_MS + 1)).toBe(false);
  });
});

describe("helpers", () => {
  it("next free slot is a weekday 11:00–17:00 IST from tomorrow, avoiding busy events", () => {
    const now = new Date("2026-10-30T06:00:00Z"); // Fri 11:30 IST → Mon 2 Nov
    const s = nextFreeSlot(now, [{ start: "2026-11-02T05:30:00Z", end: "2026-11-02T06:30:00Z" }]);
    expect(s.start.toISOString()).toBe("2026-11-02T06:30:00.000Z"); // 12:00 IST
  });
  it("memo validation drops unknown citations and flags uncited numbers", () => {
    const v = validateMemo("Headcount is 40 [1]. Growth is 5% [9]. Fine text.", 2);
    expect(v.markdown).toContain("[1]");
    expect(v.markdown).not.toContain("[9]");
    expect(v.flagged).toBe(1);
    const w = validateMemo("Founded in 2024. [1] [2] Growth is 4.5% a month [2]. Team of 46 people.", 2);
    expect(w.flagged).toBe(1);
    expect(w.markdown).toContain("Founded in 2024. [1] [2]");
    expect(w.markdown).toContain("Team of 46 people. ⚠uncited");
  });
});
