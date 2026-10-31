// In-process mutual exclusion by key: read-modify-write sequences on one document (or one queue) run one after the
// other instead of interleaving across awaits. This covers every request that reaches this server process (a double
// click, two tabs). Across server instances it cannot help; the stores' atomic `update` and the healing in the review
// queue cover that.
const g = globalThis as typeof globalThis & { __dealdeskLocks?: Map<string, Promise<unknown>> };
const tails = (g.__dealdeskLocks ??= new Map());

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.then(() => undefined, () => undefined);
  tails.set(key, tail);
  void tail.then(() => { if (tails.get(key) === tail) tails.delete(key); });
  return run;
}
