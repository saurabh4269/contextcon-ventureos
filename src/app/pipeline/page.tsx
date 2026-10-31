"use client";
// Pipeline: no deal store in this build (builder backend) → unavailable state, plus live research and the companies
// researched so far (from organizational memory).
import Link from "next/link";
import { Search } from "lucide-react";
import { UnavailablePage } from "@/live/unavailable";
import { MemoryPanel } from "@/live/memory";
import { ResearchForm } from "@/live/deal";

export default function Pipeline() {
  return (
    <UnavailablePage screen="pipeline" active="pipeline">
      <Link href="/agent" data-testid="find-companies" className="mx-auto mb-6 flex max-w-[560px] items-center gap-3 rounded-2xl border border-[#ecd9c6] bg-[#faf3ec] px-4 py-3 text-left transition-colors hover:border-rust/40">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-rust text-white"><Search className="size-4" /></span>
        <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-medium text-ink">Find companies</span><span className="block text-[12px] text-zinc-600">Describe what you want; the Sourcing agent searches Crustdata and returns a cited list.</span></span>
      </Link>
      <ResearchForm />
      <MemoryPanel className="mt-6" title="Researched companies" sub="Every research run, from organizational memory." match={(e) => e.kind === "research.run" || e.kind === "deal.opened"} note={false} />
    </UnavailablePage>
  );
}
