// Tool handlers shared by the MCP server (src/mcp/server.ts) and the `dealdesk` CLI (src/cli/index.ts).
// Each handler calls an existing Deal Desk route and returns { ok, tool, data, sources }. `sources` is collected from
// the route's own citations (ComputedField.citations, ScreenCell.citation, review evidence); nothing is computed here.
import { DealDeskHttp } from "./http";

export type Source = { endpoint: string; path?: string; source?: string; url?: string; retrievedAt?: string | null };
export type ToolResult = { ok: boolean; tool: string; status: number; data: unknown; sources: Source[]; note?: string };

const DOMAIN = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
export function normalizeDomain(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const d = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  return DOMAIN.test(d) ? d : null;
}

/** Every citation in a route response, deduped by endpoint + path. */
export function collectSources(body: unknown): Source[] {
  const out = new Map<string, Source>();
  const add = (c: unknown) => {
    if (!c || typeof c !== "object") return;
    const o = c as Record<string, unknown>;
    const endpoint = typeof o.endpoint === "string" ? o.endpoint : null;
    if (!endpoint) return;
    const s: Source = { endpoint };
    if (typeof o.path === "string") s.path = o.path;
    if (typeof o.source === "string") s.source = o.source;
    if (typeof o.url === "string") s.url = o.url;
    if (typeof o.retrievedAt === "string" || o.retrievedAt === null) s.retrievedAt = o.retrievedAt as string | null;
    const k = `${s.endpoint}|${s.path ?? ""}|${s.url ?? ""}`;
    if (!out.has(k)) out.set(k, s);
  };
  const walk = (v: unknown, depth: number) => {
    if (!v || typeof v !== "object" || depth > 12) return;
    if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (k === "citations" && Array.isArray(x)) x.forEach(add);
      else if (k === "citation") add(x);
      else walk(x, depth + 1);
    }
  };
  walk(body, 0);
  return [...out.values()];
}

const result = (tool: string, r: { ok: boolean; status: number; body: unknown }, extra: Partial<ToolResult> = {}): ToolResult =>
  ({ ok: r.ok, tool, status: r.status, data: r.body, sources: collectSources(r.body), ...extra });
const bad = (tool: string, message: string): ToolResult => ({ ok: false, tool, status: 400, data: { status: "error", message }, sources: [] });

/** screen_companies: plain-English request → cited shortlist (POST /api/live/screen, the /ask research agent). */
export async function screenCompanies(http: DealDeskHttp, request: string, onEvent?: (e: Record<string, unknown>) => void): Promise<ToolResult> {
  const query = typeof request === "string" ? request.trim() : "";
  if (!query || query.length > 2000) return bad("screen_companies", "request must be 1..2000 characters of plain English");
  const r = await http.ndjson("/api/live/screen", { query }, onEvent);
  const final = r.events.find((e) => e.type === "final") as { result?: unknown } | undefined;
  const failure = r.events.find((e) => e.type === "error" || e.type === "model_unavailable");
  if (final?.result) return { ok: true, tool: "screen_companies", status: r.status, data: final.result, sources: collectSources(final.result) };
  return { ok: false, tool: "screen_companies", status: r.status, data: failure ?? { type: "error", message: "the research agent returned no final result" }, sources: [],
    note: failure?.type === "model_unavailable" ? "No model key on the server: the deterministic Sourcing agent (/agent) is the fallback." : undefined };
}

/** research_company: domain → cited profile (GET /api/live/research). */
export async function researchCompany(http: DealDeskHttp, domain: string): Promise<ToolResult> {
  const d = normalizeDomain(domain);
  if (!d) return bad("research_company", "domain must be a company domain, e.g. e2b.dev");
  return result("research_company", await http.json("GET", `/api/live/research?domain=${encodeURIComponent(d)}`));
}

/** get_decisions: domain → fit score, verdict, valuation, memo fields (GET /api/deals/:id/decisions). Each decision is a
 *  ComputedField: ok with citations, or unavailable with its reason. `review=false` reads without raising review items. */
