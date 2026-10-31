"use client";
// Fixture pipeline (live-site look) plus live inbound/researched companies as the first clickable rows.
import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PipelineTableScreen, PipelineBoardScreen, WatchlistScreen } from "@port/screens/pipeline";
import { shellInvest, pipelineTable, pipelineBoard, watchlist, pipelineHandoff } from "@port/fixtures";
import type { PipelineDeal } from "@port/types";
import { usePipelineDeals } from "@/live/usePipelineDeals";
import { realPipelineDeals } from "@/lib/adapters/today";
import { useDataMode } from "@/components/datamode";
import { LivePipelineTable } from "@/live/pipelineTable";

export default function Pipeline({ searchParams }: { searchParams: Promise<{ view?: string; board?: string; handoff?: string; frame?: string; status?: "loading" | "empty" | "error"; stage?: string; q?: string; sel?: string }> }) {
  const q = use(searchParams);
  const router = useRouter();
  // Pitch-like inbound and researched companies only: other inbox threads (personal mail) never become rows.
  const live = realPipelineDeals(usePipelineDeals());
  const [, setLog] = useState<string[]>([]);
  const data = useMemo(() => {
    const extra: PipelineDeal[] = live.map((d) => ({
      id: d.domain,
      company: { id: d.domain, name: d.name, initial: d.name[0] ?? d.domain[0]!, line: d.domain, domain: d.domain },
      stage: "sourced",
      nextStep: "Open deal",
      owner: "",
      thesisFit: NaN, // not scored: the fit pill reads "—"
      intro: { strength: 1, via: d.source === "inbound" ? "Inbox" : "Research" },
      lastTouch: { label: "Inbox", days: 0 },
      sector: d.source === "inbound" ? "Inbound" : "Researched",
      decision: { label: "Open deal", recommended: true },
    }));
    const seen = new Set(extra.map((x) => x.id));
    return { ...pipelineTable, deals: [...extra, ...pipelineTable.deals.filter((x) => !seen.has(x.id))] };
  }, [live]);
  const openDeal = (id: string) => {
    router.push(id.includes(".") ? `/deal?domain=${encodeURIComponent(id)}` : `/deal?id=${encodeURIComponent(id)}`);
  };
  const mode = useDataMode();
  // Live mode, plain table (no fixture view/board/status param): only real rows, no fixture deals mixed in.
  if (mode === "live" && !q.view && !q.board && !q.handoff && !q.frame && !q.status) return <LivePipelineTable pipeline={live} filter={q.stage} query={q.q} onOpenDeal={openDeal} />;
  if (q.view === "watchlist") return <WatchlistScreen shell={shellInvest} data={watchlist} />;
  if (q.board) return <PipelineBoardScreen shell={shellInvest} data={q.handoff ? pipelineHandoff(Number(q.handoff)) : pipelineBoard} onMoveStage={(id, to) => setLog((l) => [...l, id + "→" + to])} onOpenDeal={openDeal} />;
  return <PipelineTableScreen shell={shellInvest} data={data} status={q.status} filter={q.stage} query={q.q} selected={q.sel?.split(",")} onOpenDeal={openDeal} />;
}
