// Request-scoped deadline. A route runs its work inside `withDeadline(ms, fn)`; every Crustdata call made inside reads
// `remainingMs()` and never starts, retries or backs off past it, so a slow upstream yields partial results with honest
// "ran out of time" gaps instead of a request that hangs past the platform limit. Nested deadlines only shrink.
// Server-only (node:async_hooks): never import this from code that reaches the browser bundle (e.g. crustdata/http.ts).
import { AsyncLocalStorage } from "node:async_hooks";

const store = new AsyncLocalStorage<number>();

export function withDeadline<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  const at = Math.min(Date.now() + ms, store.getStore() ?? Infinity);
  return store.run(at, fn);
}

/** ms left in the current request's budget; undefined outside withDeadline. */
export function remainingMs(): number | undefined {
  const at = store.getStore();
  return at === undefined ? undefined : Math.max(0, at - Date.now());
}
