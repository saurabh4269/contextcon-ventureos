"use client";
// Agent: flows and runs come from the backend's job queue (not in this build) → unavailable state.
import { UnavailablePage } from "@/live/unavailable";

export default function Agent() {
  return <UnavailablePage screen="agent" active="agents" crumbs={[{ label: "Agents", href: "/agents" }, { label: "Agent" }]} />;
}
