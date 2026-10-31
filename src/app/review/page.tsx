"use client";
// Review: the exceptions inbox — the only places a person is asked to step in (/review, or /review?run=<id> for one
// run's items and its finished artefact). See src/live/review.tsx.
import { use } from "react";
import { ReviewScreen } from "@/live/review";

export default function Review({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const q = use(searchParams);
  return <ReviewScreen runId={q.run ?? null} />;
}
