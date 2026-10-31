// POST /api/exceptions/<id> { action: "approve" | "reject" | "edit", note?, value? } → ResolveResponse
// Resolving the last open item of a run finishes the run. Outbound items only ever run the dry-run transport.
import { NextResponse } from "next/server";
import { loadExceptionStore, ExceptionError } from "@/lib/exceptions/store";
import type { ResolveResponse } from "@/lib/exceptions/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set(["approve", "reject", "edit"]);

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const item = (await loadExceptionStore()).get(id);
  return item ? NextResponse.json({ status: "ok", item }) : NextResponse.json({ status: "error", message: `No exception with id ${id}` }, { status: 404 });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { action?: unknown; note?: unknown; value?: unknown } | null;
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ status: "error", message: "body must be JSON: { action: approve | reject | edit, note?, value? }" } satisfies ResolveResponse, { status: 400 });
  }
  const action = body?.action;
  if (typeof action !== "string" || !ACTIONS.has(action)) return NextResponse.json({ status: "error", message: "action must be approve, reject or edit" } satisfies ResolveResponse, { status: 400 });
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const store = await loadExceptionStore();
  try {
    const { item, run } = store.resolveException(id, action as "approve" | "reject" | "edit", { note: str(body?.note), value: str(body?.value) });
    await store.flush();
    return NextResponse.json({ status: "ok", item, run, open: store.openCount() } satisfies ResolveResponse, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof ExceptionError) return NextResponse.json({ status: "error", message: e.message } satisfies ResolveResponse, { status: e.status });
    throw e;
  }
}
