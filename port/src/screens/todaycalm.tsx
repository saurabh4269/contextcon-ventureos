"use client";
/**
 * v3.2 · Calm Today: a short greeting, four stat cards with a quiet "View …" footer, one chart, one activity list.
 * The assistant is docked on the right, so the top bar has no ask box. Everything else lives one click away.
 */
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, Download, FileSpreadsheet, FileText, Layers, Clock, PieChart } from "lucide-react";
import type { ReactNode } from "react";
import { Page, TopBar } from "../components/shell";
import { AssistantDock } from "../components/assistant";
import { LiveRail } from "../components/liverail";
import { DealFlowChart } from "../components/charts";
import { IconBtn, IconMenu, Logo, cx, CompanyLogo } from "../components/ui";
import { Rise } from "../components/motion";
import { ROUTES } from "../routes";
import type { AssistantData, ShellData, TodayCalmData, Tone2 } from "../types";

const statIcon: Record<string, ReactNode> = { pipe: <Layers />, ic: <FileText />, saved: <Clock />, run: <PieChart /> };
const toneText = { ok: "text-ok", rust: "text-rust", neutral: "text-zinc-500" } as const;

export function TodayCalmScreen({ shell, data, assistant, tone = "warm", overlay, onSuggestion }: { shell: ShellData; data: TodayCalmData; assistant: AssistantData; tone?: Tone2; overlay?: ReactNode; onSuggestion?: (action: string) => void }) {
  return (
    <Page active="today" shell={shell} tone={tone} overlay={overlay} dock={<AssistantDock data={assistant} onSuggestion={onSuggestion} top={data.live && <LiveRail run={data.live} mono={tone === "mono"} />} />}
      top={<TopBar crumbs={[{ label: "Today" }]} ask={false} />}>
      <div className="mx-auto w-full max-w-[880px] px-8 pt-9 pb-16">
        <div className="flex items-end gap-4">
          <div className="min-w-0">
            <h1 className="serif text-[34px] leading-none tracking-[-0.02em]">{data.greeting}</h1>
            <div className="mt-2 text-[12.5px] text-zinc-500">{data.dateLabel}</div>
          </div>
          <span className="ml-auto"><IconMenu icon={<CalendarDays />} label="Period" title="Show" items={[{ id: "w", label: "This week" }, { id: "m", label: "Last 30 days", hint: "✓" }, { id: "q", label: "This quarter" }]} /></span>
        </div>

        <div className="mt-7 grid grid-cols-4 gap-3">
          {data.stats.map((s, i) => (
            <Rise key={s.id} i={i}>
              <div className={cx("flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(9,9,11,.03)]", s.alert ? "border-rust-100" : "border-zinc-200/80")}>
                <div className="flex-1 px-4 pt-3.5 pb-3">
                  <div className="flex items-center gap-2"><span className="truncate text-[12px] text-zinc-500">{s.label}</span><span className={cx("ml-auto flex size-6 shrink-0 items-center justify-center rounded-md [&_svg]:size-3.5", s.alert ? "bg-rust-50 text-rust" : "bg-zinc-50 text-zinc-400 ring-1 ring-zinc-100")}>{statIcon[s.id]}</span></div>
                  <div className="mt-2 flex items-baseline gap-1"><span className={cx("numeral text-[30px] leading-none", s.alert && "text-rust")}>{s.value}</span>{s.unit && <span className="text-[12px] text-zinc-500">{s.unit}</span>}</div>
                  {s.delta && <div className={cx("mt-1.5 truncate text-[11.5px] tnum", toneText[s.delta.tone])}>{s.delta.label}</div>}
                </div>
                <Link href={s.foot.href} className="group flex h-9 items-center border-t border-zinc-100 bg-zinc-50/50 px-4 text-[11.5px] text-zinc-500 hover:text-ink">{s.foot.label}<ArrowRight className="ml-auto size-3 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" /></Link>
              </div>
            </Rise>
          ))}
        </div>

        <Rise i={4}>
          <section className="mt-4 rounded-2xl border border-zinc-200/80 bg-white px-5 pt-4 pb-3 shadow-[0_1px_2px_rgba(9,9,11,.03)]">
            <div className="flex items-center gap-3">
              <span className="text-[13.5px] font-medium">{data.chart.title}</span>
              <span className="text-[12px] text-zinc-400">{data.chart.meta}</span>
              <span className="ml-auto flex items-center gap-3 text-[11.5px] text-zinc-500">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-[#d4d4d8]" />Read</span>
                <span className="flex items-center gap-1.5"><span className="h-[2px] w-3 rounded bg-ink" />Worth a look</span>
              </span>
              <IconMenu icon={<Download />} label="Download" title="Download chart data" w={220} items={[{ id: "xlsx", label: "Excel", icon: <FileSpreadsheet />, hint: ".xlsx" }, { id: "csv", label: "CSV", icon: <FileText />, hint: ".csv" }]} />
            </div>
            <div className="mt-2"><DealFlowChart weeks={data.chart.weeks} read={data.chart.read} worth={data.chart.worth} mono={tone === "mono"} /></div>
          </section>
        </Rise>

        <Rise i={5}>
          <section className="mt-4 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(9,9,11,.03)]">
            <div className="flex h-12 items-center px-5"><span className="text-[13.5px] font-medium">Recent decisions</span><span className="ml-auto"><IconBtn icon={<ArrowUpRight />} label="View all" href={ROUTES.agents} size="sm" /></span></div>
            <ul>
              {data.activity.map((a) => (
                <li key={a.id}>
                  <Link href={a.href ?? "#"} className="group grid h-[58px] grid-cols-[28px_minmax(0,1fr)_auto_44px_14px] items-center gap-3 border-t border-zinc-100 px-5 hover:bg-zinc-50/60">
                    <CompanyLogo c={a.company} size={28} />
                    <span className="min-w-0"><span className="block truncate text-[13px] text-ink"><span className="font-medium">{a.company.name}</span><span className="text-zinc-300"> · </span>{a.title}</span><span className="block truncate text-[12px] text-zinc-500">{a.detail}</span></span>
                    <span className={cx("text-[11.5px] whitespace-nowrap", a.status.tone === "rust" ? "text-rust" : a.status.tone === "ok" ? "text-ok" : "text-zinc-500")}>{a.status.label}</span>
                    <span className="text-right text-[11.5px] text-zinc-400 tnum">{a.time}</span>
                    <ChevronRight className="size-3.5 text-zinc-300 group-hover:text-ink" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </Rise>
      </div>
    </Page>
  );
}