export async function getDecisions(http: DealDeskHttp, domain: string, opts: { review?: boolean } = {}): Promise<ToolResult> {
  const d = normalizeDomain(domain);
  if (!d) return bad("get_decisions", "domain must be a company domain, e.g. e2b.dev");
  const q = opts.review === false ? "?review=0" : "";
  const r = await http.json("GET", `/api/deals/${encodeURIComponent(d)}/decisions${q}`);
  const decisions = (r.body as { decisions?: Record<string, unknown> } | null)?.decisions;
  if (!r.ok || !decisions) return result("get_decisions", r);
  const summary = Object.fromEntries(Object.entries(decisions).map(([k, f]) => {
    const v = f as { status?: string; value?: unknown; reason?: string; citations?: unknown[] };
    return [k, v.status === "ok" ? { status: "ok", value: v.value, sources: collectSources({ citations: v.citations }) } : { status: "unavailable", reason: v.reason ?? "no reason given" }];
  }));
  return { ...result("get_decisions", r), data: { ...(r.body as object), summary } };
}

export type ReviewItem = { id: string; kind: string; title: string; reason: string; status: string; runId: string | null; subject?: { name: string; domain?: string }; proposed?: { label: string; value: unknown }; actions?: Record<string, string> };

/** list_review_queue: GET /api/exceptions (status open by default, optional run filter). */
export async function listReviewQueue(http: DealDeskHttp, opts: { status?: "open" | "all"; run?: string } = {}): Promise<ToolResult> {
  const p = new URLSearchParams({ status: opts.status ?? "open" });
  if (opts.run) p.set("run", opts.run);
  return result("list_review_queue", await http.json("GET", `/api/exceptions?${p}`));
}

/** approve_review_item. Dry run by default: shows the item and what Approve would do, changes nothing. It really
 *  approves (POST /api/exceptions/:id) only when `confirm` is true AND DEALDESK_ALLOW_APPROVE=1 is set for this
 *  process. Outbound items stay dry-run on the server regardless (the review route never sends; real sends need
 *  OUTBOUND_MODE=live + DEMO_RECIPIENT_ALLOWLIST + a single-use approval token from the UI). */
export async function approveReviewItem(http: DealDeskHttp, id: string, opts: { confirm?: boolean; note?: string } = {}, env: Record<string, string | undefined> = process.env): Promise<ToolResult> {
  if (typeof id !== "string" || !/^[\w:.-]{1,200}$/.test(id)) return bad("approve_review_item", "id must be a review item id from list_review_queue");
  const list = await http.json("GET", "/api/exceptions?status=all");
  if (!list.ok) return result("approve_review_item", list);
  const item = ((list.body as { items?: ReviewItem[] })?.items ?? []).find((i) => i.id === id);
  if (!item) return { ok: false, tool: "approve_review_item", status: 404, data: { status: "error", message: `no review item ${id}` }, sources: [] };
  const allowed = env.DEALDESK_ALLOW_APPROVE?.trim() === "1";
  if (!opts.confirm || !allowed || item.status !== "open") {
    const why = item.status !== "open" ? `already ${item.status}` : !opts.confirm ? "dry run (pass confirm to approve)" : "DEALDESK_ALLOW_APPROVE=1 is not set for this process";
    return { ok: true, tool: "approve_review_item", status: 200, data: { dryRun: true, reason: why, item, wouldDo: item.actions?.approve ?? "approve", proposed: item.proposed ?? null }, sources: collectSources(item) };
  }
  return result("approve_review_item", await http.json("POST", `/api/exceptions/${encodeURIComponent(id)}`, { action: "approve", note: opts.note ?? "Approved via Deal Desk MCP/CLI" }));
}

export type WorkflowStep = { id: "research" | "decisions" | "review" | "outreach"; status: "done" | "failed" | "needs_approval" | "pending"; detail: string; endpoint: string };
export const WORKFLOW_STEPS: WorkflowStep["id"][] = ["research", "decisions", "review", "outreach"];

/** run_deal_workflow: research → decisions (raises review items) → open review items for the deal → outreach draft.
 *  `until` stops after that step (default "review"). The outreach step only asks the server for a preview
 *  (POST /api/outbound/email action "draft", which is dry-run unless the server is live); it never sends, and it
 *  always comes back as needs_approval. */
