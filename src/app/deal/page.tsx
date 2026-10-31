"use client";
// Deal page: /deal?domain=e2b.dev (or ?company=) researches the company live on Crustdata; ?tab=<section> keeps the
// open section in the URL. Without a domain it asks for one. See src/live/deal.tsx.
import { use } from "react";
import { LiveDeal } from "@/live/deal";
import { liveShell } from "@/live/shell";

export default function Deal({ searchParams }: { searchParams: Promise<{ domain?: string; company?: string; tab?: string }> }) {
  const q = use(searchParams);
  return <LiveDeal shell={liveShell} domain={q.domain ?? q.company} tab={q.tab} />;
}
