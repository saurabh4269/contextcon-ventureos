"use client";
// v3.2 · Agent page (Helio steps). ?frame=1..13 freezes the run · ?tone=mono · ?dock=0 hides the assistant.
// v3.4 · ?view=flow → "How this agent works" canvas. ?agent=inbound (default) | helio · ?run=1 plays the run · ?t=ms | ?frame=n freezes it
//        · ?node=<id> opens a node's settings · ?modal=guardrails · ?status=loading|empty|error
import { use } from "react";
import { useRouter } from "next/navigation";
import { AgentScreen } from "@port/screens/agent";
import { AgentFlowScreen } from "@port/screens/agentflow";
import { flowFrameMs } from "@port/components/flowcanvas";
import { shellInvest, helioAgent, helioAssistant, agentRunAt, agentFlows } from "@port/fixtures";
import type { LoadStatus } from "@port/types";
import { useDataMode } from "@/components/datamode";
import { namedLiveAgent } from "@/lib/datamode";
import { AgentScreen as LiveAgentScreen } from "@/live/agent/AgentScreen";

type Q = { id?: string; view?: string; frame?: string; tone?: string; dock?: string; agent?: string; run?: string; t?: string; node?: string; modal?: string; status?: string; q?: string };
export default function Agent({ searchParams }: { searchParams: Promise<Q> }) {
  const q = use(searchParams);
  const router = useRouter();
  const mode = useDataMode();
  // Live mode: the request box of the Sourcing agent, never the fixture Helio flow. ?q= auto-runs it.
  if (mode === "live" || namedLiveAgent(q)) return <LiveAgentScreen />;
  if (q.view === "flow" || q.agent === "inbound") {
    const data = agentFlows[q.agent ?? q.id ?? "inbound"] ?? agentFlows.inbound;
    const frozenMs = q.t != null ? Number(q.t) : q.frame != null ? flowFrameMs(data, Number(q.frame)) : undefined;
    const status = (["loading", "empty", "error"].includes(q.status ?? "") ? q.status : "ready") as LoadStatus;
    return <AgentFlowScreen key={`${data.id}${q.t}${q.frame}${q.run}`} shell={shellInvest} data={data} autoplay={q.run === "1"} frozenMs={frozenMs} node={q.node ?? null} modal={q.modal === "guardrails"} status={status} />;
  }
  const run = q.frame ? agentRunAt(Number(q.frame)) : undefined;
  return <AgentScreen shell={shellInvest} data={helioAgent} assistant={q.dock === "0" ? undefined : helioAssistant} view="steps" run={run} tone={q.tone === "mono" ? "mono" : "warm"} onView={(v) => v === "flow" && router.push("/agent?view=flow&agent=helio")} />;
}
