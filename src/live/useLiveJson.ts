"use client";
import { useCallback, useEffect, useState } from "react";

export type Fetched<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "failed"; status: number; body: { status?: string; message?: string; reason?: string } | null };

/**
 * GET a same-origin JSON route. Non-2xx responses are surfaced as `failed` with the server's failure body
 * (not_connected / unavailable / error) so screens can render the right state — nothing falls back to fixtures.
 */
export function useLiveJson<T>(url: string | null): Fetched<T> & { reload: (fresh?: boolean) => Promise<Fetched<T>> } {
  const [res, setRes] = useState<Fetched<T>>({ state: "loading" });
  const load = useCallback(
    async (fresh = false): Promise<Fetched<T>> => {
      if (!url) return { state: "loading" };
      setRes({ state: "loading" });
      let out: Fetched<T>;
      try {
        const r = await fetch(fresh ? `${url}${url.includes("?") ? "&" : "?"}fresh=1` : url, { cache: "no-store" });
        const body = await r.json().catch(() => null);
        out = r.ok ? { state: "ok", data: body as T } : { state: "failed", status: r.status, body };
      } catch (e) {
        out = { state: "failed", status: 0, body: { status: "error", message: `Network error: ${e instanceof Error ? e.message : String(e)}` } };
      }
      setRes(out);
      return out;
    },
    [url],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return { ...res, reload: load } as Fetched<T> & { reload: (fresh?: boolean) => Promise<Fetched<T>> };
}

/** Human message for a failed live call. */
export function failureMessage(f: Extract<Fetched<unknown>, { state: "failed" }>, what: string): string {
  const m = f.body?.message;
  if (f.body?.status === "not_connected") return m ?? `${what}: not connected.`;
  if (f.body?.status === "unavailable") return `${what}: unavailable — ${f.body.reason ?? m ?? "no reason given"}`;
  return m ? `${what}: ${m}` : `${what} failed (HTTP ${f.status}).`;
}
