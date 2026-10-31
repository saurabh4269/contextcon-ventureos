"use client";
import { useState } from "react";
import { Folder, FileText, Mail, ChevronRight, Check } from "lucide-react";
import { Page, TopBar } from "../components/shell";
import { DealHead } from "../components/dealhead";
import { Src, Pill, Btn, StepDot, Kbd, HL, cx } from "../components/ui";
import { Rise, Grow, Sweep } from "../components/motion";
import { ScreenSkeleton, ErrorState } from "../components/states";
import { ROUTES } from "../routes";
import type { DataRoomData, ScreenStatus, ShellData } from "../types";

export interface DataRoomScreenProps extends ScreenStatus {
  shell: ShellData;
  data: DataRoomData;
  walled?: boolean;
  onRequestMissing?: () => void;
  onOpenFolder?: (folderId: string) => void;
  onOpenFile?: (fileId: string) => void;
}
const PAD = [[100, 92, 96, 70], [96, 88, 100, 60], [90, 100, 76]];

export function DataRoomScreen(p: DataRoomScreenProps) {
  const { data: d, status = "ready" } = p, name = d.header.company.name, pv = d.preview;
  const [asked, setAsked] = useState(false);
  return (
    <Page active="pipeline" shell={p.shell} top={<TopBar crumbs={[{ label: "Pipeline", href: ROUTES.pipeline }, { label: name, href: ROUTES.deal(d.header.company.id) }, { label: "Data room" }]} ctx="Data room" />}>
      {status === "loading" ? <ScreenSkeleton cols="grid-cols-[250px_1fr_360px]" /> : status === "error" ? <ErrorState message={p.error} onRetry={p.onRetry} /> : <>
      <DealHead h={d.header} walled={p.walled} primary={asked ? <Btn icon={<Check className="size-3.5 text-ok" />} onClick={() => setAsked(false)}>Requested · Undo</Btn> : <Btn variant="primary" icon={<Mail className="size-3.5" />} onClick={() => { setAsked(true); p.onRequestMissing?.(); }}>Request {d.missingCount} missing files</Btn>} />
      <div className="grid flex-1 grid-cols-[250px_1fr_360px]">
        <nav className="border-r border-zinc-200/70 px-3 pt-5">
          <div className="eyebrow px-2">{d.totalFiles} files</div>
          <div className="mt-2 space-y-px">
            {d.folders.map((f) => (
              <div key={f.id}>
                <button type="button" onClick={() => p.onOpenFolder?.(f.id)} aria-expanded={!!f.open} className={cx("flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[13px]", f.open ? "bg-white font-medium ring-1 ring-zinc-200" : "text-zinc-600")}>
                  <Folder className="size-4 text-zinc-400" strokeWidth={1.6} />{f.name}
                  <span className="ml-auto h-1 w-10 rounded-full bg-zinc-100"><Grow w={`${(f.reviewed / Math.max(f.total, 1)) * 100}%`} className={cx("h-full rounded-full", f.reviewed === f.total ? "bg-ink" : "bg-zinc-400")} /></span>
                  <span className="tnum w-7 text-right text-[11px] text-zinc-400">{f.reviewed}/{f.total}</span>
                </button>
                {f.open && f.files && <div className="ml-5 border-l border-zinc-200 pl-2">{f.files.map((x) => <button type="button" key={x.id} onClick={() => p.onOpenFile?.(x.id)} className={cx("flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[12px]", x.selected ? "bg-zinc-100 font-medium" : "text-zinc-600")}><StepDot s={x.state} size={12} /><span className="truncate">{x.name}</span></button>)}</div>}
              </div>
            ))}
          </div>
        </nav>
        <section className="bg-zinc-100/60 px-10 pt-6 pb-12">
          <div className="flex items-center gap-2 text-[12.5px] text-zinc-500"><FileText className="size-4" />{pv.folder}<ChevronRight className="size-3.5" /><span className="font-medium text-ink">{pv.file}</span><span className="ml-auto">page {pv.page} of {pv.pages}</span></div>
          <Rise className="mx-auto mt-4 max-w-[640px] rounded-sm bg-white px-12 py-10 shadow-[0_1px_3px_rgba(9,9,11,.08),0_12px_40px_-20px_rgba(9,9,11,.2)]">
            <div className="text-[11px] tracking-[0.2em] text-zinc-400 uppercase">{pv.docType}</div>
            {/* v4 · real page text around each clause when the file has it; neutral lines otherwise */}
            {pv.clauses.map((c, i) => <div key={i}>
              {pv.context?.[i] ? <div className={cx(i === 0 ? "mt-4" : "mt-5", "space-y-1.5 text-[13px] leading-6 text-zinc-500")}>{pv.context[i].map((l) => <p key={l}>{l}</p>)}</div>
                : <div className={cx(i === 0 ? "mt-4" : "mt-5", "space-y-2")}>{PAD[i % PAD.length].map((w, j) => <div key={j} className="h-2 rounded bg-zinc-100" style={{ width: `${w}%` }} />)}</div>}
              <Sweep className="mt-4 px-2 py-1.5 text-[13px] leading-6" delay={0.5 + i * 0.5}>{c}</Sweep>
            </div>)}
            {pv.context?.[pv.clauses.length] ? <div className="mt-4 space-y-1.5 text-[13px] leading-6 text-zinc-500">{pv.context[pv.clauses.length].map((l) => <p key={l}>{l}</p>)}</div>
              : <div className="mt-5 space-y-2">{PAD[2].map((w, j) => <div key={j} className="h-2 rounded bg-zinc-100" style={{ width: `${w}%` }} />)}</div>}
          </Rise>
        </section>
        <aside className="border-l border-zinc-200/70 bg-white px-6 pt-6">
          <div className="eyebrow">Pulled from this file</div>
          <div className="mt-3 space-y-2.5">
            {d.facts.map((f) => (
              <div key={f.id} className="rounded-xl border border-zinc-200 p-3.5">
                <div className="flex items-center gap-2"><span className="text-[12px] text-zinc-500">{f.label}</span><span className="ml-auto"><Pill tone={f.tone}>{f.impact}</Pill></span></div>
                <div className="mt-1 text-[14px] font-semibold">{f.value}</div>
                <div className="mt-1.5"><Src k={f.source.kind}>{f.source.label}</Src></div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl bg-zinc-50 p-3.5 text-[12.5px]"><HL h={d.feeds} tone="font-semibold text-ink" /></div>
        </aside>
      </div>
      </>}
    </Page>
  );
}
