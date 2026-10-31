// GET /api/memory/stream?since=<id> — Server-Sent Events: one `event: memory` per new event (data = MemoryEvent JSON),
// polled from the store every POLL_MS. Without DATABASE_URL: 503 unavailable (same body as /api/memory/events).
import { NextResponse } from "next/server";
import { memoryStore } from "@/lib/memory/store";
import { isEventId } from "@/lib/memory/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_MS = 2000;
const BATCH = 100;

export async function GET(req: Request) {
  const m = memoryStore();
  if (m.status !== "ok") return NextResponse.json(m, { status: 503, headers: { "cache-control": "no-store" } });
  const store = m.store;
  let cursor = new URL(req.url).searchParams.get("since") ?? undefined;
  if (cursor !== undefined && !isEventId(cursor)) return NextResponse.json({ status: "error", message: "since must be an event id (digits)" }, { status: 400 });
  const enc = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  const stream = new ReadableStream({
    async start(ctrl) {
      // enqueue on a closed/cancelled stream throws; a send after the client left must be a no-op, not an unhandled rejection
      const send = (s: string) => {
        if (closed) return;
        try { ctrl.enqueue(enc.encode(s)); } catch { closed = true; }
      };
      const tick = async () => {
        if (closed) return;
        try {
          const events = await store.list({ sinceId: cursor, limit: BATCH });
          for (const e of events) send(`id: ${e.id}\nevent: memory\ndata: ${JSON.stringify(e)}\n\n`);
          if (events.length) cursor = events.at(-1)!.id;
          else send(": keep-alive\n\n");
        } catch (e) {
          console.error("[memory] stream store error:", e instanceof Error ? e.message : String(e));
          send(`event: error\ndata: ${JSON.stringify({ status: "error", message: "Memory store error (see server log)" })}\n\n`);
        }
        if (!closed && !req.signal.aborted) timer = setTimeout(tick, POLL_MS);
      };
      req.signal.addEventListener("abort", () => {
        closed = true;
        clearTimeout(timer);
        try { ctrl.close(); } catch { /* already closed */ }
      });
      await tick();
    },
    cancel() {
      closed = true;
      clearTimeout(timer);
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" } });
}
