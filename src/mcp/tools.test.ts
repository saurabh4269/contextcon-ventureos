// MCP tool handlers against a mocked HTTP layer: no network, no running server.
import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { DealDeskHttp } from "./http";
import { createServer } from "./server";
import { actOnDealWorkflow, approveReviewItem, collectSources, getDealWorkflow, getDecisions, listDealWorkflows, listReviewQueue, normalizeDomain, researchCompany, runDealWorkflow, screenCompanies, startDealWorkflow } from "./tools";

type Route = (url: URL, init: RequestInit) => Response | Promise<Response>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function mockHttp(routes: Record<string, Route>) {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  const f = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    calls.push({ method: init.method ?? "GET", url: url.pathname + url.search, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const key = `${init.method ?? "GET"} ${url.pathname}`;
    const h = routes[key];
    return h ? h(url, init) : json({ status: "error", message: `no mock for ${key}` }, 404);
  });
  return { http: new DealDeskHttp("http://dd.test", f as unknown as typeof fetch), calls };
}

const cit = (path: string) => ({ source: "Crustdata", endpoint: "POST /company/enrich", path, retrievedAt: "2026-10-31T08:00:00Z" });
const decisionsBody = {
  dealId: "e2b.dev", companyDomain: "e2b.dev", source: "crustdata",
  decisions: {
    fitScore: { status: "ok", value: 72, method: "m", inputs: [], reasoning: "r", citations: [cit("headcount.total")] },
    screenerVerdict: { status: "unavailable", reason: "needs the firm thesis gates and an inbound pitch" },
  },
};

describe("helpers", () => {
  it("normalizes domains and rejects junk", () => {
    expect(normalizeDomain("https://www.E2B.dev/about")).toBe("e2b.dev");
    expect(normalizeDomain("not a domain")).toBeNull();
    expect(normalizeDomain(42)).toBeNull();
  });
  it("collects nested citations once", () => {
    const s = collectSources({ a: { citations: [cit("x"), cit("x")] }, rows: [{ cells: [{ citation: { ref: "c1", method: "POST", endpoint: "POST /job/search", path: "total_count", retrievedAt: null } }] }] });
    expect(s).toHaveLength(2);
    expect(s[1]).toMatchObject({ endpoint: "POST /job/search", path: "total_count", retrievedAt: null });
  });
});

