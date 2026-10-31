// GET /api/workflow/inbox → { query, candidates: [{id, subject, date, domain}] }
// Read-only Gmail search (INBOX_QUERY) for founder emails a deal can start from. Nothing is modified or sent. The
// deploy is public, so only pitch-like subjects that name a company domain are listed, and no sender is shown.
import { NextResponse } from "next/server";
import { getMessage, searchMessages } from "@/lib/google/gmail";
import { NO_STORE, withGoogle } from "@/lib/google/route";
import { companyDomainFrom } from "@/lib/workflow/extract";
import { INBOX_QUERY } from "@/lib/workflow/inbox";
import { PITCH_LIKE } from "@/lib/adapters/today";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withGoogle(async (cfg) => {
    const ids = await searchMessages(cfg, INBOX_QUERY, 10);
    const msgs = await Promise.all(ids.map((m) => getMessage(cfg, m.id).catch(() => null)));
    const candidates = msgs
      .filter((m) => m !== null)
      .map((m) => ({ id: m.id, subject: m.subject, date: m.date, domain: companyDomainFrom(m) }))
      .filter((c) => c.domain && PITCH_LIKE.test(c.subject));
    return NextResponse.json({ status: "ok", query: INBOX_QUERY, candidates, hidden: msgs.filter(Boolean).length - candidates.length }, { headers: NO_STORE });
  });
}
