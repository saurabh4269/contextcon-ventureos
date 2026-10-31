"use client";
// Thin wrapper: the screen lives in port/src (source of truth). Query params pick fixture variants.
import { use, useState } from "react";
import { BrainScreen } from "@port/screens/brain";
import { shellInvest, brain, brainEmptyMemories, brainLearnedFrame } from "@port/fixtures";
import type { BrainData } from "@port/types";
import { useDataMode, useLiveCoverage } from "@/components/datamode";
import { liveShellFrom } from "@/live/shell";
import { useLiveJson } from "@/live/useLiveJson";
export default function Brain({ searchParams }: { searchParams: Promise<{ empty?: string; learned?: string; state?: string }> }) {
  const q = use(searchParams); useState(0);
  const mode = useDataMode();
  const status = q.state === "loading" || q.state === "empty" || q.state === "error" ? q.state : "ready";
  if (mode === "live" && !q.state && !q.empty && !q.learned) return <LiveBrain />;
  return <BrainScreen shell={shellInvest} key={q.learned} status={status} data={q.learned ? brainLearnedFrame(Number(q.learned)) : q.empty ? brainEmptyMemories : brain} />;
}

/**
 * Live mode: GET /api/memory/events. Unavailable (no store configured) or no events → the screen's own empty state
 * ("Nothing learned yet"). With events the firm-brain views (outcomes, pass reasons, priors) still have no live source,
 * so the page keeps the fixture brain and the layout's "Demo data" badge.
 */
function LiveBrain() {
  const res = useLiveJson<{ events: unknown[] }>("/api/memory/events?limit=1");
  const none = res.state === "failed" ? res.status === 503 : res.state === "ok" && res.data.events.length === 0;
  useLiveCoverage(!none ? null : res.state === "failed" ? "Live · memory store not configured" : "Live · memory store");
  if (res.state === "loading") return <BrainScreen shell={liveShellFrom(shellInvest)} status="loading" data={EMPTY} />;
  if (none) return <BrainScreen shell={liveShellFrom(shellInvest)} status="empty" data={EMPTY} />;
  if (res.state === "failed") return <BrainScreen shell={liveShellFrom(shellInvest)} status="error" error="Couldn’t read the memory store." onRetry={() => void res.reload()} data={EMPTY} />;
  return <BrainScreen shell={shellInvest} status="ready" data={brain} />;
}

/** Chrome-only data for the loading / empty / error states (the screen renders the state, not these values). */
const EMPTY: BrainData = {
  kinds: [], since: "", total: 0, weekDelta: 0, trend: [], passReasons: [], passCount: 0, antiPortfolio: [], memories: [], learnedOvernight: { id: "", text: "" },
  accessLog: [], mcp: { url: "", note: "" }, exportNote: "", outcomes: [], priors: [], proposals: [], scope: "Deal Desk",
};
