// GET /api/memory/stream?since=<id> — Server-Sent Events: one `event: memory` per new event (data = MemoryEvent JSON),
// polled from the store every POLL_MS. Without DATABASE_URL: 503 unavailable (same body as /api/memory/events).
import { NextResponse } from "next/server";
import { memoryStore } from "@/lib/memory/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_MS = 2000;
const BATCH = 100;

export async function GET(req: Request) {
  const m = memoryStore();
  if (m.status !== "ok") return NextResponse.json(m, { status: 503, headers: { "cache-control": "no-store" } });
  const store = m.store;
  let cursor = new URL(req.url).searchParams.get("since") ?? undefined;
  if (cursor !== undefined && !/^\d+$/.test(cursor)) return NextResponse.json({ status: "error", message: "since must be an event id (digits)" }, { status: 400 });
  const enc = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (s: string) => ctrl.enqueue(enc.encode(s));
      const tick = async () => {
        try {
          const events = await store.list({ sinceId: cursor, limit: BATCH });
          for (const e of events) send(`id: ${e.id}\nevent: memory\ndata: ${JSON.stringify(e)}\n\n`);
          if (events.length) cursor = events.at(-1)!.id;
          else send(": keep-alive\n\n");
        } catch (e) {
          send(`event: error\ndata: ${JSON.stringify({ status: "error", message: e instanceof Error ? e.message : String(e) })}\n\n`);
        }
        if (!req.signal.aborted) timer = setTimeout(tick, POLL_MS);
      };
      req.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        try { ctrl.close(); } catch { /* already closed */ }
      });
      await tick();
    },
    cancel() {
      clearTimeout(timer);
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" } });
}
