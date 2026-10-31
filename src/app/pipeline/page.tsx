"use client";
// Thin wrapper: the screen lives in port/src (source of truth). Query params pick fixture variants.
import { use, useState } from "react";
import { PipelineTableScreen, PipelineBoardScreen, WatchlistScreen } from "@port/screens/pipeline";
import { shellInvest, pipelineTable, pipelineBoard, watchlist, pipelineHandoff } from "@port/fixtures";

export default function Pipeline({ searchParams }: { searchParams: Promise<{ view?: string; board?: string; handoff?: string; frame?: string; status?: "loading" | "empty" | "error"; stage?: string; q?: string; sel?: string }> }) {
  const q = use(searchParams);
  const [, setLog] = useState<string[]>([]);
  if (q.view === "watchlist") return <WatchlistScreen shell={shellInvest} data={watchlist} />;
  if (q.board) return <PipelineBoardScreen shell={shellInvest} data={q.handoff ? pipelineHandoff(Number(q.handoff)) : pipelineBoard} onMoveStage={(id, to) => setLog((l) => [...l, id + "→" + to])} />;
  return <PipelineTableScreen shell={shellInvest} data={pipelineTable} status={q.status} filter={q.stage} query={q.q} selected={q.sel?.split(",")} />;
}
