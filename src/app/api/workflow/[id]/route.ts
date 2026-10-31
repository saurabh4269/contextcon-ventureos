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
import { dispatchAction } from "@/lib/workflow/dispatch";
import { toPublicDeal } from "@/lib/workflow/public";
import { isRunningNow } from "@/lib/workflow/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const NO_STORE = { "cache-control": "no-store" };


export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const d = await workflowStore.get((await ctx.params).id);
  if (!d) return NextResponse.json({ status: "error", message: "no such deal" }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ ...toPublicDeal(d), running: isRunningHere(d.id) || isRunningNow(d), storage: workflowStore.info() }, { headers: NO_STORE });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = (await ctx.params).id;
  if (!(await workflowStore.get(id))) return NextResponse.json({ status: "error", message: "no such deal" }, { status: 404, headers: NO_STORE });
  if (isRunningHere(id)) return NextResponse.json({ status: "error", message: "The deal is still running; try again when it stops." }, { status: 409, headers: NO_STORE });
  const a = await req.json().catch(() => null);
  const g = googleConfig();
  // read → check → apply → claim the run → save is one atomic step per deal (dispatch.ts): a double click or a second tab
  // cannot send twice or decide twice. The claim marks the deal running, so no other action passes until it stops.
  const r = await dispatchAction(workflowStore, id, a, { sendMessage: g ? (m) => sendMessage(g, m) : undefined, insertEvent: g ? (e) => insertEvent(g, e) : undefined }, new Date());
  if (!r.ok) return NextResponse.json({ status: "error", message: r.message }, { status: r.status, headers: NO_STORE });
  runInBackground(r.deal);
  return NextResponse.json({ ...toPublicDeal(r.deal), running: true }, { headers: NO_STORE });
}
