"use client";
// Thin wrapper: the screen lives in port/src (source of truth). Query params pick fixture variants.
// ?still=1 freezes glow, dots and entrance (film frame) · ?q=thesis|halcyon|waiting opens that question · ?demo=1 opens the demo frame
// · ?requested=<email> shows the closing band's sent state · ?state=loading|error|empty
import { use } from "react";
import { LandingScreen } from "@port/screens/landing";
import { landing } from "@port/fixtures";

type Q = { still?: string; q?: string; demo?: string; requested?: string; state?: string };
export default function Landing({ searchParams }: { searchParams: Promise<Q> }) {
  const q = use(searchParams);
  const status = q.state === "loading" || q.state === "error" || q.state === "empty" ? q.state : "ready";
  return <LandingScreen data={status === "empty" ? { ...landing, features: { ...landing.features, items: [] } } : landing} status={status} error={status === "error" ? "Couldn’t load the page. Check your connection and retry." : undefined}
    still={q.still === "1"} question={q.q} demoOpen={q.demo === "1"} requested={q.requested} />;
}
