// One person action on one deal, serialised per deal id: read → check not running → apply → claim the run → save, all
// inside the store's atomic update, so two concurrent requests (a double click, two tabs) can never both pass the same
// check. The second sees the first's result (approve twice = one send; decide twice = one decision). The caller then
// starts advance() on the returned deal, which is already marked running.
import { withLock } from "@/lib/store/lock";
import { applyAction, approvePrecheck, invalidAction, livePlan, markSending, personName, recordSent, type Action, type Senders } from "./actions";
import type { createWorkflowStore } from "./store";
import { isClosed } from "@/lib/deals/stage";
import { isRunningNow, type Deal } from "./types";

export type Dispatched = { ok: true; deal: Deal } | { ok: false; status: 400 | 404 | 409 | 502; message: string };

// per-deal in-process chain (the store's update is also atomic; this keeps the Gmail call out of any interleaving)
export const withDealLock = <R>(id: string, fn: () => Promise<R>): Promise<R> => withLock(`workflow:${id}`, fn);

export async function dispatchAction(
  store: Pick<ReturnType<typeof createWorkflowStore>, "update">,
  id: string,
  a: unknown,
  send: Senders,
  now: Date,
  env: Record<string, string | undefined> = process.env,
): Promise<Dispatched> {
  const act = a as (Action & Record<string, unknown>) | null;
  if (!act || typeof act !== "object" || Array.isArray(act) || typeof act.action !== "string") return { ok: false, status: 400, message: "body must be {action, …}" };
  const invalid = invalidAction(act);
  if (invalid) return { ok: false, status: 400, message: invalid };
  return withDealLock(id, async () => {
    if (act.action === "approve") return approveTwoPhase(store, id, act as Extract<Action, { action: "approve" }>, send, now, env);
    let result: Dispatched = { ok: false, status: 404, message: "no such deal" };
    try {
      await store.update(id, async (cur) => {
        if (!cur) return undefined;
        if (isRunningNow(cur, now.getTime())) { result = { ok: false, status: 409, message: "The deal is still running; try again when it stops." }; return undefined; }
        const r = await applyAction(cur, act, send, now, env);
        if (!r.ok) { result = { ok: false, status: (r as { conflict?: true }).conflict ? 409 : 400, message: r.message }; return undefined; }
        cur.running = true; // claim: nobody else may act until this run stops saving (stale after RUN_STALE_MS)
        cur.updatedAt = now.toISOString();
        result = { ok: true, deal: cur };
        return cur;
      });
    } catch (e) {
      return { ok: false, status: 502, message: e instanceof Error ? e.message : String(e) };
    }
    return result;
  });
}

/**
 * Approve. A live send is at-most-once, in three phases:
 *  1. atomic update: checks pass, the draft is marked `sending` (with a timestamp) and persisted; nothing sent yet;
 *  2. the send, outside any stored state transition;
 *  3. second atomic update: `approved` with the real id, `sending` cleared, run claimed.
 * If phase 3 cannot be written the mark stays, so every later approve is refused (409) until a person resolves it
 * (resolve_send). A send that threw clears the mark only for an httpStatus 400..499; any other error keeps it.
 * Dry runs (and an already approved draft) stay single-phase: one update through applyAction.
 */
async function approveTwoPhase(store: Pick<ReturnType<typeof createWorkflowStore>, "update">, id: string, act: Extract<Action, { action: "approve" }>, send: Senders, now: Date, env: Record<string, string | undefined>): Promise<Dispatched> {
  const by = personName(env);
  let out: Dispatched = { ok: false, status: 404, message: "no such deal" };
  let exec: (() => Promise<{ id: string; result: string }>) | null = null;
  try {
    await store.update(id, async (cur) => {
      if (!cur) return undefined;
      if (isRunningNow(cur, now.getTime())) { out = { ok: false, status: 409, message: "The deal is still running; try again when it stops." }; return undefined; }
      if (isClosed(cur.stage)) { out = { ok: false, status: 400, message: `The deal is closed (${cur.stage}); no further actions.` }; return undefined; }
      const pre = approvePrecheck(cur, act, now);
      if (!pre.ok) { out = { ok: false, status: pre.conflict ? 409 : 400, message: pre.message }; return undefined; }
      if (pre.already) { cur.running = true; cur.updatedAt = now.toISOString(); out = { ok: true, deal: cur }; return cur; }
      const plan = livePlan(pre.d, send, env);
      if (!plan.ok) { out = { ok: false, status: 400, message: plan.message }; return undefined; }
      if (!plan.exec) {
        const r = await applyAction(cur, act, send, now, env); // dry run: single phase
        if (!r.ok) { out = { ok: false, status: 400, message: r.message }; return undefined; }
        cur.running = true; cur.updatedAt = now.toISOString();
        out = { ok: true, deal: cur };
        return cur;
      }
      markSending(cur, pre.stepId, now, by);
      cur.updatedAt = now.toISOString();
      exec = plan.exec;
      out = { ok: true, deal: cur };
      return cur;
    });
  } catch (e) {
    return { ok: false, status: 502, message: e instanceof Error ? e.message : String(e) };
  }
  if (!exec || !out.ok) return out;
  // phase 2: the send
  let sent: { id: string; result: string };
  try {
    sent = await (exec as () => Promise<{ id: string; result: string }>)();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // strict at-most-once: only a 4xx from Google (rejected, nothing delivered) clears the mark; a network error,
    // timeout, 5xx or an error without a status may have been delivered, so the mark stays until a person resolves it
    const status = (e as { httpStatus?: unknown } | null)?.httpStatus;
    if (typeof status === "number" && status >= 400 && status <= 499) {
      await store.update(id, (cur) => { const d = cur?.steps.find((s) => s.id === act.step)?.draft; if (!cur || !d?.sending) return undefined; d.sending = undefined; return cur; }).catch(() => undefined);
      return { ok: false, status: 502, message };
    }
    return { ok: false, status: 502, message: `${message}. The outcome is unknown (it may have been delivered): check the Sent folder / calendar, then resolve_send (confirm_sent or discard_send). It will not be retried automatically.` };
  }
  // phase 3: record it
  try {
    await store.update(id, (cur) => {
      if (!cur) return undefined;
      recordSent(cur, act.step, sent, now, by);
      cur.running = true; cur.updatedAt = now.toISOString();
      out = { ok: true, deal: cur };
      return cur;
    });
  } catch (e) {
    return { ok: false, status: 502, message: `The ${act.step === "schedule" ? "event was created" : "message was sent"} (id ${sent.id}) but the result could not be saved (${e instanceof Error ? e.message : String(e)}). The draft stays marked as sending and will not be sent again: confirm it, then resolve_send.` };
  }
  return out;
}
