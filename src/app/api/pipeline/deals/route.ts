// GET /api/pipeline/deals → live companies from Gmail inbound, organizational memory and the deal-stage store.
// No demo rows: a company appears only if an inbox thread names its domain, memory recorded research, or a person or
// the deal workflow moved it to a stage. Inbox rows are rebuilt from Gmail on every call, so a cold server instance
// still lists them; stages come from the durable store (`sources.stages.storage` says whether it is durable).
import { NextResponse } from "next/server";
import { listInboxThreads } from "@/lib/google/gmail";
import { mergePipelineDeals } from "@/lib/inbox/pipeline";
import { googleConfig } from "@/lib/google/oauth";
import { memoryStore } from "@/lib/memory/store";
import { listStages } from "@/lib/deals/stages";
import { storageInfo } from "@/lib/store/docs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" };
const INBOX_MAX = 25;
const MEMORY_LIMIT = 50;

export async function GET() {
  const inbox = await readInbox();
  const memory = await readMemory();
  const stages = await listStages().then((s) => ({ records: s, source: { status: "ok" as const, storage: storageInfo() } }), (e: unknown) => ({ records: [], source: { status: "error" as const, message: e instanceof Error ? e.message : String(e), storage: storageInfo() } }));
  const deals = mergePipelineDeals(inbox.threads, memory.events, stages.records);
  return NextResponse.json({
    status: "ok",
    deals,
    sources: { inbox: inbox.source, memory: memory.source, stages: stages.source },
  }, { headers: NO_STORE });
}

async function readInbox(): Promise<{ threads: { companyDomain: string | null; subject: string; lastMessageAt: string }[]; source: { status: "ok" | "not_connected" | "error"; message?: string } }> {
  const cfg = googleConfig();
  if (!cfg) return { threads: [], source: { status: "not_connected", message: "Google is not connected." } };
  try {
    const r = await listInboxThreads(cfg, { max: INBOX_MAX });
    return { threads: r.threads, source: { status: "ok" } };
  } catch (e) {
    return { threads: [], source: { status: "error", message: e instanceof Error ? e.message : String(e) } };
  }
}

async function readMemory(): Promise<{ events: { kind: string; at: string; subject?: { type: string; id: string; label?: string | null } | null }[]; source: { status: "ok" | "unavailable" | "error"; message?: string } }> {
  const m = memoryStore();
  if (m.status !== "ok") return { events: [], source: { status: "unavailable", message: m.reason } };
  try {
    const events = await m.store.list({ limit: MEMORY_LIMIT });
    return { events, source: { status: "ok" } };
  } catch (e) {
    return { events: [], source: { status: "error", message: e instanceof Error ? e.message : String(e) } };
  }
}
