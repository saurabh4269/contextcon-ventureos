// The research agent loop: the model plans, calls Crustdata tools from the registry, checks results against the ask
// (re-querying or relaxing filters and saying so), then calls `submit_answer`. The server resolves every citation in
// that answer against the raw tool responses before anything is shown (see cite.ts) — values without a resolvable
// citation become "unavailable", mismatches are replaced by the Crustdata value and marked "corrected".
import type { CrustdataClient } from "@/lib/crustdata";
import { checkCell } from "./cite";
import { SUBMIT_TOOL, type AppliedFilter, type Citation, type LedgerCall, type ScreenCell, type ScreenEvent, type ScreenPerson, type ScreenResult, type ScreenRow, type ToolDef } from "./contract";
import type { AgentMessage, ModelClient, ToolSpec } from "./model";
import { creditsSpent, runTool, toolRegistry } from "./tools";

export type AgentOptions = {
  query: string;
  model: ModelClient;
  client: CrustdataClient;
  registry?: Map<string, ToolDef>;
  maxSteps?: number; // model turns
  creditCap?: number; // Crustdata credits for the whole run
  emit?: (e: ScreenEvent) => void;
  now?: () => Date;
  /** aborts the run between model turns and before each Crustdata call (the browser left: stop spending credits) */
  signal?: AbortSignal;
};

export const DEFAULT_MAX_STEPS = 14;
export const DEFAULT_CREDIT_CAP = 60;

const CITED = {
  type: "object",
  properties: {
    value: { type: ["string", "number", "boolean", "null"] },
    ref: { type: "string", description: "Tool call ref, e.g. c2" },
    path: { type: "string", description: "JSON path inside that call's `response`, e.g. companies[3].headcount.growth_percent.6m" },
  },
  required: ["value"],
};

export const SUBMIT_SPEC: ToolSpec = {
  name: SUBMIT_TOOL,
  description: "Submit the final ranked answer. Call exactly once, at the end. Every value must cite the tool call ref and JSON path it was read from; use value null when Crustdata has no data.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "2-4 sentences: what was found, how it was ranked, and any relaxation or gaps." },
      requested: { type: "integer", description: "How many results the user asked for, if stated." },
      columns: { type: "array", items: { type: "object", properties: { key: { type: "string" }, label: { type: "string" } }, required: ["key", "label"] }, description: "Columns besides the name, e.g. founded, hq, headcount, growth_6m." },
      filters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            requirement: { type: "string" },
            applied: { type: "string", enum: ["server", "client", "unavailable"] },
            field: { type: "string" },
            detail: { type: "string" },
            relaxed: { type: "string", description: "Only when this requirement was relaxed: what changed and why. Omit otherwise." },
          },
          required: ["requirement", "applied", "detail"],
        },
      },
      rows: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: CITED,
            why: { type: "string" },
            cells: { type: "array", items: { ...CITED, properties: { key: { type: "string" }, ...CITED.properties }, required: ["key", "value"] } },
            people: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: CITED,
                  title: CITED,
                  linkedin: CITED,
                  prior: { type: "array", items: { type: "object", properties: { company: CITED, title: CITED, period: { type: "string" } }, required: ["company", "title"] } },
                },
                required: ["name", "title", "prior"],
              },
            },
            people_note: { type: "string" },
          },
          required: ["name", "cells", "people"],
        },
      },
      caveats: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "columns", "filters", "rows"],
  },
};

