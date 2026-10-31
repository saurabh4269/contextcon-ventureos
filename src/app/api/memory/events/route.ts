// Organizational memory (contract: docs/API.md "Memory").
//   GET  /api/memory/events?since=<id>&limit=<n> → { status:"ok", events, cursor }
//   POST /api/memory/events {kind, actor, subject?, summary, data?, source} → 201 { status:"ok", event }
// Without DATABASE_URL both answer 503 { status:"unavailable", reason:"memory store not configured (DATABASE_URL)" }.
import { NextResponse } from "next/server";
import { memoryStore } from "@/lib/memory/store";
import { isEventId, parseMemoryEventInput } from "@/lib/memory/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const fail = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: NO_STORE });

export async function GET(req: Request) {
  const m = memoryStore();
  if (m.status !== "ok") return fail(503, m);
  const q = new URL(req.url).searchParams;
  const since = q.get("since") ?? undefined;
  if (since !== undefined && !isEventId(since)) return fail(400, { status: "error", message: "since must be an event id (digits)" });
  const limitRaw = q.get("limit");
  const limit = limitRaw ? Number(limitRaw) : DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return fail(400, { status: "error", message: `limit must be an integer 1..${MAX_LIMIT}` });
  try {
    const events = await m.store.list({ sinceId: since, limit });
    return NextResponse.json({ status: "ok", events, cursor: events.at(-1)?.id ?? since ?? null }, { headers: NO_STORE });
  } catch (e) {
    console.error("[memory] store error:", e instanceof Error ? e.message : String(e));
    return fail(502, { status: "error", message: "Memory store error (see server log)" });
  }
}

export async function POST(req: Request) {
  const m = memoryStore();
  if (m.status !== "ok") return fail(503, m);
  const body = await req.json().catch(() => null);
  const parsed = parseMemoryEventInput(body);
  if (!parsed.ok) return fail(400, { status: "error", message: parsed.message });
  try {
    const event = await m.store.append(parsed.input);
    return NextResponse.json({ status: "ok", event }, { status: 201, headers: NO_STORE });
  } catch (e) {
    console.error("[memory] store error:", e instanceof Error ? e.message : String(e));
    return fail(502, { status: "error", message: "Memory store error (see server log)" });
  }
}
