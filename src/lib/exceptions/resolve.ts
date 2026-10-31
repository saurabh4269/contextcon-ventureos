// Resolve or raise a review item as one serialised read-modify-write: two requests for the queue in this process
// (a double click on Approve, Approve then Reject) run one after the other, so the second sees "Already approved"
// (409) instead of overwriting the first decision and sending its dry-run twice.
import { docStore, type DocStore } from "@/lib/store/docs";
import { withLock } from "@/lib/store/lock";
import { decisionKeyOf, parseEntered } from "./decisions";
import { ExceptionError, loadExceptionStore } from "./store";
import type { ExceptionAction, ExceptionItem, RaiseInput, RunRecord } from "./types";

const KEY = "review-queue";

export function resolveOnce(id: string, action: ExceptionAction, opts: { note?: string; value?: string; by?: string } = {}, docs: DocStore = docStore()): Promise<{ item: ExceptionItem; run: RunRecord | null; open: number }> {
  return withLock(KEY, async () => {
    const store = await loadExceptionStore(docs);
    // A value that cannot be used (a fit score of "abc") is refused now. Stored, it would resolve the item for good:
    // decision items are never raised again once resolved, so the person could not enter a real value afterwards.
    const target = action === "edit" ? store.get(id) : null;
    const dk = target ? decisionKeyOf(target) : null;
    if (dk) {
      const entered = parseEntered(dk, opts.value ?? "");
      if ("error" in entered) throw new ExceptionError(400, `That value was not used: ${entered.error}.`);
    }
    const { item, run } = store.resolveException(id, action, opts);
    await store.flush();
    return { item, run, open: store.openCount() };
  });
}

export function raiseOnce(input: RaiseInput, docs: DocStore = docStore()): Promise<{ item: ExceptionItem; open: number }> {
  return withLock(KEY, async () => {
    const store = await loadExceptionStore(docs);
    const item = store.raiseException(input);
    await store.flush();
    return { item, open: store.openCount() };
  });
}
