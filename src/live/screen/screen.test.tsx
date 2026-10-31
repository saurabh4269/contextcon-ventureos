// Screening agent UI with a mocked NDJSON stream: reducer/runner semantics and server-rendered views for the live
// timeline, the cited result (table + cards), and the honest failure states. Fixtures here are test-only.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ScreenCell, ScreenEvent, ScreenResult, ScreenRow } from "@/lib/agent/contract";
import { initialScreen, reduceScreen, runScreen, type ScreenState } from "./state";
import { ScreenRun } from "./views";
import { AskBody } from "../ask";

const enc = new TextEncoder();
/** A Response whose body streams the given NDJSON chunks (split arbitrarily, to exercise line buffering). */
function streamResponse(chunks: string[], init: ResponseInit = { status: 200 }) {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
  return new Response(body, init);
}
const ndjson = (evs: ScreenEvent[]) => evs.map((e) => JSON.stringify(e) + "\n").join("");
const mockFetch = (res: Response | (() => Promise<Response>)) => (async () => (typeof res === "function" ? res() : res)) as unknown as typeof fetch;

async function run(fetchImpl: typeof fetch, query = "q") {
  const events: ScreenEvent[] = [];
  await runScreen(query, (e) => events.push(e), { fetch: fetchImpl });
  return { events, state: events.reduce(reduceScreen, initialScreen(query)) };
}
const html = (s: ScreenState) => renderToStaticMarkup(<ScreenRun state={s} />);

const cite = (ref: string, path: string) => ({ ref, method: "POST" as const, endpoint: "/company/search", path, retrievedAt: "2026-10-31T07:00:00Z" });
const cell = (key: string, label: string, value: ScreenCell["value"], status: ScreenCell["status"] = "verified", ref = "c1", extra: Partial<ScreenCell> = {}): ScreenCell => ({ key, label, value, status, citation: status === "unavailable" ? undefined : cite(ref, `companies[0].${key}`), ...extra });

const rowA: ScreenRow = {
  rank: 1,
  name: cell("name", "Company", "Acme Cloud"),
  cells: [cell("founded", "Founded", 2023), cell("growth", "Headcount growth (6m)", "62%", "corrected", "c2", { claimed: "55%" }), cell("hq", "HQ", null, "unavailable", "c1", { reason: "not on Crustdata" })],
  people: [
    { name: cell("p0", "Founder", "Asha Rao", "verified", "c3"), title: cell("t0", "Title", "Co-founder & CEO", "verified", "c3"), prior: [{ company: cell("pc", "Company", "Freshworks", "verified", "c3"), title: cell("pt", "Title", "Director of Product", "verified", "c3"), period: "2018–2022" }] },
    { name: cell("p1", "Founder", "Vikram S", "verified", "c3"), title: cell("t1", "Title", "Co-founder & CTO", "verified", "c3"), prior: [] },
  ],
  why: "Founded 2023, team grew well past half",
};
const rowB: ScreenRow = { rank: 2, name: cell("name", "Company", "Beta Labs"), cells: [cell("founded", "Founded", 2024), cell("growth", "Headcount growth (6m)", "51%"), cell("hq", "HQ", "Pune")], people: [], peopleNote: "No founders found on Crustdata for this company" };

