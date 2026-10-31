"use client";
// Thin wrapper: the screen lives in port/src (source of truth). Query params pick the view.
// /agents · ?tab=runs · ?status=live|paused|attention · ?q=<search> · ?filter=<run filter id> · ?agent=<id> opens a row · ?state=loading|empty|error
import { use } from "react";
import { useRouter } from "next/navigation";
import { AgentsScreen, type AgentStatusFilter } from "@port/screens/agents";
import { shellInvest, agentsList } from "@port/fixtures";
import { ROUTES } from "@port/routes";
import { useDataMode } from "@/components/datamode";
import { UnavailablePage } from "@/live/unavailable";
import type { LoadStatus } from "@port/types";

type Q = { tab?: string; status?: string; q?: string; filter?: string; agent?: string; state?: string };
export default function Agents({ searchParams }: { searchParams: Promise<Q> }) {
  const q = use(searchParams);
  const router = useRouter();
  const mode = useDataMode();
  // Live mode: no agent runtime lists agents here, so no fixture agents (the Sourcing agent and Ask are the live agents).
  if (mode === "live") return <UnavailablePage screen="agents" active="agents" />;
  const state = (["loading", "empty", "error"].includes(q.state ?? "") ? q.state : "ready") as LoadStatus;
  const sf = (["live", "paused", "attention"].includes(q.status ?? "") ? q.status : "all") as AgentStatusFilter;
  return (
    <AgentsScreen shell={shellInvest} data={agentsList} status={state} tab={q.tab === "runs" ? "runs" : "agents"} statusFilter={sf} runFilter={q.filter} query={q.q} open={q.agent}
      onTab={(t) => router.replace(t === "runs" ? ROUTES.runs : ROUTES.agents, { scroll: false })}
      onNewAgent={() => router.push(ROUTES.agentFlow("inbound"))}
      onRetry={() => router.replace(ROUTES.agents)} />
  );
}
