"use client";
// IC memo: /memo?id=<company domain> renders the memo's numbers from GET /api/deals/:id/numbers (see src/live/memo.tsx).
import { use } from "react";
import { LiveMemo } from "@/live/memo";

export default function Memo({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const q = use(searchParams);
  return <LiveMemo id={q.id} />;
}