export function systemPrompt(today: string, creditCap: number, maxSteps: number) {
  return `You are Deal Desk's research agent for venture capital and banking teams. You answer screening and research requests with real data from Crustdata, through the tools provided. Today is ${today}.

How to work:
1. Plan first: in one short paragraph, restate the ask as concrete requirements (geography, industry, founded years, size, growth over a window, count, which fields/people to return) and map each to a Crustdata field. Prefer native server-side filters (e.g. locations.country, basic_info.year_founded, headcount.growth_percent.6m, taxonomy.professional_network_industry). Use search_query (hybrid ranking) only for concepts with no field (e.g. "B2B"), and then verify those client-side from the returned data (description, industry, categories).
2. Execute: fetch more candidates than requested (about 2-3x, within credit limits) so client-side checks can drop non-matches. Return only the field groups you need.
3. Verify against the ask: check every returned row against every requirement. If there are fewer matches than requested, re-query: relax the narrowest constraint one step at a time (e.g. growth threshold, industry wording) and record exactly what you relaxed and why. Never pad results with rows that fail a hard requirement — return fewer and say so.
4. People: when the ask needs founders/executives, use search_people once for all shortlisted companies (experience.employment_details.current.company_id "in" [ids] plus a title condition), returning basic_profile and experience. Prior roles come from experience.employment_details.past (company name + title). LinkedIn URLs are at social_handles.professional_network_identifier.profile_url (request the social_handles field if you want to show them).
5. Before each tool call, say in one sentence what you are doing and why. After results, say in one sentence what you learned (counts, gaps) and what's next.
6. Finish by calling ${SUBMIT_TOOL} once. Rank rows by fit to the ask (strongest signal first). For every value give {value, ref, path}: ref is the tool call ref (c1, c2 …) and path is the JSON path inside that call's "response" (e.g. companies[0].basic_info.year_founded, profiles[2].experience.employment_details.past[0].title). The server checks every citation; uncited values are dropped. If data is missing, use value null — never guess. In filters, mark each requirement applied "server" (Crustdata filter), "client" (you checked the returned data) or "unavailable" (could not be checked), with the field and detail.

Notes: headcount.growth_percent.* values are percentages (50 means +50%). "Grew by half" = +50%. locations.country accepts ISO alpha-3 (IND, USA, GBR, DEU …). Growth fields are filterable but not sortable. Budget: at most ${creditCap} Crustdata credits and ${maxSteps} turns for the whole request; every tool result reports credits used and remaining. Company search costs about 0.03 credits/row plus ~0.2/row for each of headcount, funding, locations and 0.1/row for taxonomy (≈0.5/row with the usual groups), so request only the fields you need, keep limit ≤ 25, and reserve credits for people lookups (≈0.23/row with experience). Cap people lookups to about 3 per requested company.`;
}

type Cited = { value?: unknown; ref?: string; path?: string } | null | undefined;
type SubmitInput = {
  summary?: string;
  requested?: number;
  columns?: { key: string; label: string }[];
  filters?: AppliedFilter[];
  rows?: { name?: Cited; why?: string; cells?: ({ key?: string } & NonNullable<Cited>)[]; people?: { name?: Cited; title?: Cited; linkedin?: Cited; prior?: { company?: Cited; title?: Cited; period?: string }[] }[]; people_note?: string }[];
  caveats?: string[];
};

/** Models fill "relaxed" with "None"/"n/a" for untouched requirements; only a real description counts. */
const isRelaxed = (v: unknown) => typeof v === "string" && v.trim() !== "" && !/^\s*(none|no|n\/a|na|not relaxed|-)(\b|[.;,]|$)/i.test(v);

const scalar = (v: unknown): ScreenCell["value"] => (v == null ? null : typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? v : JSON.stringify(v).slice(0, 200));

/** Resolve one cited value against the ledger + raw responses. */
export function verifyCell(key: string, label: string, c: Cited, ledger: LedgerCall[], raw: Map<string, unknown>): ScreenCell {
  if (!c || c.value === undefined) return { key, label, value: null, status: "unavailable", reason: "Not provided." };
  const call = c.ref ? ledger.find((l) => l.ref === c.ref && l.status === "ok") : undefined;
  if (!call) {
    if (c.value == null) return { key, label, value: null, status: "unavailable", reason: "Crustdata had no data for this." };
    return { key, label, value: null, status: "unavailable", claimed: c.value, reason: c.ref ? `Cited call ${c.ref} does not exist or failed.` : "No citation was given, so the value is not shown." };
  }
  const citation: Citation = { ref: call.ref, method: call.method, endpoint: call.path, path: c.path ?? "", retrievedAt: call.retrievedAt };
  const r = checkCell(c.value, raw.get(call.ref), c.path);
  if (r.status === "unavailable") return { key, label, value: null, status: "unavailable", citation, reason: r.reason, ...(c.value != null ? { claimed: c.value } : {}) };
  if (r.status === "corrected") return { key, label, value: scalar(r.value), status: "corrected", citation, claimed: r.claimed };
  return { key, label, value: scalar(r.value), status: "verified", citation };
}