export async function runDealWorkflow(http: DealDeskHttp, domain: string, opts: { until?: WorkflowStep["id"]; outreach?: { to: string[]; subject: string; body: string } } = {}): Promise<ToolResult> {
  const d = normalizeDomain(domain);
  if (!d) return bad("run_deal_workflow", "domain must be a company domain, e.g. e2b.dev");
  const until = opts.until && WORKFLOW_STEPS.includes(opts.until) ? opts.until : opts.outreach ? "outreach" : "review";
  const stop = WORKFLOW_STEPS.indexOf(until);
  const steps: WorkflowStep[] = [];
  const data: Record<string, unknown> = {};
  const sources: Source[] = [];
  const run = (i: number) => i <= stop && steps.every((s) => s.status !== "failed");

  if (run(0)) {
    const r = await researchCompany(http, d);
    data.research = r.data; sources.push(...r.sources);
    const st = (r.data as { status?: string })?.status;
    steps.push({ id: "research", endpoint: `GET /api/live/research?domain=${d}`, status: r.ok && st === "ok" ? "done" : "failed", detail: r.ok && st === "ok" ? `${r.sources.length} cited sources` : `${st ?? "error"} (HTTP ${r.status})` });
  }
  if (run(1)) {
    const r = await getDecisions(http, d);
    data.decisions = (r.data as { summary?: unknown })?.summary ?? r.data; sources.push(...r.sources);
    const sum = (r.data as { summary?: Record<string, { status: string }> })?.summary ?? {};
    const okN = Object.values(sum).filter((s) => s.status === "ok").length;
    steps.push({ id: "decisions", endpoint: `GET /api/deals/${d}/decisions`, status: r.ok ? "done" : "failed", detail: r.ok ? `${okN}/${Object.keys(sum).length} decisions cited, the rest unavailable with reasons` : `HTTP ${r.status}` });
  }
  if (run(2)) {
    const r = await listReviewQueue(http, { status: "open", run: `deal:${d}:decisions` });
    const items = (r.data as { items?: ReviewItem[] })?.items ?? [];
    data.review = items.map((i) => ({ id: i.id, kind: i.kind, title: i.title, reason: i.reason }));
    sources.push(...r.sources);
    steps.push({ id: "review", endpoint: `GET /api/exceptions?run=deal:${d}:decisions`, status: !r.ok ? "failed" : items.length ? "needs_approval" : "done", detail: !r.ok ? `HTTP ${r.status}` : `${items.length} open review item(s) for a person` });
  }
  if (run(3)) {
    if (!opts.outreach) steps.push({ id: "outreach", endpoint: "POST /api/outbound/email", status: "pending", detail: "needs a draft (to, subject, body) to preview; nothing is sent" });
    else {
      const r = await http.json("POST", "/api/outbound/email", { action: "draft", ...opts.outreach });
      const body = r.body as { transport?: string; wouldSend?: unknown; message?: string } | null;
      data.outreach = { draft: body?.wouldSend ?? opts.outreach, transport: body?.transport ?? null, server: r.ok ? undefined : body, requiresApproval: true };
      steps.push({ id: "outreach", endpoint: "POST /api/outbound/email (draft)", status: r.ok ? "needs_approval" : "failed", detail: r.ok ? "draft ready; a person approves the send in the Deal Desk UI" : body?.message ?? `HTTP ${r.status}` });
    }
  }
  const next = WORKFLOW_STEPS[stop + 1] ?? null;
  const uniq = [...new Map(sources.map((s) => [`${s.endpoint}|${s.path ?? ""}|${s.url ?? ""}`, s])).values()];
  return { ok: steps.every((s) => s.status !== "failed"), tool: "run_deal_workflow", status: 200, data: { domain: d, steps, next, ...data }, sources: uniq };
}

/* ───────── the ten-step deal workflow (/workflow, POST /api/workflow) ───────── */

const DEAL_ID = /^[a-z0-9-]{4,40}$/i;
export const DEAL_ACTIONS = ["approve", "transcript", "skip_transcript", "override_screen", "decide", "regenerate_memo", "resume"] as const;
export type DealAction = (typeof DEAL_ACTIONS)[number];

/** deal_workflow_start: start the ten-step workflow for a company domain (POST /api/workflow {from:"ask"}). */
export async function startDealWorkflow(http: DealDeskHttp, domain: string, name?: string): Promise<ToolResult> {
  const d = normalizeDomain(domain);
  if (!d) return bad("deal_workflow_start", "domain must be a company domain, e.g. e2b.dev");
  const r = await http.json("POST", "/api/workflow", { from: "ask", domain: d, ...(name?.trim() ? { name: name.trim().slice(0, 120) } : {}) });
  const id = (r.body as { id?: string } | null)?.id;
  return { ...result("deal_workflow_start", r), ...(id ? { note: `Started. Poll deal_workflow_get with id ${id}; open /workflow?id=${id} in Deal Desk.` } : {}) };
}

