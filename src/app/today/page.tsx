"use client";
// Today: inbound, meetings and approvals need Gmail + Calendar + the backend (none connected here) → unavailable state
// with real connector status. What did happen today is shown live from organizational memory.
import { UnavailablePage } from "@/live/unavailable";
import { MemoryPanel } from "@/live/memory";
import { fmtDate } from "@/lib/format";

export default function Today() {
  const today = fmtDate(new Date().toISOString());
  return (
    <UnavailablePage screen="today" active="today">
      <MemoryPanel title="Today’s activity" sub={`Actions recorded today (${today}, IST), live.`} match={(e) => fmtDate(e.at) === today} />
    </UnavailablePage>
  );
}
