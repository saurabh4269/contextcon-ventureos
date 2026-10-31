// GET  /api/workflow → { deals, storage }
// POST /api/workflow {from:"gmail", messageId} | {from:"ask", domain, name?} → 201 { id } and the ten-step run starts
//      after the response (poll GET /api/workflow/:id). See docs/API.md ("Deal workflow").
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { normalizeDomainInput } from "@/lib/live/normalize";
import { workflowStore } from "@/lib/workflow/store";
import { runInBackground } from "@/lib/workflow/server";
import { toPublicDeal } from "@/lib/workflow/public";
import { personName } from "@/lib/workflow/actions";
import { moveStage } from "@/lib/deals/stages";
import { isRunningNow, newSteps, type Deal, type Trigger } from "@/lib/workflow/types";
import { INBOX_QUERY } from "@/lib/workflow/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// the run continues after the response (next/server after()); Vercel stops it at maxDuration
export const maxDuration = 300;
const NO_STORE = { "cache-control": "no-store" };

export async function GET() {
  const deals = await workflowStore.list();
  return NextResponse.json({ deals: deals.map((d) => toPublicDeal({ ...d, running: isRunningNow(d) })), storage: workflowStore.info() }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { from?: string; messageId?: string; domain?: string; name?: string } | null;
  const bad = (message: string) => NextResponse.json({ status: "error", message }, { status: 400, headers: NO_STORE });
  let trigger: Trigger;
  if (b?.from === "gmail" && typeof b.messageId === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(b.messageId)) trigger = { type: "gmail", messageId: b.messageId, query: INBOX_QUERY };
  else if (b?.from === "ask" && typeof b.domain === "string") {
    const domain = normalizeDomainInput(b.domain);
    if (!domain) return bad(`not a company domain: ${b.domain.slice(0, 80)}`);
    trigger = { type: "ask", domain, ...(typeof b.name === "string" && b.name.trim() ? { name: b.name.trim().slice(0, 120) } : {}) };
  } else return bad('body must be {from:"gmail", messageId} or {from:"ask", domain, name?}');
  const now = new Date().toISOString();
  const by = trigger.type === "gmail" ? "Inbox agent" : personName();
  const deal: Deal = { id: randomUUID().slice(0, 8), createdAt: now, updatedAt: now, trigger, company: trigger.type === "ask" ? { domain: trigger.domain, name: trigger.name } : {}, stage: "sourced", stageHistory: [{ stage: "sourced", at: now, by }], steps: newSteps() };
  try {
    await workflowStore.save(deal);
  } catch (e) {
    console.error(`[workflow] could not save deal ${deal.id}: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ status: "error", message: "The deal could not be saved to the store (see server log)." }, { status: 502, headers: NO_STORE });
  }
  // a person started it from a domain: the deal is Sourced and theirs (a Gmail start gets its domain at intake)
  if (trigger.type === "ask") await moveStage({ domain: trigger.domain, name: trigger.name, stage: "sourced", by, actor: "user", workflowId: deal.id }).catch(() => undefined);
  runInBackground(deal);
  return NextResponse.json({ id: deal.id }, { status: 201, headers: NO_STORE });
}
