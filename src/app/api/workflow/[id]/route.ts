// GET  /api/workflow/:id → Deal (public view; poll while deal.running)
// POST /api/workflow/:id {action:"approve", step:"dataroom"|"schedule"} | {action:"transcript", text, source?, name?}
//      | {action:"skip_transcript"} | {action:"override_screen"} | {action:"decide", verdict:"invest"|"pass", note?}
//      | {action:"resume"} | {action:"regenerate_memo"} → Deal; every action resumes the run after the response. approve
//      sends only when OUTBOUND_MODE=live and every recipient is on the allowlist; otherwise it records the dry run.
import { NextResponse } from "next/server";
import { googleConfig } from "@/lib/google/oauth";
import { sendMessage } from "@/lib/google/gmail";
import { insertEvent } from "@/lib/google/calendar";
import { workflowStore } from "@/lib/workflow/store";
import { isRunningHere, runInBackground } from "@/lib/workflow/server";
import { applyAction, type Action } from "@/lib/workflow/actions";
import { toPublicDeal } from "@/lib/workflow/public";
import { isRunningNow } from "@/lib/workflow/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const NO_STORE = { "cache-control": "no-store" };

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const d = await workflowStore.get((await ctx.params).id);
  if (!d) return NextResponse.json({ status: "error", message: "no such deal" }, { status: 404 });
  return NextResponse.json({ ...toPublicDeal(d), running: isRunningHere(d.id) || isRunningNow(d), storage: workflowStore.info() }, { headers: NO_STORE });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = (await ctx.params).id;
  const d = await workflowStore.get(id);
  if (!d) return NextResponse.json({ status: "error", message: "no such deal" }, { status: 404 });
  if (isRunningHere(id) || isRunningNow(d)) return NextResponse.json({ status: "error", message: "The deal is still running; try again when it stops." }, { status: 409 });
  const a = (await req.json().catch(() => null)) as Action | null;
  if (!a || typeof a !== "object") return NextResponse.json({ status: "error", message: "body must be {action, …}" }, { status: 400 });
  const g = googleConfig();
  try {
    const r = await applyAction(d, a, { sendMessage: g ? (m) => sendMessage(g, m) : undefined, insertEvent: g ? (e) => insertEvent(g, e) : undefined }, new Date());
    if (!r.ok) return NextResponse.json({ status: "error", message: r.message }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ status: "error", message: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
  d.running = false; // a stale run (its instance died) no longer counts
  d.updatedAt = new Date().toISOString();
  await workflowStore.save(d);
  runInBackground(d);
  return NextResponse.json({ ...toPublicDeal(d), running: true }, { headers: NO_STORE });
}
