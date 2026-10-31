// POST /api/live/screen {"query": "..."} → NDJSON stream of ScreenEvent (src/lib/agent/contract.ts): start, thinking,
// plan, tool_call, tool_result, verify, then final (cited, server-verified result). Without a model key the stream is
// a single `model_unavailable` event (HTTP 503); without CRUSTDATA_API_KEY a single `error` event (HTTP 503).
import { runScreenAgent } from "@/lib/agent/agent";
import type { ScreenEvent } from "@/lib/agent/contract";
import { modelFromEnv } from "@/lib/agent/model";
import { failureFrom, liveCrustdataClient } from "@/lib/live/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HEADERS = { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" };
const line = (e: ScreenEvent) => `${JSON.stringify(e)}\n`;
const single = (e: ScreenEvent, status: number) => new Response(line(e), { status, headers: HEADERS });

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { query?: unknown } | null;
  const query = typeof body?.query === "string" ? body.query.replace(/\s+/g, " ").trim() : "";
  if (!query || query.length > 2000) return single({ type: "error", message: "query must be a non-empty string (max 2000 characters)" }, 400);

  const model = modelFromEnv();
  if (!model) return single({ type: "model_unavailable", message: "No AI model is configured: set OPENAI_API_KEY (or ANTHROPIC_API_KEY) on the server. Nothing was searched." }, 503);
  let client;
  try {
    client = liveCrustdataClient();
  } catch (e) {
    return single({ type: "error", message: failureFrom(e).message }, 503);
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: ScreenEvent) => {
        try {
          controller.enqueue(enc.encode(line(e)));
        } catch {
          /* client went away; the run finishes server-side */
        }
      };
      try {
        await runScreenAgent({ query, model, client, emit, signal: req.signal });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`[live] /api/live/screen failed: ${message}`);
        emit({ type: "error", message });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });
  return new Response(stream, { status: 200, headers: HEADERS });
}
