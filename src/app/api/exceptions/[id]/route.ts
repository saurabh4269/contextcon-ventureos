// POST /api/exceptions/<id> { action: "approve" | "reject" | "edit", note?, value? } → ResolveResponse
// Resolving the last open item of a run finishes the run. Outbound items only ever run the dry-run transport.
import { NextResponse } from "next/server";
import { loadExceptionStore, ExceptionError } from "@/lib/exceptions/store";
import type { ResolveResponse } from "@/lib/exceptions/types";
import { moveStage, userName } from "@/lib/deals/stages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };
const ACTIONS = new Set(["approve", "reject", "edit"]);

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const item = (await loadExceptionStore()).get(id);
  return item ? NextResponse.json({ status: "ok", item }, { headers: NO_STORE }) : NextResponse.json({ status: "error", message: `No exception with id ${id}` }, { status: 404, headers: NO_STORE });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { action?: unknown; note?: unknown; value?: unknown } | null;
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ status: "error", message: "body must be JSON: { action: approve | reject | edit, note?, value? }" } satisfies ResolveResponse, { status: 400, headers: NO_STORE });
  }
  const action = body?.action;
  if (typeof action !== "string" || !ACTIONS.has(action)) return NextResponse.json({ status: "error", message: "action must be approve, reject or edit" } satisfies ResolveResponse, { status: 400, headers: NO_STORE });
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  try {
    const store = await loadExceptionStore();
    const { item, run } = store.resolveException(id, action as "approve" | "reject" | "edit", { note: str(body?.note), value: str(body?.value) });
    await store.flush();
    // A person approved (or entered) a value for this deal: a Sourced deal moves to Screening, owned by that person.
    const domain = item.subject?.domain;
    if (domain && action !== "reject") await moveStage({ domain, name: item.subject?.name, stage: "screening", by: userName() ?? "you", actor: "user", forwardOnly: true, note: `Approved in Review: ${item.title}` }).catch((e: unknown) => console.error(`[stages] ${domain}: ${e instanceof Error ? e.message : String(e)}`));
    return NextResponse.json({ status: "ok", item, run, open: store.openCount() } satisfies ResolveResponse, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof ExceptionError) return NextResponse.json({ status: "error", message: e.message } satisfies ResolveResponse, { status: e.status, headers: NO_STORE });
    console.error(`[exceptions] resolve ${id} failed: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ status: "error", message: "Could not save the decision (see server log)." } satisfies ResolveResponse, { status: 500, headers: NO_STORE });
  }
}
