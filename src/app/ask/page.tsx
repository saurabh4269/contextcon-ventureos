"use client";
// Assistant: natural-language research on Crustdata via the screening agent (POST /api/live/screen). See src/live/ask.tsx.
// /ask?q=<text> runs that question once on arrival (used by the assistant dock and sidebar search).
import { use } from "react";
import { LiveAsk } from "@/live/ask";
import { liveShell } from "@/live/shell";

export default function Ask({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = use(searchParams);
  return <LiveAsk shell={liveShell} initialQuery={q?.slice(0, 2000)} />;
}