const result = (over: Partial<ScreenResult> = {}): ScreenResult => ({
  status: "ok",
  query: "Find ten Indian B2B software companies",
  summary: "Two companies met every requirement.",
  columns: [{ key: "founded", label: "Founded" }, { key: "growth", label: "Headcount growth (6m)" }, { key: "hq", label: "HQ" }],
  rows: [rowA, rowB],
  filters: [
    { requirement: "Based in India", applied: "server", field: "locations.country", detail: "= India" },
    { requirement: "Team grew by half", applied: "client", field: "headcount.growth_6m", detail: "checked ≥ 0.5 per result", relaxed: "widened from 6 to 9 months: too few results" },
    { requirement: "B2B", applied: "unavailable", detail: "No B2B field on Crustdata" },
  ],
  caveats: ["Headcount growth is from LinkedIn employee counts."],
  requested: 10,
  model: { provider: "openai", model: "gpt-6.1-sol" },
  calls: [
    { ref: "c1", tool: "company_search", method: "POST", path: "/company/search", body: {}, status: "ok", creditsUsed: 3, creditsEstimated: 3, retrievedAt: "2026-10-31T07:00:00Z", cached: false, ms: 840, rows: 25, totalCount: 120 },
    { ref: "c2", tool: "company_enrich", method: "POST", path: "/company/enrich", body: {}, status: "error", creditsUsed: null, creditsEstimated: 2, retrievedAt: null, cached: false, ms: 120, error: "upstream 500" },
  ],
  credits: { used: 9, cap: 50 },
  timings: { totalMs: 21000, modelMs: 15000, toolMs: 6000 },
  steps: 6,
  citationStats: { verified: 12, corrected: 1, unavailable: 1 },
  ...over,
});

const start: ScreenEvent = { type: "start", query: "Find ten Indian B2B software companies", model: { provider: "openai", model: "gpt-6.1-sol" }, at: "2026-10-31T07:00:00Z" };
const midRun: ScreenEvent[] = [
  start,
  { type: "thinking", step: 1 },
  { type: "plan", step: 1, text: "Search Indian software companies founded since 2023, then check headcount growth." },
  { type: "tool_call", step: 1, ref: "c1", tool: "company_search", endpoint: "POST /company/search", input: { filters: [{ field: "country", value: "IND" }] }, estCredits: 3 },
  { type: "tool_result", step: 1, ref: "c1", tool: "company_search", status: "ok", rows: 25, totalCount: 120, creditsUsed: 3, ms: 840 },
  { type: "tool_call", step: 2, ref: "c2", tool: "company_enrich", endpoint: "POST /company/enrich", input: {}, estCredits: 2 },
];

