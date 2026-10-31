"use client";
// Thin wrapper: the screen lives in port/src (source of truth). Query params pick fixture variants.
import { use, useState } from "react";
import { DealScreen, RestrictedDealScreen } from "@port/screens/deal";
import { shellInvest, deal, dealTeamOpenVariant, restrictedDeal, helioDealSignals, helioAskEmpty, assistantAt } from "@port/fixtures";
import type { LoadStatus } from "@port/types";
import { AssistantHost } from "@port/components/askctx";
import { AssistantDock } from "@port/components/assistant";
import { LiveRail } from "@port/components/liverail";
export default function Deal({ searchParams }: { searchParams: Promise<{ team?: string; restricted?: string; pin?: string; id?: string; ask?: string; tab?: string; t?: string; graph?: string; sg?: string; alert?: string; reviewer?: string; status?: string }> }) {
  const q = use(searchParams);
  // v4 · Signals (Crustdata signal graph): ?tab=signals · freeze with ?t=<ms> or ?graph=<frame 0..5> · state ?sg=loading|empty|error
  const sigFrames = helioDealSignals.signals!.frames;
  const signalsAt = q.t != null ? Number(q.t) : q.graph != null ? sigFrames[Math.min(sigFrames.length - 1, Number(q.graph))] : undefined;
  // v4 · ?tab=<outline id> (signals | overview | revenue | team | customers | market | cap | valuation); the rail and [ ] keep the URL in step.
  const [view, setView] = useState<string | undefined>(signalsAt != null || q.sg ? "signals" : q.tab);
  const onOutline = (id: string) => {
    setView(id);
    const u = new URL(window.location.href); u.searchParams.set("tab", id); window.history.replaceState(null, "", u);
  };
  // v4 · diligence alert frames: ?alert=sheet (draft open) | saved | requested | done (both) · ?reviewer=1 · ?status=loading|error
  const alertInit = q.alert ? { sheet: q.alert === "sheet", saved: q.alert === "saved" || q.alert === "done", requested: q.alert === "requested" || q.alert === "done" } : undefined;
  const status = q.status === "loading" || q.status === "error" ? q.status : undefined;
  if (q.restricted) return <RestrictedDealScreen shell={shellInvest} data={restrictedDeal} channel="#deal-falcon" />;
  // v3.2: ?ask=1..6 opens the docked assistant at that frame (empty → thinking → answer → follow-ups). ⌘K opens it at frame 1.
  if (q.id === "helio") return (
    <AssistantHost defaultOpen={!!q.ask} dock={<AssistantDock data={q.ask ? assistantAt(Number(q.ask)) : helioAskEmpty} top={helioDealSignals.live && <LiveRail run={helioDealSignals.live} />} />}>
      <DealScreen shell={shellInvest} data={helioDealSignals} status={status} error="Couldn’t load Helio Sensors" pinSources={q.pin === "1"} view={view} onOutline={onOutline} signalsAt={signalsAt} signalsStatus={q.sg as LoadStatus | undefined} alertInit={alertInit} reviewerAdded={q.reviewer === "1"} onRetry={() => window.location.reload()} />
    </AssistantHost>
  );
  return <DealScreen shell={shellInvest} data={q.team === "open" ? dealTeamOpenVariant : deal} pinSources={q.pin === "1"} />;
}
