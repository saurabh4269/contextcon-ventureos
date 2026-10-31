"use client";
// Agents: no live data source in this build → unavailable state with the real status of what it needs (src/live/sources.ts).
import { UnavailablePage } from "@/live/unavailable";

export default function Agents() {
  return <UnavailablePage screen="agents" active="agents" />;
}