describe("tool handlers", () => {
  it("screen_companies returns the final cited shortlist from the NDJSON stream", async () => {
    const result = { rows: [{ name: { value: "Acme" }, cells: [{ key: "hq", value: "Berlin", status: "verified", citation: { ref: "c1", method: "POST", endpoint: "POST /company/search", path: "companies[0].hq", retrievedAt: "t" } }] }], caveats: [] };
    const { http, calls } = mockHttp({ "POST /api/live/screen": () => new Response(`{"type":"start"}\n{"type":"plan","step":1,"text":"search"}\n${JSON.stringify({ type: "final", result })}\n`) });
    const seen: string[] = [];
    const r = await screenCompanies(http, "  AI infra startups in Berlin ", (e) => seen.push(String(e.type)));
    expect(calls[0]).toMatchObject({ method: "POST", url: "/api/live/screen", body: { query: "AI infra startups in Berlin" } });
    expect(r.ok).toBe(true);
    expect(r.sources).toEqual([{ endpoint: "POST /company/search", path: "companies[0].hq", retrievedAt: "t" }]);
    expect(seen).toEqual(["start", "plan", "final"]);
  });

  it("screen_companies surfaces model_unavailable instead of inventing rows", async () => {
    const { http } = mockHttp({ "POST /api/live/screen": () => new Response(`{"type":"model_unavailable","message":"no model key"}\n`, { status: 503 }) });
    const r = await screenCompanies(http, "fintech in India");
    expect(r).toMatchObject({ ok: false, status: 503, sources: [] });
    expect(r.note).toMatch(/Sourcing agent/);
  });

  it("screen_companies validates the request without calling the server", async () => {
    const { http, calls } = mockHttp({});
    expect((await screenCompanies(http, "   ")).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("research_company calls /api/live/research with the normalized domain", async () => {
    const { http, calls } = mockHttp({ "GET /api/live/research": () => json({ status: "ok", domain: "e2b.dev", fields: { headcountLatest: { status: "ok", value: 40, citations: [cit("headcount.total")] } } }) });
    const r = await researchCompany(http, "https://e2b.dev");
    expect(calls[0].url).toBe("/api/live/research?domain=e2b.dev");
    expect(r.sources).toHaveLength(1);
    expect((await researchCompany(http, "nope")).status).toBe(400);
  });

  it("get_decisions summarizes each decision as ok+sources or unavailable+reason", async () => {
    const { http, calls } = mockHttp({ "GET /api/deals/e2b.dev/decisions": () => json(decisionsBody) });
    const r = await getDecisions(http, "e2b.dev", { review: false });
    expect(calls[0].url).toBe("/api/deals/e2b.dev/decisions?review=0");
    const summary = (r.data as { summary: Record<string, unknown> }).summary;
    expect(summary.fitScore).toMatchObject({ status: "ok", value: 72, sources: [{ endpoint: "POST /company/enrich", path: "headcount.total" }] });
    expect(summary.screenerVerdict).toEqual({ status: "unavailable", reason: "needs the firm thesis gates and an inbound pitch" });
  });

  it("reports an unreachable server honestly", async () => {
    const f = vi.fn(async () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }); });
    const r = await getDecisions(new DealDeskHttp("http://dd.test", f as unknown as typeof fetch), "e2b.dev");
    expect(r).toMatchObject({ ok: false, status: 0, data: { status: "unreachable", message: expect.stringContaining("ECONNREFUSED") } });
  });

  it("list_review_queue passes status and run filters", async () => {
    const { http, calls } = mockHttp({ "GET /api/exceptions": () => json({ open: 0, items: [] }) });
    await listReviewQueue(http, { run: "deal:e2b.dev:decisions" });
    expect(calls[0].url).toBe("/api/exceptions?status=open&run=deal%3Ae2b.dev%3Adecisions");
  });
});

describe("approve_review_item", () => {
  const item = { id: "x1", kind: "missing_data", title: "Valuation missing", reason: "r", status: "open", runId: null, actions: { approve: "Accept" }, evidence: [{ label: "a", value: 1, citation: cit("p") }] };
  const routes = () => mockHttp({ "GET /api/exceptions": () => json({ items: [item] }), "POST /api/exceptions/x1": () => json({ status: "ok", item: { ...item, status: "approved", resolution: { effect: "accepted" } } }) });

  it("is a dry run by default and never POSTs", async () => {
    const { http, calls } = routes();
    const r = await approveReviewItem(http, "x1", {}, { DEALDESK_ALLOW_APPROVE: "1" });
    expect(r.data).toMatchObject({ dryRun: true, wouldDo: "Accept" });
    expect(r.sources).toHaveLength(1);
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });
  it("stays a dry run with confirm but without the env gate", async () => {
    const { http, calls } = routes();
    const r = await approveReviewItem(http, "x1", { confirm: true }, {});
    expect(r.data).toMatchObject({ dryRun: true, reason: expect.stringMatching(/DEALDESK_ALLOW_APPROVE/) });
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });
  it("approves through the existing route when both gates pass", async () => {
    const { http, calls } = routes();
    const r = await approveReviewItem(http, "x1", { confirm: true }, { DEALDESK_ALLOW_APPROVE: "1" });
    expect(calls.at(-1)).toMatchObject({ method: "POST", url: "/api/exceptions/x1", body: { action: "approve" } });
    expect(r.ok).toBe(true);
  });
  it("404s an unknown id", async () => {
    const { http } = routes();
    expect((await approveReviewItem(http, "nope", { confirm: true }, { DEALDESK_ALLOW_APPROVE: "1" })).status).toBe(404);
  });
});

