// POST /api/sourcing/run  { "q": "<free-text request>" }  →  application/x-ndjson stream of AgentEvent lines
// (src/lib/sourcing/run.ts): plan → step (running/done/failed, with endpoint, ms, credits, cache hits, count) → row
// (upserted by id as founders arrive) → dropped → done (summary) | refuse | redirect | error.
// Also accepts GET ?q= for quick checks. Each finished run is appended to organizational memory ("agent.run");
// without DATABASE_URL the store is unavailable and the run still completes. The finished run and the items that need a
// person (src/lib/exceptions/rules.ts fromSourcingRun) go to the review queue (/review); everything else auto-completes.
import { NextResponse } from "next/server";
import { runAgent, type AgentEvent, type AgentRow, type Dropped, type RunSummary } from "@/lib/sourcing/run";
import { fromSourcingRun } from "@/lib/exceptions/rules";
import { loadExceptionStore } from "@/lib/exceptions/store";
import { liveCrustdataClient, NotConnectedError } from "@/lib/live/server";
import { recordMemory } from "@/lib/memory/store";
import type { CrustdataClient } from "@/lib/crustdata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function stream(q: unknown, signal: AbortSignal) {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (e: AgentEvent) => {
        if (closed) return;
        try { controller.enqueue(enc.encode(JSON.stringify(e) + "\n")); } catch { closed = true; }
      };
      let client: CrustdataClient | null = null;
      try {
        client = liveCrustdataClient();
      } catch (e) {
        if (!(e instanceof NotConnectedError)) throw e;
      }
      const rows = new Map<number, { name: string; domain?: string }>();
      const fullRows = new Map<number, AgentRow>();
      const dropped: Dropped[] = [];
      let summary: RunSummary | null = null;
      try {
        summary = await runAgent(q, {
          client,
          signal,
          emit: (e) => {
            if (e.type === "row") {
              rows.set(e.row.id, { name: e.row.name, domain: e.row.domain });
              fullRows.set(e.row.id, e.row);
            }
            if (e.type === "dropped") dropped.push(e.item);
            emit(e);
          },
        });
      } catch (e) {
        emit({ type: "error", kind: "upstream", message: e instanceof Error ? e.message : String(e) });
      }
      if (summary) {
        const companies = summary.rowOrder.map((id) => rows.get(id)).filter(Boolean).slice(0, 25);
        const mem = await recordMemory({
          kind: "agent.run",
          actor: { type: "agent", id: "sourcing", name: "Sourcing agent" },
          subject: null,
          summary: `Sourcing agent: “${summary.request.slice(0, 160)}” → ${summary.returned}/${summary.requested} companies (${summary.credits} credits)`,
          data: { runId: summary.runId, request: summary.request.slice(0, 500), returned: summary.returned, requested: summary.requested, credits: summary.credits, relaxed: summary.relaxed, companies },
          source: "api:/api/sourcing/run",
        }).catch((e: unknown) => ({ status: "error" as const, message: e instanceof Error ? e.message : String(e) }));
        try {
          const d = fromSourcingRun(summary, [...fullRows.values()], dropped);
          const store = await loadExceptionStore();
          const { run, items } = store.recordRun(d.run, d.raise);
          await store.flush();
          const open = items.filter((i) => i.status === "open").length;
          emit({ type: "step", step: { id: "review", label: "Route exceptions to a person", tool: "review", endpoint: `/review?run=${run.id}`, status: "done", startedAt: new Date().toISOString(), ms: 0, detail: open ? `${open} item${open === 1 ? "" : "s"} need a person; ${run.autoCompleted} auto-completed` : `all ${run.autoCompleted} auto-completed` } });
        } catch (e) {
          emit({ type: "step", step: { id: "review", label: "Route exceptions to a person", tool: "review", endpoint: "/review", status: "failed", startedAt: new Date().toISOString(), ms: 0, detail: e instanceof Error ? e.message : String(e) } });
        }
        emit({ type: "step", step: { id: "memory", label: "Save to firm memory", tool: "memory", endpoint: "memory store", status: mem.status === "ok" ? "done" : "skipped", startedAt: new Date().toISOString(), ms: 0, detail: mem.status === "ok" ? "recorded as agent.run" : "reason" in mem ? mem.reason : mem.message } });
      }
      closed = true;
      controller.close();
    },
  });
}

const headers = { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" };

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", message: "body must be JSON: { \"q\": \"…\" }" }, { status: 400 });
  }
  const q = body && typeof body === "object" ? (body as { q?: unknown }).q : undefined;
  if (typeof q !== "string") return NextResponse.json({ status: "error", message: "q (string) is required" }, { status: 400 });
  return new Response(stream(q, req.signal), { headers });
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return new Response(stream(q, req.signal), { headers });
}
