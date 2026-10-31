// Person actions on a deal. Each mutates the deal; the API then resumes advance(). approve() is the only place a send
// can happen: live only when outboundMode()==="live" AND no recipient is blocked; otherwise it records the dry run.
import { blockedRecipients, checkRecipients, dryRun, outboundMode } from "@/lib/outbound";
import { userName } from "@/lib/deals/stage";
import { stepOf, type Deal } from "./types";

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

/** Who clicked: DEALDESK_USER_NAME, else "Partner (you)" (no sign-in in this build). */
export const personName = (env: Record<string, string | undefined> = process.env) => userName(env) ?? "Partner (you)";

export async function applyAction(deal: Deal, a: Action, send: Senders, now: Date, env: Record<string, string | undefined> = process.env): Promise<{ ok: true } | { ok: false; message: string }> {
  const at = now.toISOString();
  const BY = personName(env);
  switch (a.action) {
    case "approve": {
      const step = stepOf(deal, a.step);
      const d = step.draft;
      if (!d) return { ok: false, message: `No ${a.step} draft yet.` };
      if (d.approved) return { ok: true };
      const blocked = blockedRecipients(d.to, env);
      d.blocked = blocked;
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
      step.status = "done";
      step.transport = d.approved.transport;
      step.summary = d.approved.transport === "live" ? `Approved and ${d.channel === "gmail.send" ? "sent" : "created"} (${d.approved.id}).` : `Approved — ${d.approved.result}.`;
      return { ok: true };
    }
    case "transcript": {
      const text = a.text?.trim();
      if (!text) return { ok: false, message: "transcript text is empty" };
      deal.transcript = { text: text.slice(0, 200_000), source: a.source === "upload" ? "upload" : "paste", name: a.name?.slice(0, 200), at };
      const s = stepOf(deal, "transcript");
      s.status = "pending";
      // later steps depend on the transcript: recompute them
      for (const id of ["valuation", "memo"] as const) if (stepOf(deal, id).status !== "pending") stepOf(deal, id).status = "pending";
      return { ok: true };
    }
    case "skip_transcript": {
      const s = stepOf(deal, "transcript");
      Object.assign(s, { status: "unavailable", needs: undefined, transport: "person", summary: "Continued without a transcript (no note-taker connected; none pasted).", finishedAt: at });
      return { ok: true };
    }
    case "override_screen": {
      deal.screenOverride = { by: BY, at };
      stepOf(deal, "screen").status = "pending";
      return { ok: true };
    }
    case "decide": {
      if (a.verdict !== "invest" && a.verdict !== "pass") return { ok: false, message: "verdict must be invest or pass" };
      if (stepOf(deal, "pipeline").needs !== "ic_decision") return { ok: false, message: "The deal is not at IC yet." };
      deal.decision = { verdict: a.verdict, by: BY, at, note: a.note?.slice(0, 1000) };
      stepOf(deal, "pipeline").status = "pending";
      return { ok: true };
    }
    case "regenerate_memo": {
      const s = stepOf(deal, "memo");
      if (s.status !== "done") return { ok: false, message: "No memo to regenerate yet." };
      s.status = "pending";
      return { ok: true };
    }
    case "resume":
      for (const s of deal.steps) if (s.status === "error" || s.status === "running") s.status = "pending";
      return { ok: true };
    default:
      return { ok: false, message: "unknown action" };
  }
}
