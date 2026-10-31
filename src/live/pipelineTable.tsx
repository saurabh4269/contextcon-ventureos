"use client";
// Live Pipeline on the port PipelineTableScreen (same component as the fixture page): deals worked on this server
// (exceptions → decisions + research) and GET /api/pipeline/deals companies (passed in by the page). See
// src/lib/adapters/pipeline.ts. No fixture rows.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PipelineTableScreen } from "@port/screens/pipeline";
import { shellInvest } from "@port/fixtures";
import type { PipelineDealRow } from "@/lib/inbox/pipeline";
import type { StorageInfo } from "@/lib/store/docs";
import { liveRows, realPipelineDeals } from "@/lib/adapters/today";
import { toLivePipeline } from "@/lib/adapters/pipeline";
import { useLiveCoverage } from "@/components/datamode";
import { failureMessage } from "./useLiveJson";
import { useKnownDeals } from "./known";
import { liveShellFrom } from "./shell";

export function LivePipelineTable({ pipeline, storage, filter, query, onOpenDeal }: { pipeline: PipelineDealRow[]; storage?: StorageInfo | null; filter?: string; query?: string; onOpenDeal: (id: string) => void }) {
  const router = useRouter();
  const [now] = useState(() => new Date());
  const known = useKnownDeals();
  const extra = realPipelineDeals(pipeline);
  useLiveCoverage(extra.some((d) => d.source === "inbound") ? "Live · Crustdata · Gmail" : "Live · Crustdata");
  const shell = liveShellFrom(shellInvest);
  const deals = known.state === "ok" ? known.data.deals : [];
  // say where stages live only when that matters: not durable on this deploy
  const data = toLivePipeline(liveRows(deals, extra, now), now, { storageNote: storage && !storage.durable ? storage.label.toLowerCase() : undefined });
  const status = known.state === "loading" ? "loading" : known.state === "failed" && !extra.length ? "error" : undefined;
  return <PipelineTableScreen shell={shell} data={data} status={status} error={known.state === "failed" ? failureMessage(known, "Deals") : undefined} onRetry={known.reload}
    filter={filter} query={query} onOpenDeal={(id) => { const w = extra.find((d) => d.domain === id)?.workflowId; if (w) router.push(`/workflow?id=${encodeURIComponent(w)}`); else onOpenDeal(id); }} onAddDeal={() => router.push("/deal")} />;
}
