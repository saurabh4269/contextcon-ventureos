"use client";
// Deals actually worked on this server: GET /api/exceptions → domains (item subjects + deal runs), then per domain
// GET /api/live/research (name, sector, logo; server-cached) and GET /api/deals/:domain/decisions?review=0 (fit score,
// verdicts; reading does not raise review items). A failing per-deal call leaves that deal's part null, never invented.
import { useCallback, useEffect, useState } from "react";
import type { ExceptionsResponse } from "@/lib/exceptions/types";
import type { DecisionsResponse } from "@/lib/numbers/decisions";
import type { ResearchResult } from "@/lib/live/types";
import { knownDeals, type KnownDeal } from "@/lib/adapters/today";
import type { Fetched } from "./useLiveJson";

const MAX_DEALS = 12;

async function getJson<T>(url: string): Promise<Fetched<T>> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    const body = await r.json().catch(() => null);
    return r.ok ? { state: "ok", data: body as T } : { state: "failed", status: r.status, body };
  } catch (e) {
    return { state: "failed", status: 0, body: { status: "error", message: `Network error: ${e instanceof Error ? e.message : String(e)}` } };
  }
}

export type KnownDeals = { exceptions: ExceptionsResponse; deals: KnownDeal[] };

export function useKnownDeals(opts: { withDeals?: boolean } = {}): Fetched<KnownDeals> & { reload: () => void } {
  const withDeals = opts.withDeals ?? true;
  const [res, setRes] = useState<Fetched<KnownDeals>>({ state: "loading" });
  const load = useCallback(async () => {
    setRes({ state: "loading" });
    const ex = await getJson<ExceptionsResponse>("/api/exceptions?status=all");
    if (ex.state !== "ok") return setRes(ex as Fetched<KnownDeals>);
    // a body that is not the queue (a proxy page, an old server) is a failure, not an empty list
    if (!Array.isArray(ex.data?.items) || !Array.isArray(ex.data?.runs)) return setRes({ state: "failed", status: 200, body: { status: "error", message: "The review queue answered with an unexpected body." } });
    const base = knownDeals(ex.data, MAX_DEALS);
    const deals = withDeals
      ? await Promise.all(base.map(async (k) => {
          const enc = encodeURIComponent(k.domain);
          const [r, d] = await Promise.all([getJson<ResearchResult>(`/api/live/research?domain=${enc}`), getJson<DecisionsResponse>(`/api/deals/${enc}/decisions?review=0`)]);
          return { ...k, research: r.state === "ok" && r.data.status === "ok" ? r.data : null, decisions: d.state === "ok" ? d.data : null };
        }))
      : base;
    setRes({ state: "ok", data: { exceptions: ex.data, deals } });
  }, [withDeals]);
  useEffect(() => { void load(); }, [load]);
  return { ...res, reload: () => void load() } as Fetched<KnownDeals> & { reload: () => void };
}
