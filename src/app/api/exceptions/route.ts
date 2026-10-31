// GET  /api/exceptions[?status=open|all][&run=<runId>][&count=1] → ExceptionsResponse (or { open } with count=1)
// POST /api/exceptions { item: RaiseInput } → raise one item (idempotent per open `key`) — the HTTP seam for agent
//      loops that run elsewhere; in-process callers use raiseException() from src/lib/exceptions/store.ts.
// Storage: the durable store (Postgres with DATABASE_URL, else JSON files); the response's `storage.note` says which.
import { NextResponse } from "next/server";
import { loadExceptionStore } from "@/lib/exceptions/store";
import { parseRaise } from "@/lib/exceptions/raise";
import type { ExceptionsResponse } from "@/lib/exceptions/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "cache-control": "no-store" };

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const store = await loadExceptionStore();
  if (q.get("count") === "1") return NextResponse.json({ open: store.openCount() }, { headers: noStore });
  const { items, runs } = store.list({ status: q.get("status") === "open" ? "open" : "all", runId: q.get("run") ?? undefined });
  const body: ExceptionsResponse = { storage: store.storage(), open: store.openCount(), items, runs };
  return NextResponse.json(body, { headers: noStore });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", message: "body must be JSON: { item: { kind, key, title, reason, evidence } }" }, { status: 400 });
  }
  const parsed = parseRaise((body as { item?: unknown } | null)?.item);
  if (!parsed.ok) return NextResponse.json({ status: "error", message: parsed.message }, { status: 400 });
  const store = await loadExceptionStore();
  const item = store.raiseException(parsed.input);
  await store.flush();
  return NextResponse.json({ status: "ok", item, open: store.openCount() }, { headers: noStore });
}
