"use client";
// Thin wrapper: the screen lives in port/src (source of truth). Query params pick fixture variants.
import { use, useState } from "react";
import { BrainScreen } from "@port/screens/brain";
import { shellInvest, brain, brainEmptyMemories, brainLearnedFrame } from "@port/fixtures";
export default function Brain({ searchParams }: { searchParams: Promise<{ empty?: string; learned?: string; state?: string }> }) {
  const q = use(searchParams); useState(0);
  const status = q.state === "loading" || q.state === "empty" || q.state === "error" ? q.state : "ready";
  return <BrainScreen shell={shellInvest} key={q.learned} status={status} data={q.learned ? brainLearnedFrame(Number(q.learned)) : q.empty ? brainEmptyMemories : brain} />;
}