describe("runScreen + reduceScreen (mocked stream)", () => {
  it("streams plan and tool steps live, then the final result", async () => {
    const all = ndjson([...midRun, { type: "tool_result", step: 2, ref: "c2", tool: "company_enrich", status: "error", creditsUsed: null, ms: 120, error: "upstream 500" }, { type: "verify", text: "Checked citations", stats: { verified: 12, corrected: 1, unavailable: 1 } }, { type: "final", result: result() }]);
    // split mid-line to exercise buffering
    const cut = [all.slice(0, 37), all.slice(37, 400), all.slice(400)];
    const { events, state } = await run(mockFetch(streamResponse(cut)));
    expect(events.map((e) => e.type)).toEqual(["start", "thinking", "plan", "tool_call", "tool_result", "tool_call", "tool_result", "verify", "final"]);
    expect(state.phase).toBe("done");
    expect(state.timeline.map((t) => t.kind)).toEqual(["plan", "tool", "tool", "verify"]);
    const c2 = state.timeline[2];
    expect(c2.kind === "tool" && c2.result?.status).toBe("error");
  });

  it("partial state renders the live timeline with a running call and a thinking marker", () => {
    const s = midRun.reduce(reduceScreen, initialScreen("q"));
    expect(s.phase).toBe("running");
    const h = html(s);
    expect(h).toContain('data-kind="plan"');
    expect(h).toContain('data-ref="c1" data-status="ok"');
    expect(h).toContain('data-ref="c2" data-status="running"');
    expect(h).toContain('data-kind="thinking"');
    expect(h).not.toContain('data-testid="result"');
  });

  it("model_unavailable event → honest model-unavailable state, no result", async () => {
    const { state } = await run(mockFetch(streamResponse([ndjson([{ type: "model_unavailable", message: "OPENAI_API_KEY is not set" }])])));
    expect(state.phase).toBe("model_unavailable");
    const h = html(state);
    expect(h).toContain('data-testid="model-unavailable"');
    expect(h).toContain("OPENAI_API_KEY is not set");
    expect(h).not.toContain('data-testid="result"');
  });

  it("model_unavailable as a non-2xx JSON response is recognised too", async () => {
    const { state } = await run(mockFetch(new Response(JSON.stringify({ status: "model_unavailable", message: "No model configured" }), { status: 503 })));
    expect(state.phase).toBe("model_unavailable");
    expect(state.message).toBe("No model configured");
  });

  it("error mid-stream keeps the timeline so far and shows the error with the call ledger", async () => {
    const calls = result().calls;
    const { state } = await run(mockFetch(streamResponse([ndjson([...midRun, { type: "error", message: "Credit cap reached", calls }])])));
    expect(state.phase).toBe("error");
    expect(state.timeline).toHaveLength(3);
    const h = html(state);
    expect(h).toContain('data-testid="error"');
    expect(h).toContain("Credit cap reached");
    expect(h).toContain('data-testid="ledger"');
    expect(h).toContain('data-testid="timeline"');
    expect(h).not.toContain('data-kind="thinking"');
  });

  it("stream that ends without a terminal event is an error, not a silent hang", async () => {
    const { events, state } = await run(mockFetch(streamResponse([ndjson(midRun)])));
    expect(events.at(-1)?.type).toBe("error");
    expect(state.phase).toBe("error");
  });

  it("HTTP and network failures become error states", async () => {
    const http = await run(mockFetch(new Response(JSON.stringify({ message: "Bad query" }), { status: 400 })));
    expect(http.state.phase).toBe("error");
    expect(http.state.message).toBe("Bad query");
    const net = await run(mockFetch(() => Promise.reject(new TypeError("fetch failed"))));
    expect(net.state.message).toContain("fetch failed");
  });

  it("ignores malformed lines and anything after a terminal event", async () => {
    const body = "not json\n" + ndjson([start, { type: "final", result: result() }, { type: "error", message: "late" }]);
    const { events, state } = await run(mockFetch(streamResponse([body])));
    expect(events.map((e) => e.type)).toEqual(["start", "final"]);
    expect(state.phase).toBe("done");
  });
});

describe("malformed input", () => {
  it("a final event without a well-formed result becomes an error instead of crashing", async () => {
    const { state } = await run(mockFetch(streamResponse([ndjson([start, { type: "final" } as unknown as ScreenEvent])])));
    expect(state.phase).toBe("error");
    expect(html(state)).toContain('data-testid="error"');
  });
});

describe("result views", () => {
  const done = (r: ScreenResult) => [...midRun, { type: "final", result: r } as ScreenEvent].reduce(reduceScreen, initialScreen("q"));

  it("renders a ranked table and mobile cards with statuses and tappable citations", () => {
    const h = html(done(result()));
    expect(h).toContain('data-testid="result-table"');
    expect(h).toContain('data-testid="result-cards"');
    expect(h.match(/data-testid="row"/g)).toHaveLength(2);
    expect(h.match(/data-testid="card"/g)).toHaveLength(2);
    // citation: ref, method, endpoint, path
    expect(h).toContain('data-testid="cite" data-ref="c1"');
    expect(h).toContain("/company/search");
    expect(h).toContain("companies[0].founded");
    // statuses
    expect(h).toContain('data-status="verified"');
    expect(h).toContain('data-status="corrected"');
    expect(h).toMatch(/data-cell="hq" data-status="unavailable"><span[^>]*>unavailable</);
    expect(h).toContain("model said &quot;55%&quot;");
    // reasons are visible text inside the tap popover, not hover-only
    expect(h).toContain("Unavailable: not on Crustdata");
    // timeline collapses once done
    expect(h).toContain('data-testid="timeline-collapsed"');
  });

  it("shows founders with prior roles, and honest notes when founders or prior roles are missing", () => {
    const h = html(done(result()));
    expect(h).toContain("Asha Rao");
    expect(h).toContain("Director of Product");
    expect(h).toContain("Freshworks");
    expect(h).toContain('data-testid="no-prior"');
    expect(h).toContain('data-testid="no-people"');
    expect(h).toContain("No founders found on Crustdata for this company");
  });

  it("summarises filters by where they were applied, including relaxations", () => {
    const h = html(done(result()));
    expect(h).toContain('data-applied="server"');
    expect(h).toContain('data-applied="client"');
    expect(h).toContain('data-applied="unavailable"');
    expect(h).toContain("No B2B field on Crustdata");
    expect(h).toContain("relaxed");
  });

  it("flags fewer results than requested and incomplete runs", () => {
    const h = html(done(result({ status: "incomplete" })));
    expect(h).toContain('data-testid="short"');
    expect(h).toContain("Incomplete");
  });

  it("empty results: no table, an explicit no-matches state, filters still shown", () => {
    const h = html(done(result({ rows: [], citationStats: { verified: 0, corrected: 0, unavailable: 0 } })));
    expect(h).toContain('data-testid="no-results"');
    expect(h).not.toContain('data-testid="result-table"');
    expect(h).toContain('data-testid="filters"');
  });

  it("missing founders on every row never invents people", () => {
    const rows = result().rows.map((r) => ({ ...r, people: [], peopleNote: undefined }));
    const h = html(done(result({ rows })));
    expect(h.match(/data-testid="no-people"/g)).toHaveLength(4); // table + cards
    expect(h).not.toContain('data-testid="person"');
  });
});

