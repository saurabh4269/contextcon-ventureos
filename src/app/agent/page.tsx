"use client";
// /agent — the Sourcing agent (deterministic, Crustdata-backed). ?q=<request> runs it on load.
// Stream: POST /api/sourcing/run (src/lib/sourcing/run.ts); UI: src/live/agent/AgentScreen.tsx.
import { Suspense } from "react";
import { AgentScreen } from "@/live/agent/AgentScreen";

export default function Agent() {
  return (
    <Suspense fallback={null}>
      <AgentScreen />
    </Suspense>
  );
}
