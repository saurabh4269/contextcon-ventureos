// Person actions on a deal. Each mutates the deal; the API then resumes advance(). approve() is the only place a send
// can happen: live only when outboundMode()==="live" AND no recipient is blocked; otherwise it records the dry run.
import { blockedRecipients, checkRecipients, dryRun, outboundMode } from "@/lib/outbound";
import { isClosed, userName } from "@/lib/deals/stage";
import { isRunningNow, stepOf, type Deal } from "./types";

export type Senders = {
  sendMessage?: (m: { to: string[]; subject: string; body: string }) => Promise<{ id: string }>;
  insertEvent?: (e: { summary: string; start: string; end: string; description?: string }) => Promise<{ id: string }>;
};
export type Action =
  | { action: "approve"; step: "dataroom" | "schedule" }
  | { action: "transcript"; text: string; source?: "paste" | "upload"; name?: string }
  | { action: "skip_transcript" }
  | { action: "override_screen" }
  | { action: "decide"; verdict: "invest" | "pass"; note?: string }
  | { action: "resume" }
  | { action: "regenerate_memo" };

/** Field-type check before applyAction touches the deal (a wrong type there would surface as a 502). */
export function invalidAction(a: { action: string } & Record<string, unknown>): string | null {
  if (a.action === "approve" && a.step !== "dataroom" && a.step !== "schedule") return 'step must be "dataroom" or "schedule"';
  if (a.action === "transcript" && typeof a.text !== "string") return "text must be a string";
  if (a.action === "transcript" && a.name != null && typeof a.name !== "string") return "name must be a string";
  if (a.action === "decide" && a.note != null && typeof a.note !== "string") return "note must be a string";
  return null;
}

/** Who clicked: DEALDESK_USER_NAME, else "Partner (you)" (no sign-in in this build). */
export const personName = (env: Record<string, string | undefined> = process.env) => userName(env) ?? "Partner (you)";

