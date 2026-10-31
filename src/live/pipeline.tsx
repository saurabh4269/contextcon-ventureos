"use client";
// Pipeline: live companies from inbound Gmail and organizational memory. No deal store and no demo rows.
import Link from "next/link";
import { Page, TopBar } from "@port/components/shell";
import { cx } from "@port/components/ui";
import { fmtDateTime } from "@/lib/format";
import type { PipelineDealRow } from "@/lib/inbox/pipeline";
import { liveShell } from "./shell";
import { ResearchForm } from "./deal";
import { failureMessage, useLiveJson } from "./useLiveJson";

const SOURCE_LABEL: Record<PipelineDealRow["source"], string> = {
  inbound: "Inbound",
  opened: "Opened",
  researched: "Researched",
};

type PipelineDealsResponse = {
  status: "ok";
  deals: PipelineDealRow[];
  sources: {
    inbox: { status: "ok" | "not_connected" | "error"; message?: string };
    memory: { status: "ok" | "unavailable" | "error"; message?: string };
  };
};

export function LivePipeline() {
  const res = useLiveJson<PipelineDealsResponse>("/api/pipeline/deals");
  return (
    <Page active="pipeline" shell={liveShell} top={<TopBar crumbs={[{ label: "Pipeline" }]} ctx="Pipeline" />}>
      <div className="mx-auto w-full max-w-[720px] px-6 pt-8 pb-16 max-lg:pb-24 @max-[720px]/main:px-4 @max-[720px]/main:pt-5">
        <h1 className="serif text-[34px] leading-none tracking-[-0.02em]">Pipeline</h1>
        <p className="mt-2 text-[13px] text-zinc-500">Companies from your inbox and research. Click a row to open the deal.</p>
        {res.state === "loading" ? <p className="mt-6 text-[12.5px] text-zinc-400">Loading pipeline…</p>
          : res.state === "failed" ? <p role="alert" className="mt-6 text-[12.5px] text-zinc-600">{failureMessage(res, "Pipeline")}</p>
          : res.data.deals.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 px-4 py-5 text-[13px] text-zinc-600">
              <p>No companies yet. Send a founder email that names the website (for example in the subject), or research a domain below.</p>
              <SourceNotes sources={res.data.sources} />
            </div>
          ) : (
            <ol data-testid="pipeline-deals" className="mt-6 divide-y divide-zinc-100 overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200/80">
              {res.data.deals.map((d) => (
                <li key={d.domain}>
                  <Link href={d.href} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{d.name}</span>
                      <span className="block truncate text-[12px] text-zinc-500">{d.domain}</span>
                    </span>
                    <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[11px]", d.source === "inbound" ? "bg-[#faf3ec] text-ink" : "bg-zinc-100 text-zinc-500")}>{SOURCE_LABEL[d.source]}</span>
                    <time dateTime={d.at} className="hidden shrink-0 text-[11.5px] text-zinc-400 tnum sm:block">{fmtDateTime(d.at)}</time>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        <div className="mt-8"><ResearchForm /></div>
      </div>
    </Page>
  );
}

function SourceNotes({ sources }: { sources: PipelineDealsResponse["sources"] }) {
  const notes = [
    sources.inbox.status === "not_connected" ? "Gmail is not connected, so inbound mail is not listed." : sources.inbox.status === "error" ? `Inbox: ${sources.inbox.message ?? "could not be read"}` : null,
    sources.memory.status === "unavailable" ? sources.memory.message ?? "Memory is not configured." : sources.memory.status === "error" ? `Memory: ${sources.memory.message ?? "could not be read"}` : null,
  ].filter(Boolean);
  if (!notes.length) return null;
  return <ul className="mt-3 space-y-1 text-[12px] text-zinc-500">{notes.map((n) => <li key={n}>{n}</li>)}</ul>;
}
