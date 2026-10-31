"use client";
// Pipeline: no deal store in this build (builder backend) → unavailable state, plus live research and the companies
// researched so far (from organizational memory).
import { UnavailablePage } from "@/live/unavailable";
import { MemoryPanel } from "@/live/memory";
import { ResearchForm } from "@/live/deal";

export default function Pipeline() {
  return (
    <UnavailablePage screen="pipeline" active="pipeline">
      <ResearchForm />
      <MemoryPanel className="mt-6" title="Researched companies" sub="Every research run, from organizational memory." match={(e) => e.kind === "research.run" || e.kind === "deal.opened"} note={false} />
    </UnavailablePage>
  );
}
