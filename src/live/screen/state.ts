// Client side of POST /api/live/screen: reads the NDJSON event stream (src/lib/agent/contract.ts) and folds it into
// the state the Ask screen renders — a live plan/tool timeline, then the verified result, or an honest failure.
import type { LedgerCall, ScreenEvent, ScreenResult } from "@/lib/agent/contract";

type ToolCallEv = Extract<ScreenEvent, { type: "tool_call" }>;
type ToolResultEv = Extract<ScreenEvent, { type: "tool_result" }>;

export type TimelineItem =
  | { kind: "plan"; step: number; text: string }
  | { kind: "tool"; step: number; call: ToolCallEv; result?: ToolResultEv }
  | { kind: "verify"; text: string; stats: ScreenResult["citationStats"] };

export type ScreenPhase = "idle" | "running" | "done" | "model_unavailable" | "error";

export type ScreenState = {
  phase: ScreenPhase;
  query: string;
  model?: { provider: string; model: string };
  startedAt?: string;
  /** step number of a model turn in progress (cleared once that turn narrates or calls a tool) */
  thinking: number | null;
  timeline: TimelineItem[];
  result?: ScreenResult;
  message?: string;
  calls?: LedgerCall[];
};

export const initialScreen = (query = ""): ScreenState => ({ phase: query ? "running" : "idle", query, thinking: null, timeline: [] });

export function reduceScreen(s: ScreenState, e: ScreenEvent): ScreenState {
  switch (e.type) {
    case "start":
      return { ...s, phase: "running", query: e.query || s.query, model: e.model, startedAt: e.at };
    case "thinking":
      return { ...s, thinking: e.step };
    case "plan":
      return { ...s, thinking: null, timeline: [...s.timeline, { kind: "plan", step: e.step, text: e.text }] };
    case "tool_call":
      return { ...s, thinking: null, timeline: [...s.timeline, { kind: "tool", step: e.step, call: e }] };
    case "tool_result": {
      let hit = false;
      const timeline = s.timeline.map((t) => (t.kind === "tool" && t.call.ref === e.ref && !hit ? ((hit = true), { ...t, result: e }) : t));
      return { ...s, timeline: hit ? timeline : [...timeline, { kind: "tool", step: e.step, call: { type: "tool_call", step: e.step, ref: e.ref, tool: e.tool, endpoint: "", input: {}, estCredits: 0 }, result: e }] };
    }
    case "verify":
      return { ...s, thinking: null, timeline: [...s.timeline, { kind: "verify", text: e.text, stats: e.stats }] };
    case "final":
      if (!isResult(e.result)) return { ...s, phase: "error", thinking: null, message: "The agent returned a malformed result." };
      return { ...s, phase: "done", thinking: null, result: e.result, calls: e.result.calls };
    case "model_unavailable":
      return { ...s, phase: "model_unavailable", thinking: null, message: e.message };
    case "error":
      return { ...s, phase: "error", thinking: null, message: e.message, calls: e.calls ?? s.calls };
    default:
      return s;
  }
}

const isResult = (r: unknown): r is ScreenResult => {
  const o = r as Partial<ScreenResult> | null;
  return !!o && Array.isArray(o.rows) && Array.isArray(o.columns) && Array.isArray(o.filters) && Array.isArray(o.caveats) && Array.isArray(o.calls) && !!o.citationStats && !!o.credits && !!o.timings && !!o.model;
};

const TERMINAL = new Set<ScreenEvent["type"]>(["final", "model_unavailable", "error"]);

/** Parse NDJSON from a byte stream, calling `onEvent` per line. Malformed lines are skipped. */
export async function readNdjson(body: ReadableStream<Uint8Array>, onEvent: (e: ScreenEvent) => void): Promise<void> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const flush = (line: string) => {
    const t = line.trim();
    if (!t) return;
    try {
      const ev = JSON.parse(t) as ScreenEvent;
      if (ev && typeof ev === "object" && typeof ev.type === "string") onEvent(ev);
    } catch {
      /* partial or non-JSON line: ignore */
    }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      flush(buf.slice(0, i));
      buf = buf.slice(i + 1);
    }
  }
  flush(buf + dec.decode());
}

/**
 * POST the ask and stream events into `onEvent`. Always ends with exactly one terminal event (final /
 * model_unavailable / error): HTTP failures, network errors and streams that stop early are reported as `error`
 * (or `model_unavailable` when the server says so), never silently.
 */
export async function runScreen(query: string, onEvent: (e: ScreenEvent) => void, opts: { fetch?: typeof fetch; signal?: AbortSignal } = {}): Promise<void> {
  const f = opts.fetch ?? fetch;
  let ended = false;
  const emit = (e: ScreenEvent) => {
    if (ended) return;
    if (TERMINAL.has(e.type)) ended = true;
    onEvent(e);
  };
  try {
    const r = await f("/api/live/screen", { method: "POST", headers: { "content-type": "application/json", accept: "application/x-ndjson" }, body: JSON.stringify({ query }), signal: opts.signal });
    if (!r.ok || !r.body) {
      const b = (await r.json().catch(() => null)) as { type?: string; status?: string; message?: string; reason?: string } | null;
      if (b?.type === "model_unavailable" || b?.status === "model_unavailable") return emit({ type: "model_unavailable", message: b.message ?? b.reason ?? "The model is not available." });
      return emit({ type: "error", message: b?.message ?? `Request failed (HTTP ${r.status}).` });
    }
    await readNdjson(r.body, emit);
    if (!ended) emit({ type: "error", message: "The stream ended before a result arrived." });
  } catch (e) {
    if (opts.signal?.aborted) return emit({ type: "error", message: "Stopped." });
    emit({ type: "error", message: `Network error: ${e instanceof Error ? e.message : String(e)}` });
  }
}