describe("run_deal_workflow", () => {
  const base = {
    "GET /api/live/research": () => json({ status: "ok", domain: "e2b.dev", fields: { a: { status: "ok", citations: [cit("a")] } } }),
    "GET /api/deals/e2b.dev/decisions": () => json(decisionsBody),
    "GET /api/exceptions": () => json({ items: [{ id: "r1", kind: "missing_data", title: "Screener verdict", reason: "unavailable", status: "open", runId: "deal:e2b.dev:decisions" }] }),
    "POST /api/outbound/email": () => json({ status: "ok", transport: "dry_run", wouldSend: { to: ["a@b.co"], subject: "Hi", body: "x" } }),
  } satisfies Record<string, Route>;

  it("runs research → decisions → review and stops before outreach", async () => {
    const { http, calls } = mockHttp(base);
    const r = await runDealWorkflow(http, "e2b.dev");
    const d = r.data as { steps: { id: string; status: string }[]; next: string };
    expect(d.steps.map((s) => [s.id, s.status])).toEqual([["research", "done"], ["decisions", "done"], ["review", "needs_approval"]]);
    expect(d.next).toBe("outreach");
    expect(calls.some((c) => c.url.startsWith("/api/outbound"))).toBe(false);
    expect(r.sources.length).toBeGreaterThan(0);
  });

  it("outreach only drafts and always needs approval; never sends", async () => {
    const { http, calls } = mockHttp(base);
    const r = await runDealWorkflow(http, "e2b.dev", { outreach: { to: ["a@b.co"], subject: "Hi", body: "x" } });
    const out = calls.find((c) => c.url === "/api/outbound/email");
    expect(out?.body).toMatchObject({ action: "draft" });
    expect(calls.some((c) => (c.body as { action?: string })?.action === "send")).toBe(false);
    expect((r.data as { steps: { id: string; status: string }[] }).steps.at(-1)).toMatchObject({ id: "outreach", status: "needs_approval" });
  });

  it("stops after a failed step", async () => {
    const { http, calls } = mockHttp({ ...base, "GET /api/live/research": () => json({ status: "no_match", domain: "e2b.dev" }) });
    const r = await runDealWorkflow(http, "e2b.dev");
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(1);
  });
});

describe("MCP server", () => {
  it("lists the ten tools and returns sources over the protocol", async () => {
    const { http } = mockHttp({ "GET /api/deals/e2b.dev/decisions": () => json(decisionsBody) });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer(http).connect(a);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(b);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["approve_review_item", "deal_workflow_act", "deal_workflow_get", "deal_workflow_list", "deal_workflow_start", "get_decisions", "list_review_queue", "research_company", "run_deal_workflow", "screen_companies"]);
    const res = await client.callTool({ name: "get_decisions", arguments: { domain: "e2b.dev" } });
    expect(res.isError).toBe(false);
    expect((res.structuredContent as { sources: unknown[] }).sources).toHaveLength(1);
    await client.close();
  });
});

