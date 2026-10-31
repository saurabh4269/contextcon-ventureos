"use client";
// Client side of POST /api/sourcing/run: reads the NDJSON stream and folds events into one state object.
import { useCallback, useRef, useState } from "react";
import type { AgentEvent, AgentRow, AgentStep, Dropped, RunSummary } from "@/lib/sourcing/run";
import type { ParseResult } from "@/lib/sourcing/parse";

export type RunState = {
  status: "idle" | "running" | "done" | "refused" | "redirect" | "error" | "stopped";
  q: string;
  parse?: ParseResult;
  steps: AgentStep[];
  rows: AgentRow[];
  dropped: Dropped[];
  summary?: RunSummary;
  message?: string;
  errorKind?: string;
  redirect?: { href: string; label: string; reason: string };
};

const INITIAL: RunState = { status: "idle", q: "", steps: [], rows: [], dropped: [] };

export function reduce(s: RunState, e: AgentEvent): RunState {
  switch (e.type) {
    case "plan": return { ...s, parse: e.parse };
    case "step": {
      const i = s.steps.findIndex((x) => x.id === e.step.id);
      const steps = i < 0 ? [...s.steps, e.step] : s.steps.map((x, j) => (j === i ? e.step : x));
      return { ...s, steps };
    }
    case "row": {
      const i = s.rows.findIndex((x) => x.id === e.row.id);
      const rows = i < 0 ? [...s.rows, e.row] : s.rows.map((x, j) => (j === i ? e.row : x));
      return { ...s, rows: [...rows].sort((a, b) => (a.rank || 99) - (b.rank || 99)) };
    }
    case "dropped": return { ...s, dropped: [...s.dropped, e.item] };
    case "refuse": return { ...s, status: "refused", message: e.message };
    case "redirect": return { ...s, status: "redirect", redirect: e };
    case "error": return { ...s, status: "error", message: e.message, errorKind: e.kind };
    case "done": {
      const order = new Map(e.summary.rowOrder.map((id, i) => [id, i]));
      return { ...s, status: "done", summary: e.summary, rows: [...s.rows].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99)) };
    }
  }
}

export function useAgentRun(onFinish?: (s: RunState) => void) {
  const [state, setState] = useState<RunState>(INITIAL);
  const abort = useRef<AbortController | null>(null);
  const run = useCallback(async (q: string) => {
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    let cur: RunState = { ...INITIAL, status: "running", q };
    setState(cur);
    const apply = (e: AgentEvent) => { cur = reduce(cur, e); setState(cur); };
    try {
      const res = await fetch("/api/sourcing/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q }), signal: ac.signal });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null) as { message?: string } | null;
        apply({ type: "error", kind: "upstream", message: body?.message ?? `The agent endpoint answered ${res.status}.` });
      } else {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            try { apply(JSON.parse(line) as AgentEvent); } catch { /* a malformed line is skipped, the stream continues */ }
          }
        }
        if (cur.status === "running") apply({ type: "error", kind: "upstream", message: "The run ended without a result (the connection closed early)." });
      }
    } catch (e) {
      if (ac.signal.aborted) { cur = { ...cur, status: "stopped", message: "Stopped." }; setState(cur); }
      else apply({ type: "error", kind: "upstream", message: e instanceof Error ? e.message : String(e) });
    }
    onFinish?.(cur);
  }, [onFinish]);
  const stop = useCallback(() => abort.current?.abort(), []);
  return { state, run, stop };
}
