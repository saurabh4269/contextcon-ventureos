"use client";
// Thin wrapper: the screen lives in port/src (source of truth). Query params pick fixture variants.
// v4 · /memo?id=helio · &status=loading|empty|error · frames: &share=1 &vote=1 &queued=1 &edit=<section> &override=0 &cite=<n>
import { use, useState } from "react";
import { MemoScreen } from "@port/screens/memo";
import { shellInvest, memo } from "@port/fixtures";
import { helioMemoDoc } from "@port/fixtures/heliomemo";
import type { LoadStatus } from "@port/types";
type Q = { pin?: string; priors?: string; id?: string; status?: string; share?: string; vote?: string; queued?: string; edit?: string; override?: string; cite?: string };
export default function Memo({ searchParams }: { searchParams: Promise<Q> }) {
  const q = use(searchParams); useState(0);
  const status = (["loading", "empty", "error"] as const).find((s) => s === q.status) as LoadStatus | undefined;
  if (q.id === "helio") return (
    <MemoScreen shell={shellInvest} data={helioMemoDoc} status={status} error="Couldn’t load the Helio Sensors memo" onRetry={() => window.location.reload()} pinSources={q.pin === "1"}
      initial={{ share: q.share === "1", vote: q.vote === "1" || q.queued === "1", queued: q.queued === "1", edit: q.edit, override: q.override === "0" ? false : undefined, cite: q.cite ? Number(q.cite) : undefined }} />
  );
  return <MemoScreen shell={shellInvest} data={q.priors === "0" ? { ...memo, priors: undefined } : memo} status={status} pinSources={q.pin === "1"} />;
}
