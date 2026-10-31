// One person action on one deal, serialised per deal id: read → check not running → apply → claim the run → save, all
// inside the store's atomic update, so two concurrent requests (a double click, two tabs) can never both pass the same
// check. The second sees the first's result (approve twice = one send; decide twice = one decision). The caller then
// starts advance() on the returned deal, which is already marked running.
import { withLock } from "@/lib/store/lock";
import { applyAction, invalidAction, type Action, type Senders } from "./actions";
import type { createWorkflowStore } from "./store";
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
    let result: Dispatched = { ok: false, status: 404, message: "no such deal" };
    try {
      await store.update(id, async (cur) => {
        if (!cur) return undefined;
        if (isRunningNow(cur, now.getTime())) { result = { ok: false, status: 409, message: "The deal is still running; try again when it stops." }; return undefined; }
        const r = await applyAction(cur, act, send, now, env);
        if (!r.ok) { result = { ok: false, status: 400, message: r.message }; return undefined; }
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