/** Turn the model's submit_answer input into a verified result body (without run metadata). */
export function verifyAnswer(input: SubmitInput, ledger: LedgerCall[], raw: Map<string, unknown>) {
  const columns = (input.columns ?? []).filter((c) => c?.key).map((c) => ({ key: String(c.key), label: String(c.label ?? c.key) }));
  const v = (key: string, label: string, c: Cited) => verifyCell(key, label, c, ledger, raw);
  const rows: ScreenRow[] = (input.rows ?? []).map((r, i) => {
    const byKey = new Map((r.cells ?? []).filter((c) => c?.key).map((c) => [String(c.key), c]));
    const people: ScreenPerson[] = (r.people ?? []).map((p) => ({
      name: v("name", "Name", p.name),
      title: v("title", "Title", p.title),
      ...(p.linkedin ? { linkedin: v("linkedin", "LinkedIn", p.linkedin) } : {}),
      prior: (p.prior ?? []).map((pr) => ({ company: v("company", "Company", pr.company), title: v("title", "Title", pr.title), ...(pr.period ? { period: pr.period } : {}) })),
    }));
    return {
      rank: i + 1,
      name: v("name", "Name", r.name),
      cells: columns.map((col) => v(col.key, col.label, byKey.get(col.key))),
      people,
      ...(r.people_note ? { peopleNote: r.people_note } : {}),
      ...(r.why ? { why: r.why } : {}),
    };
  });
  const all = rows.flatMap((r) => [r.name, ...r.cells, ...r.people.flatMap((p) => [p.name, p.title, ...(p.linkedin ? [p.linkedin] : []), ...p.prior.flatMap((x) => [x.company, x.title])])]);
  const citationStats = { verified: all.filter((c) => c.status === "verified").length, corrected: all.filter((c) => c.status === "corrected").length, unavailable: all.filter((c) => c.status === "unavailable").length };
  const filters: AppliedFilter[] = (input.filters ?? [])
    .filter((f) => f?.requirement)
    .map((f) => ({ requirement: String(f.requirement), applied: (["server", "client", "unavailable"] as const).includes(f.applied) ? f.applied : "unavailable", ...(f.field ? { field: String(f.field) } : {}), detail: String(f.detail ?? ""), ...(isRelaxed(f.relaxed) ? { relaxed: String(f.relaxed) } : {}) }));
  return { summary: String(input.summary ?? ""), columns, rows, filters, caveats: (input.caveats ?? []).map(String), citationStats, ...(typeof input.requested === "number" ? { requested: input.requested } : {}) };
}

