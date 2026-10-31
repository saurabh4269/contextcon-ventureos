"use client";
// Thin wrapper: the screen lives in port/src (source of truth). Query params pick fixture variants.
import { use, useState } from "react";
import { BrainScreen } from "@port/screens/brain";
import { shellInvest, brain, brainEmptyMemories, brainLearnedFrame } from "@port/fixtures";
import type { BrainData } from "@port/types";
import { useDataMode, useLiveCoverage } from "@/components/datamode";
import { liveShellFrom } from "@/live/shell";
import { failureMessage, useLiveJson } from "@/live/useLiveJson";
import { toLiveBrain } from "@/lib/adapters/brain";
import type { MemoryEvent } from "@/lib/memory/types";
import type { Mandate } from "@/lib/settings/mandate";
import type { StorageInfo } from "@/lib/store/docs";
export default function Brain({ searchParams }: { searchParams: Promise<{ empty?: string; learned?: string; state?: string }> }) {
  const q = use(searchParams); useState(0);
  const mode = useDataMode();
  const status = q.state === "loading" || q.state === "empty" || q.state === "error" ? q.state : "ready";
  if (mode === "live" && !q.state && !q.empty && !q.learned) return <LiveBrain />;
  return <BrainScreen shell={shellInvest} key={q.learned} status={status} data={q.learned ? brainLearnedFrame(Number(q.learned)) : q.empty ? brainEmptyMemories : brain} />;
}

/**
 * Live mode: GET /api/memory/events (Postgres, or the durable store's documents) + GET /api/settings/mandate. Events
 * become memories, outcomes and pass reasons; the mandate gives the thesis lines and priors (src/lib/adapters/brain.ts).
 * No events → the screen's own empty state ("Nothing learned yet"). Nothing here is a fixture.
 */
function LiveBrain() {
  const [now] = useState(() => new Date());
  const res = useLiveJson<{ events: MemoryEvent[]; storage?: StorageInfo }>("/api/memory/events?limit=500");
  const mandate = useLiveJson<{ mandate: Mandate; source?: { note: string } }>("/api/settings/mandate");
  const storage = res.state === "ok" ? res.data.storage ?? null : null;
  useLiveCoverage(storage && !storage.durable ? "Live · memory store (not durable)" : "Live · memory store");
  const shell = liveShellFrom(shellInvest);
  if (res.state === "loading" || mandate.state === "loading") return <BrainScreen shell={shell} status="loading" data={EMPTY} />;
  if (res.state === "failed") return <BrainScreen shell={shell} status="error" error={failureMessage(res, "Firm memory")} onRetry={() => void res.reload()} data={EMPTY} />;
  if (!res.data.events.length) return <BrainScreen shell={shell} status="empty" data={EMPTY} />;
  const m = mandate.state === "ok" ? mandate.data : null;
  return <BrainScreen shell={shell} status="ready" data={toLiveBrain({ events: res.data.events, storage, mandate: m?.mandate ?? null, mandateNote: m?.source?.note ? "Firm mandate" : undefined, now })} />;
}

/** Chrome-only data for the loading / empty / error states (the screen renders the state, not these values). */
const EMPTY: BrainData = {
  kinds: [], since: "", total: 0, weekDelta: 0, trend: [], passReasons: [], passCount: 0, antiPortfolio: [], memories: [], learnedOvernight: { id: "", text: "" },
  accessLog: [], mcp: { url: "", note: "" }, exportNote: "", outcomes: [], priors: [], proposals: [], scope: "Deal Desk",
};
