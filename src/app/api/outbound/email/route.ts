// POST /api/outbound/email — approved outreach through the connected Gmail account. Two steps, always:
//   {action:"preview", to[], subject, body}  → 200 { status:"ok", mode, draft, approval:{token, expiresAt} }
//                                             403 { status:"blocked", blocked[], allowlist[] } when a recipient is not allowed
//   {action:"send", to[], subject, body, approvalToken} → dry_run: 200 {transport:"dry_run", wouldSend}
//                                                         live:    201 {transport:"live", message:{id, threadId}}
//   {action:"draft", to[], subject, body}    → saves a Gmail draft (live) or returns it (dry_run); nothing is sent
// Gates (lib/outbound.ts): OUTBOUND_MODE/OUTBOUND_LIVE, DEMO_RECIPIENT_ALLOWLIST, and a single-use approval token
// bound to the exact message (minted only by preview, i.e. the UI's "Approve & send" click).
import { NextResponse } from "next/server";
import { createDraft, sendMessage } from "@/lib/google/gmail";
import { NO_STORE, withGoogle } from "@/lib/google/route";
import { recordMemory } from "@/lib/memory/store";
import { checkRecipients, consumeApproval, createApproval, dryRun, outboundMode, recipientAllowlist } from "@/lib/outbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const KIND = "gmail.messages.send";
const MAX_SUBJECT = 250, MAX_BODY = 20_000, MAX_TO = 10;

type Draft = { to: string[]; subject: string; body: string };

function parse(b: unknown): { ok: true; action: "preview" | "send" | "draft"; draft: Draft; token?: unknown } | { ok: false; message: string } {
  const o = b as { action?: unknown; to?: unknown; subject?: unknown; body?: unknown; approvalToken?: unknown } | null;
  if (!o || typeof o !== "object" || Array.isArray(o)) return { ok: false, message: "body must be a JSON object {action, to, subject, body}" };
  if (o.action !== "preview" && o.action !== "send" && o.action !== "draft") return { ok: false, message: 'action must be "preview", "send" or "draft"' };
  const to = typeof o.to === "string" ? [o.to] : o.to;
  if (!Array.isArray(to) || !to.length || to.length > MAX_TO || !to.every((t) => typeof t === "string")) return { ok: false, message: `to must be 1..${MAX_TO} email addresses` };
  if (typeof o.subject !== "string" || !o.subject.trim() || o.subject.length > MAX_SUBJECT) return { ok: false, message: `subject is required (≤ ${MAX_SUBJECT} chars)` };
  if (typeof o.body !== "string" || !o.body.trim() || o.body.length > MAX_BODY) return { ok: false, message: `body is required (≤ ${MAX_BODY} chars)` };
  return { ok: true, action: o.action, draft: { to: (to as string[]).map((t) => t.trim().toLowerCase()), subject: o.subject.trim(), body: o.body }, token: o.approvalToken };
}

/** GET → { mode, allowlist } so the UI can say whether Approve really sends, and to whom it may. */
export async function GET() {
  return NextResponse.json({ status: "ok", mode: outboundMode(), allowlist: recipientAllowlist() }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const p = parse(await req.json().catch(() => null));
  if (!p.ok) return NextResponse.json({ status: "error", message: p.message }, { status: 400, headers: NO_STORE });
  const mode = outboundMode();
  const rc = checkRecipients(p.draft.to);
  if (!rc.ok) return NextResponse.json({ status: "blocked", message: rc.message, blocked: rc.blocked, allowlist: rc.allowlist }, { status: 403, headers: NO_STORE });

  if (p.action === "preview")
    return NextResponse.json({ status: "ok", mode, draft: p.draft, approval: createApproval(KIND, p.draft), note: mode === "dry_run" ? "Dry run: approving shows what would be sent; nothing leaves the server." : "Live: approving sends this exact message from the connected Gmail account." }, { headers: NO_STORE });

  if (p.action === "draft") {
    if (mode === "dry_run") return NextResponse.json(dryRun("gmail.drafts.create", p.draft), { headers: NO_STORE });
    return withGoogle(async (cfg) => NextResponse.json({ status: "ok", transport: "live", draft: await createDraft(cfg, p.draft) }, { status: 201, headers: NO_STORE }));
  }

  const ap = consumeApproval(p.token, KIND, p.draft);
  if (!ap.ok) return NextResponse.json({ status: "not_approved", reason: ap.reason, message: ap.message }, { status: 428, headers: NO_STORE });
  if (mode === "dry_run") {
    await recordMemory({ kind: "email.dry_run", actor: { type: "user" }, subject: null, summary: `Dry run: approved “${p.draft.subject}” to ${p.draft.to.join(", ")} (not sent)`, data: { to: p.draft.to }, source: "api:/api/outbound/email" }).catch(() => undefined);
    return NextResponse.json(dryRun(KIND, p.draft), { headers: NO_STORE });
  }
  return withGoogle(async (cfg) => {
    const message = await sendMessage(cfg, p.draft);
    await recordMemory({ kind: "email.sent", actor: { type: "user" }, subject: { type: "email", id: message.id, label: p.draft.subject }, summary: `Sent “${p.draft.subject}” to ${p.draft.to.join(", ")} (approved)`, data: { to: p.draft.to, threadId: message.threadId }, source: "api:/api/outbound/email" }).catch(() => undefined);
    return NextResponse.json({ status: "ok", transport: "live", message }, { status: 201, headers: NO_STORE });
  });
}