describe("Ask page body", () => {
  const noop = () => {};
  it("idle: just the input, no sample data", () => {
    const h = renderToStaticMarkup(<AskBody state={initialScreen()} onAsk={noop} onStop={noop} />);
    expect(h).toContain('data-testid="ask-input"');
    expect(h).not.toContain('data-testid="run"');
  });
  it("running: echoes the query, shows the timeline and a Stop button", () => {
    const s = midRun.reduce(reduceScreen, initialScreen("Find ten Indian B2B software companies"));
    const h = renderToStaticMarkup(<AskBody state={s} onAsk={noop} onStop={noop} />);
    expect(h).toContain('data-testid="query"');
    expect(h).toContain('data-testid="timeline"');
    expect(h).toContain('aria-label="Stop"');
  });
});

describe("/ask?q= autorun and the Sourcing fallback", () => {
  it("autorunOnce runs a non-blank query exactly once, trimmed", async () => {
    const { autorunOnce } = await import("../ask");
    const asked: string[] = [];
    const done = { current: false };
    autorunOnce(done, "  Indian B2B SaaS  ", (q) => asked.push(q));
    autorunOnce(done, "  Indian B2B SaaS  ", (q) => asked.push(q)); // re-render / StrictMode second effect
    expect(asked).toEqual(["Indian B2B SaaS"]);
    const blank = { current: false };
    autorunOnce(blank, "   ", (q) => asked.push(q));
    autorunOnce(blank, undefined, (q) => asked.push(q));
    expect(asked).toHaveLength(1);
    expect(blank.current).toBe(false);
  });

  it("model_unavailable offers a one-tap link to the rules-based Sourcing agent with the same text", async () => {
    const q = "US fintech & payments, 50–500 people";
    const { state } = await run(mockFetch(new Response(ndjson([{ type: "model_unavailable", message: "No AI model is configured" }]), { status: 503 })), q);
    const h = html(state);
    expect(h).toContain('data-testid="model-unavailable"');
    expect(h).toContain("No AI model is configured");
    expect(h).toContain(`href="/agent?q=${encodeURIComponent(q).replace(/&/g, "&amp;")}"`);
    expect(h).toContain('data-testid="sourcing-fallback"');
  });

  it("no fallback link on other failures", async () => {
    const { state } = await run(mockFetch(new Response(ndjson([{ type: "error", message: "Crustdata 500" }]), { status: 200 })));
    expect(html(state)).not.toContain("sourcing-fallback");
  });
});