/** Run the agent to completion. Throws only on model API errors (the caller maps them to an error event). */
export async function runScreenAgent(opts: AgentOptions): Promise<ScreenResult> {
  const { query, model, client } = opts;
  const emit = opts.emit ?? (() => {});
  const registry = opts.registry ?? toolRegistry();
  const maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS;
  const creditCap = opts.creditCap ?? DEFAULT_CREDIT_CAP;
  const now = opts.now ?? (() => new Date());
  const t0 = Date.now();
  let modelMs = 0, toolMs = 0, steps = 0;
  const ctx = { client, ledger: [] as LedgerCall[], raw: new Map<string, unknown>(), creditCap };
  const tools = [...[...registry.values()].map((t) => t.spec), SUBMIT_SPEC];
  const system = systemPrompt(now().toISOString().slice(0, 10), creditCap, maxSteps);
  const messages: AgentMessage[] = [{ role: "user", text: query }];
  const meta = { provider: model.provider, model: model.model };
  emit({ type: "start", query, model: meta, at: now().toISOString() });

  const finish = (status: ScreenResult["status"], body: ReturnType<typeof verifyAnswer>): ScreenResult => ({
    status,
    query,
    ...body,
    model: meta,
    calls: ctx.ledger,
    credits: { used: creditsSpent(ctx.ledger), cap: creditCap },
    timings: { totalMs: Date.now() - t0, modelMs, toolMs },
    steps,
  });

  const stopped = () => opts.signal?.aborted === true;
  let nudged = 0;
  while (steps < maxSteps && !stopped()) {
    steps++;
    if (steps === maxSteps) messages.push({ role: "user", text: `This is your last turn: call ${SUBMIT_TOOL} now with what you have (null for anything missing).` });
    emit({ type: "thinking", step: steps });
    const tm = Date.now();
    const turn = await model.complete({ system, messages, tools });
    modelMs += Date.now() - tm;
    messages.push({ role: "assistant", text: turn.text, toolCalls: turn.toolCalls, raw: turn.raw });
    if (turn.text) emit({ type: "plan", step: steps, text: turn.text });

    if (!turn.toolCalls.length) {
      if (nudged++ >= 1) break;
      messages.push({ role: "user", text: `Continue the work, and finish by calling ${SUBMIT_TOOL} with cited values.` });
      continue;
    }

    const results: { id: string; content: string; isError?: boolean }[] = [];
    for (const call of turn.toolCalls) {
      if (stopped()) break;
      if (call.name === SUBMIT_TOOL) {
        const body = verifyAnswer(call.input as SubmitInput, ctx.ledger, ctx.raw);
        if (!body.rows.length && !body.summary) {
          results.push({ id: call.id, content: "submit_answer needs a summary and rows (rows may be empty if nothing matched — then say so in the summary).", isError: true });
          continue;
        }
        const s = body.citationStats;
        emit({ type: "verify", text: `Checked ${s.verified + s.corrected + s.unavailable} cited values against the Crustdata responses: ${s.verified} verified, ${s.corrected} corrected, ${s.unavailable} unavailable.`, stats: s });
        const result = finish("ok", body);
        emit({ type: "final", result });
        return result;
      }
      const est = registry.get(call.name)?.estimateCredits(call.input) ?? 0;
      const ref = `c${ctx.ledger.length + 1}`;
      emit({ type: "tool_call", step: steps, ref, tool: call.name, endpoint: endpointOf(call.name), input: call.input, estCredits: est });
      const tt = Date.now();
      const r = await runTool(ctx, registry, call.name, call.input);
      toolMs += Date.now() - tt;
      const l = r.ref ? ctx.ledger.find((x) => x.ref === r.ref) : undefined;
      emit({ type: "tool_result", step: steps, ref: r.ref ?? ref, tool: call.name, status: l?.status ?? "error", rows: l?.rows, totalCount: l?.totalCount, creditsUsed: l?.creditsUsed ?? null, ms: l?.ms ?? Date.now() - tt, ...(l?.key ? { key: l.key } : {}), ...(r.isError ? { error: r.content.slice(0, 300) } : {}) });
      results.push({ id: call.id, content: r.content, ...(r.isError ? { isError: true } : {}) });
    }
    messages.push({ role: "tool", results });
  }

  const result = finish("incomplete", {
    summary: stopped() ? `Stopped after ${steps} model turns: the client disconnected.` : `Stopped after ${steps} model turns without a final answer.`,
    columns: [],
    rows: [],
    filters: [],
    caveats: [stopped() ? "The client disconnected, so the run was stopped before an answer; the tool calls it made are listed." : `The agent hit its step limit (${maxSteps}) or stopped before submitting an answer; the tool calls it made are listed.`],
    citationStats: { verified: 0, corrected: 0, unavailable: 0 },
  });
  emit({ type: "final", result });
  return result;
}

const ENDPOINTS: Record<string, string> = {
  search_companies: "POST /company/search",
  search_people: "POST /person/search",
  enrich_companies: "POST /company/enrich",
  enrich_person: "POST /person/enrich",
  identify_company: "POST /company/identify",
  company_signals: "POST /company/enrich",
  find_founders: "POST /person/search",
  search_jobs: "POST /job/search",
  web_search: "POST /web/search/live",
};
const endpointOf = (tool: string) => ENDPOINTS[tool] ?? tool;
