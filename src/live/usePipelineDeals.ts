"use client";
// Live companies for Today / Pipeline rows. GET /api/pipeline/deals; empty on error (never invent a company).
// `storage` is the deal-stage store's StorageInfo (the UI says when stages are not durable on this deploy).
import { useEffect, useState } from "react";
import type { PipelineDealRow } from "@/lib/inbox/pipeline";
import type { StorageInfo } from "@/lib/store/docs";

export type PipelineDeals = { deals: PipelineDealRow[]; storage: StorageInfo | null };

export function usePipelineDeals(): PipelineDeals {
  const [res, setRes] = useState<PipelineDeals>({ deals: [], storage: null });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/pipeline/deals", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const body = (await r.json()) as { deals?: PipelineDealRow[]; sources?: { stages?: { storage?: StorageInfo } } };
        if (alive) setRes({ deals: Array.isArray(body.deals) ? body.deals : [], storage: body.sources?.stages?.storage ?? null });
      } catch {
        if (alive) setRes((x) => ({ ...x, deals: [] }));
      }
    };
    void load();
    const t = window.setInterval(load, 20_000);
    return () => { alive = false; window.clearInterval(t); };
  }, []);
  return res;
}
