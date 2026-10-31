"use client";
// Live companies for Today / Pipeline rows. GET /api/pipeline/deals; empty on error (never invent a company).
import { useEffect, useState } from "react";
import type { PipelineDealRow } from "@/lib/inbox/pipeline";

export function usePipelineDeals(): PipelineDealRow[] {
  const [deals, setDeals] = useState<PipelineDealRow[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/pipeline/deals", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const body = (await r.json()) as { deals?: PipelineDealRow[] };
        if (alive) setDeals(Array.isArray(body.deals) ? body.deals : []);
      } catch {
        if (alive) setDeals([]);
      }
    };
    void load();
    const t = window.setInterval(load, 20_000);
    return () => { alive = false; window.clearInterval(t); };
  }, []);
  return deals;
}