/** deal_workflow_list: every deal in the workflow store with its stage and the step that waits (GET /api/workflow). */
export async function listDealWorkflows(http: DealDeskHttp): Promise<ToolResult> {
  const r = await http.json("GET", "/api/workflow");
  if (!r.ok) return result("deal_workflow_list", r);
  const deals = ((r.body as { deals?: { id: string; company: { name?: string; domain?: string }; stage: string; steps: { id: string; status: string }[]; updatedAt: string }[] } | null)?.deals ?? []);
  const summary = deals.map((d) => ({ id: d.id, company: d.company.name ?? d.company.domain, domain: d.company.domain, stage: d.stage, waiting: d.steps.find((s) => ["waiting", "running", "error"].includes(s.status)) ?? null, updatedAt: d.updatedAt }));
  return { ...result("deal_workflow_list", r), data: { deals: summary, storage: (r.body as { storage?: unknown } | null)?.storage ?? null } };
}

/** deal_workflow_get: one deal's ten steps, facts and citations (GET /api/workflow/:id). */
export async function getDealWorkflow(http: DealDeskHttp, id: string): Promise<ToolResult> {
  if (typeof id !== "string" || !DEAL_ID.test(id)) return bad("deal_workflow_get", "id must be a deal id from deal_workflow_list");
  return result("deal_workflow_get", await http.json("GET", `/api/workflow/${encodeURIComponent(id)}`));
}

/** deal_workflow_act: a person's action on a deal. Everything but approve goes straight to POST /api/workflow/:id.
 *  approve (data-room email / calendar draft) is a dry run here unless `confirm` AND DEALDESK_ALLOW_APPROVE=1; even
 *  then the server records a dry run unless OUTBOUND_MODE=live and every recipient is on DEMO_RECIPIENT_ALLOWLIST. */
export async function actOnDealWorkflow(
  http: DealDeskHttp,
  id: string,
  a: { action: DealAction; step?: "dataroom" | "schedule"; text?: string; verdict?: "invest" | "pass"; note?: string; confirm?: boolean },
  env: Record<string, string | undefined> = process.env,
): Promise<ToolResult> {
  if (typeof id !== "string" || !DEAL_ID.test(id)) return bad("deal_workflow_act", "id must be a deal id from deal_workflow_list");
  if (!DEAL_ACTIONS.includes(a.action)) return bad("deal_workflow_act", `action must be one of ${DEAL_ACTIONS.join(", ")}`);
  if (a.action === "approve") {
    if (a.step !== "dataroom" && a.step !== "schedule") return bad("deal_workflow_act", 'approve needs step "dataroom" or "schedule"');
    if (!a.confirm || env.DEALDESK_ALLOW_APPROVE?.trim() !== "1") {
      const deal = await http.json("GET", `/api/workflow/${encodeURIComponent(id)}`);
      const draft = ((deal.body as { steps?: { id: string; draft?: unknown }[] } | null)?.steps ?? []).find((s) => s.id === a.step)?.draft ?? null;
      return { ok: deal.ok, tool: "deal_workflow_act", status: deal.status, data: { dryRun: true, reason: !a.confirm ? "dry run (pass confirm to approve)" : "DEALDESK_ALLOW_APPROVE=1 is not set for this process", draft }, sources: [] };
    }
  }
  if (a.action === "transcript" && !a.text?.trim()) return bad("deal_workflow_act", "transcript needs text");
  if (a.action === "decide" && a.verdict !== "invest" && a.verdict !== "pass") return bad("deal_workflow_act", 'decide needs verdict "invest" or "pass"');
  const body = { action: a.action, ...(a.step ? { step: a.step } : {}), ...(a.text ? { text: a.text, source: "paste" } : {}), ...(a.verdict ? { verdict: a.verdict } : {}), ...(a.note ? { note: a.note } : {}) };
  return result("deal_workflow_act", await http.json("POST", `/api/workflow/${encodeURIComponent(id)}`, body));
}
