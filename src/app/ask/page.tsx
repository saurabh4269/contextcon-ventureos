"use client";
// Assistant: natural-language research on Crustdata via the screening agent (POST /api/live/screen). See src/live/ask.tsx.
import { LiveAsk } from "@/live/ask";
import { liveShell } from "@/live/shell";

export default function Ask() {
  return <LiveAsk shell={liveShell} />;
}