describe("ten-step deal workflow tools", () => {
  const deal = { id: "d1a2b3c4", company: { name: "Acme", domain: "acme.test" }, stage: "diligence", updatedAt: "2026-10-31T08:00:00Z",
    steps: [{ id: "research", status: "done", facts: [{ label: "Headcount", value: "46", status: "verified", citation: cit("headcount.total") }] }, { id: "transcript", status: "waiting" }, { id: "dataroom", status: "done", draft: { to: ["a•••@acme.test"], subject: "s" } }] };
  it("start posts an /ask trigger with the normalized domain", async () => {
    const { http, calls } = mockHttp({ "POST /api/workflow": () => json({ id: "d1a2b3c4" }, 201) });
    const r = await startDealWorkflow(http, "https://www.Acme.test/", "Acme");
    expect(r).toMatchObject({ ok: true, data: { id: "d1a2b3c4" } });
    expect(calls[0]).toMatchObject({ method: "POST", url: "/api/workflow", body: { from: "ask", domain: "acme.test", name: "Acme" } });
    expect((await startDealWorkflow(http, "nope")).status).toBe(400);
  });
  it("list summarizes stage and the waiting step; get returns step facts with their citations", async () => {
    const { http } = mockHttp({ "GET /api/workflow": () => json({ deals: [deal], storage: { kind: "file", durable: false } }), "GET /api/workflow/d1a2b3c4": () => json(deal) });
    expect((await listDealWorkflows(http)).data).toMatchObject({ deals: [{ id: "d1a2b3c4", stage: "diligence", waiting: { id: "transcript", status: "waiting" } }], storage: { durable: false } });
    const g = await getDealWorkflow(http, "d1a2b3c4");
    expect(g.sources).toEqual([cit("headcount.total")]);
  });
  it("transcript and decide go to the action route; approve is a dry run without confirm + env gate", async () => {
    const { http, calls } = mockHttp({ "POST /api/workflow/d1a2b3c4": () => json({ ...deal, stage: "ic" }), "GET /api/workflow/d1a2b3c4": () => json(deal) });
    expect((await actOnDealWorkflow(http, "d1a2b3c4", { action: "transcript", text: "We are a team of 60." }, {})).ok).toBe(true);
    expect(calls.at(-1)).toMatchObject({ method: "POST", body: { action: "transcript", text: "We are a team of 60.", source: "paste" } });
    expect((await actOnDealWorkflow(http, "d1a2b3c4", { action: "decide", verdict: "maybe" as never }, {})).status).toBe(400);
    const n = calls.length;
    const dry = await actOnDealWorkflow(http, "d1a2b3c4", { action: "approve", step: "dataroom", confirm: true }, {});
    expect(dry.data).toMatchObject({ dryRun: true, reason: expect.stringMatching(/DEALDESK_ALLOW_APPROVE/), draft: { subject: "s" } });
    expect(calls.slice(n).every((c) => c.method === "GET")).toBe(true);
    await actOnDealWorkflow(http, "d1a2b3c4", { action: "approve", step: "dataroom", confirm: true }, { DEALDESK_ALLOW_APPROVE: "1" });
    expect(calls.at(-1)).toMatchObject({ method: "POST", body: { action: "approve", step: "dataroom" } });
  });
});

describe("failure handling", () => {
  it("run_deal_workflow rejects an unknown until instead of silently running the default", async () => {
    const { http, calls } = mockHttp({});
    const r = await runDealWorkflow(http, "e2b.dev", { until: "bogus" as never });
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
  it("run_deal_workflow marks decisions failed when the route returns none", async () => {
    const { http } = mockHttp({
      "GET /api/live/research": () => json({ status: "ok", domain: "e2b.dev" }),
      "GET /api/deals/e2b.dev/decisions": () => json({ dealId: "e2b.dev" }),
    });
    const r = await runDealWorkflow(http, "e2b.dev", { until: "decisions" });
    expect(r.ok).toBe(false);
    expect((r.data as { steps: { id: string; status: string }[] }).steps[1]).toMatchObject({ id: "decisions", status: "failed" });
  });
  it("screen_companies keeps the server's own error message from a non-NDJSON failure", async () => {
    const { http } = mockHttp({ "POST /api/live/screen": () => json({ status: "error", message: "bad query" }, 400) });
    const r = await screenCompanies(http, "seed fintech");
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r.data)).toContain("bad query");
  });
  it("deal_workflow_act transcript with no text is rejected before any request", async () => {
    const { http, calls } = mockHttp({});
    const r = await actOnDealWorkflow(http, "abcd1234", { action: "transcript", text: 5 as never });
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
