// GET /api/connectors/gmail/threads?since=<ISO>&max=<1..25> → { status:"ok", since, threads: InboxThread[], estimate }
// Inbox threads (metadata only: From / Subject / Date), newest first; times are UTC ISO. Read-only: nothing is sent.
import { NextResponse } from "next/server";
import { listInboxThreads } from "@/lib/google/gmail";
import { NO_STORE, withGoogle } from "@/lib/google/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const DEFAULT_MAX = 10, MAX = 25;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const since = q.get("since");
  if (since && Number.isNaN(Date.parse(since))) return NextResponse.json({ status: "error", message: "since must be an ISO timestamp" }, { status: 400, headers: NO_STORE });
  const max = q.get("max") ? Number(q.get("max")) : DEFAULT_MAX;
  if (!Number.isInteger(max) || max < 1 || max > MAX) return NextResponse.json({ status: "error", message: `max must be 1..${MAX}` }, { status: 400, headers: NO_STORE });
  return withGoogle(async (cfg) => {
    const r = await listInboxThreads(cfg, { after: since ? new Date(since) : null, max });
    return NextResponse.json({ status: "ok", since, ...r }, { headers: NO_STORE });
  });
}