export async function applyAction(deal: Deal, a: Action, send: Senders, now: Date, env: Record<string, string | undefined> = process.env): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!a || typeof a !== "object") return { ok: false, message: "body must be {action, …}" };
  const at = now.toISOString();
  const BY = personName(env);
  // Passed / Portfolio are terminal: nothing but a resume (to finish a failed memory write) may touch the deal
  if (isClosed(deal.stage) && a.action !== "resume") return { ok: false, message: `The deal is closed (${deal.stage}); no further actions.` };
  switch (a.action) {
    case "approve": {
      if (a.step !== "dataroom" && a.step !== "schedule") return { ok: false, message: 'approve needs step "dataroom" or "schedule"' };
      const step = stepOf(deal, a.step);
      const d = step.draft;
      if (!d) return { ok: false, message: `No ${a.step} draft yet.` };
      if (d.approved) return { ok: true };
      if (d.channel === "gmail.send" && !d.to.length) return { ok: false, message: "This draft has no recipient (no founder address and DEMO_RECIPIENT_ALLOWLIST is empty); nothing to approve." };
      if (d.channel === "calendar.insert" && !(Date.parse(d.start ?? "") > now.getTime())) return { ok: false, message: "The proposed meeting time has passed; use Resume to propose a new slot." };
      const blocked = blockedRecipients(d.to, env);
      // the Approve click is the explicit approval; a live send also needs every recipient on DEMO_RECIPIENT_ALLOWLIST
      if (outboundMode(env) === "live" && blocked.length === 0) {
        if (d.channel === "gmail.send") {
          if (!send.sendMessage) return { ok: false, message: "Gmail is not connected." };
          const check = checkRecipients(d.to, env);
          if (!check.ok) return { ok: false, message: check.message };
          const r = await send.sendMessage({ to: check.recipients, subject: d.subject, body: d.body });
          d.approved = { at, by: BY, transport: "live", result: "sent", id: r.id };
        } else {
          if (!send.insertEvent) return { ok: false, message: "Google Calendar is not connected." };
          const r = await send.insertEvent({ summary: d.subject, start: d.start!, end: d.end!, description: d.body });
          d.approved = { at, by: BY, transport: "live", result: "created on primary calendar (no attendees, sendUpdates=none)", id: r.id };
        }
      } else {
        const why = outboundMode(env) !== "live" ? "OUTBOUND_MODE is dry_run" : `recipient(s) not on the allowlist: ${blocked.join(", ")}`;
        const rec = dryRun(d.channel, { to: d.to, subject: d.subject, start: d.start, end: d.end });
        d.approved = { at, by: BY, transport: "dry_run", result: `${rec.label} (${why})` };
      }
      d.blocked = blocked;
      step.status = "done";
      step.transport = d.approved.transport;
      step.summary = d.approved.transport === "live" ? `Approved and ${d.channel === "gmail.send" ? "sent" : "created"} (${d.approved.id}).` : `Approved — ${d.approved.result}.`;
      return { ok: true };
    }
    case "transcript": {
      const text = typeof a.text === "string" ? a.text.trim() : "";
      if (!text) return { ok: false, message: "transcript text is empty" };
      if (deal.decision) return { ok: false, message: "The IC decision is already recorded; a transcript can no longer change the memo." };
      deal.transcript = { text: text.slice(0, 200_000), source: a.source === "upload" ? "upload" : "paste", name: a.name?.slice(0, 200), at };
      const s = stepOf(deal, "transcript");
      s.status = "pending";
      // later steps depend on the transcript: recompute them
      for (const id of ["valuation", "memo"] as const) if (stepOf(deal, id).status !== "pending") stepOf(deal, id).status = "pending";
      return { ok: true };
    }
    case "skip_transcript": {
      const s = stepOf(deal, "transcript");
      if (deal.transcript) return { ok: false, message: "A transcript was already provided." };
      if (s.status !== "waiting" || s.needs !== "transcript") return { ok: false, message: "The deal is not waiting for a transcript." };
      Object.assign(s, { status: "unavailable", needs: undefined, transport: "person", summary: "Continued without a transcript (no note-taker connected; none pasted).", finishedAt: at });
      return { ok: true };
    }
    case "override_screen": {
      const sc = stepOf(deal, "screen");
      if (sc.status !== "waiting" || sc.needs !== "approve_screen") return { ok: false, message: "The screen is not waiting for an override." };
      deal.screenOverride = { by: BY, at };
      sc.status = "pending";
      return { ok: true };
    }
    case "decide": {
      if (a.verdict !== "invest" && a.verdict !== "pass") return { ok: false, message: "verdict must be invest or pass" };
      if (deal.decision) return { ok: false, message: `Already decided (${deal.decision.verdict} by ${deal.decision.by}).` };
      if (stepOf(deal, "pipeline").needs !== "ic_decision") return { ok: false, message: "The deal is not at IC yet." };
      deal.decision = { verdict: a.verdict, by: BY, at, note: a.note?.slice(0, 1000) };
      stepOf(deal, "pipeline").status = "pending";
      return { ok: true };
    }
    case "regenerate_memo": {
      const s = stepOf(deal, "memo");
      if (s.status !== "done") return { ok: false, message: "No memo to regenerate yet." };
      if (deal.decision) return { ok: false, message: "The IC decision is already recorded; the memo is final." };
      s.status = "pending";
      return { ok: true };
    }
    case "resume": {
      if (isRunningNow(deal, now.getTime())) return { ok: false, message: "The deal is still running; resume when it stops." };
      // a meeting proposal nobody approved before its time passed is proposed again
      const sch = stepOf(deal, "schedule");
      if (sch.draft && !sch.draft.approved && !(Date.parse(sch.draft.start ?? "") > now.getTime())) { sch.status = "pending"; sch.draft = undefined; }
      // error / stale running steps retry; an "unavailable" step (a failed Crustdata or Gmail call) retries too, except
      // one a person chose to skip
      for (const s of deal.steps) if (s.status === "error" || s.status === "running" || (s.status === "unavailable" && s.transport !== "person")) s.status = "pending";
      return { ok: true };
    }
    default:
      return { ok: false, message: "unknown action" };
  }
}
