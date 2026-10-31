"use client";
import { useState, useRef, useEffect, type ReactNode, type KeyboardEvent, type DragEvent } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronRight, Check, Mail, Download, Table2, Columns3, Plus, GripVertical, Briefcase, ArrowRight, ArrowUp, ArrowDown, ArrowUpRight, AlarmClock, CalendarDays, ListFilter, FileText, Info, History, Layers, Inbox, ScanSearch, Timer, Lock, Search, SlidersHorizontal, CloudOff, RotateCw, UserPlus, MoveRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Page, TopBar } from "../components/shell";
import { Src, Pill, Btn, Undo, Avatar, Logo, Spark, Strength, Severity, Delta, Kbd, Meter, cx, IconBtn, IconMenu, DetailRows, CompanyLogo } from "../components/ui";
import { Rise, Pop, DrawPath, Count, useReducedMotion } from "../components/motion";
import { ScreenSkeleton, ErrorState, EmptyState, Skeleton } from "../components/states";
import { FitPill, StagePill, Checkbox, OwnerChip, DecisionBtn } from "../components/dealbits";
import { WallBadge, Masked } from "../components/wall";
import { ROUTES } from "../routes";
import type { PersonRef, PipelineStat, StageFilter, PortfolioHandoff, PipelineBoardData, PipelineDeal, PipelineHeader, PipelineTableData, ScreenStatus, ShellData, Stage, StageId, WatchlistData } from "../types";

const STAGE_SHADES = ["bg-zinc-200", "bg-zinc-300", "bg-zinc-400", "bg-zinc-600", "bg-zinc-800", "bg-ink"];
const shade = (i: number) => STAGE_SHADES[Math.min(i, STAGE_SHADES.length - 1)];
const stageLabel = (stages: Stage[], id: StageId) => stages.find((s) => s.id === id)?.label ?? id;

export interface PipelineCallbacks {
  onOpenDeal?: (dealId: string) => void;
  onAddDeal?: () => void;
  onExport?: () => void;
  onChangeView?: (viewId: string) => void;
  onUndo?: (activityId: string) => void;
}

function Toggle2({ board }: { board: boolean }) {
  const opt = (on: boolean) => cx("flex h-full items-center gap-1 rounded-md px-2", on ? "bg-white font-medium text-ink shadow-sm" : "text-zinc-500 hover:text-ink");
  return (
    <span role="tablist" aria-label="Layout" className="flex h-8 items-center rounded-lg bg-zinc-200/60 p-0.5 text-[12px]">
      <Link role="tab" aria-selected={!board} aria-label="Table" title="Table" href={ROUTES.pipeline} className={opt(!board)}><Table2 className="size-3.5" /></Link>
      <Link role="tab" aria-selected={board} aria-label="Board" title="Board" href={ROUTES.pipelineBoard} className={opt(board)}><Columns3 className="size-3.5" /></Link>
    </span>
  );
}
// v3.2: title + one quiet count. View, layout, export and add are single icons; details open on click.
function Head({ title, sub, view, primary = "New deal", board = false, onPrimary, onExport, views, onView, info, layout = true }: { title: string; sub: ReactNode; view: string; primary?: string; board?: boolean; onPrimary?: () => void; onExport?: () => void; views?: { id: string; label: string }[]; onView?: (id: string) => void; info?: ReactNode; layout?: boolean }) {
  return (
    <div className="flex items-end justify-between">
      <div><h1 className="serif text-[34px] leading-none tracking-[-0.01em]">{title}</h1><div className="mt-2 text-[13px] text-zinc-500">{sub}</div></div>
      <div className="flex items-center gap-2">
        {info}
        <IconMenu icon={<ListFilter />} label={`View: ${view}`} w={220} title="Saved views" items={(views ?? [{ id: view, label: view }]).map((v) => ({ id: v.id, label: v.label, icon: v.label === view ? <Check /> : <span className="size-3.5" />, onSelect: () => onView?.(v.id) }))} />
        {layout && <Toggle2 board={board} />}
        {onExport !== undefined || layout ? <IconMenu icon={<Download />} label="Download" w={230} title="Download this view" items={[
          { id: "xlsx", label: "Excel workbook", hint: ".xlsx", icon: <Table2 />, onSelect: onExport },
          { id: "csv", label: "CSV", hint: ".csv", icon: <FileText />, onSelect: onExport },
          { id: "pdf", label: "PDF snapshot", hint: ".pdf", icon: <FileText />, onSelect: onExport },
        ]} /> : null}
        <IconBtn tone="primary" icon={<Plus />} label={primary} onClick={onPrimary} />
      </div>
    </div>
  );
}
const sub = (h: PipelineHeader) => <span title={`+${h.newThisWeek} this week · ${h.scope}`}><b className="font-semibold text-ink">{h.active}</b> active</span>;
const crumbs = (label: string) => [{ label: "Pipeline" }, { label }];

/* ============ Table (v4.1) ============ */
// Stat cards (icon chip, delta pill, "From last 7 days"), one compact mix card (stage-mix + sector-mix pill-bars), then
// the table in Today's language: checkbox, logo, stage pill, fit pill (Crustdata why on hover), owner, dated next step,
// last touch and the inline decision. Rows lift on hover and reveal open/snooze; selection slides up a bulk bar.
const CARD = "rounded-[20px] border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(9,9,11,.03),0_12px_32px_-18px_rgba(9,9,11,.10)]";
const STAT_ICON: Record<PipelineStat["icon"], ReactNode> = { deals: <Layers />, inbound: <Inbox />, diligence: <ScanSearch />, clock: <Timer /> };
const EASE = [0.22, 1, 0.36, 1] as const;

function StatCard({ s }: { s: PipelineStat }) {
  const good = s.better ? s.dir === s.better : s.good;
  const num = Number(s.value), dec = (s.value.split(".")[1] ?? "").length;
  return (
    <section className={cx(CARD, "relative px-5 pt-4 pb-4")}>
      <span className="absolute top-4 right-4 grid size-9 place-items-center rounded-xl bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200/70 [&_svg]:size-4 [&_svg]:stroke-[1.75]">{STAT_ICON[s.icon]}</span>
      <div className="pr-12 text-[14px] font-medium text-ink">{s.label}</div>
      <div className="mt-2.5 flex items-center gap-2.5">
        <span className="flex items-baseline gap-1.5"><span className="numeral text-[32px] leading-none">{Number.isFinite(num) ? <Count to={num} decimals={dec} /> : s.value}</span>{s.unit && <span className="text-[13px] text-zinc-500">{s.unit}</span>}</span>
        <span title={good ? "Better than last week" : "Worse than last week"} className={cx("tnum inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium", good ? "bg-ok-50 text-ok ring-1 ring-ok-100/70" : "bg-rust-50 text-rust ring-1 ring-rust-100/70")}>{s.dir === "up" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}{s.delta}</span>
      </div>
      <div className="mt-2 text-[12px] text-zinc-500">{s.foot}</div>
    </section>
  );
}

/** A row of rounded segments, `on` of `n` filled (27781143 pill-bar). Segments grow in, staggered. */
function Blocks({ n, on, h = 10, tone = "bg-ink", delay = 0.15, r = 3 }: { n: number; on: number; h?: number; tone?: string; delay?: number; r?: number }) {
  const rm = useReducedMotion();
  return (
    <span aria-hidden className="flex w-full gap-[3px]">
      {Array.from({ length: n }, (_, i) => (
        <motion.span key={i} className={cx("flex-1", i < on ? tone : "bg-zinc-100")} style={{ height: h, borderRadius: r, transformOrigin: "bottom" }}
          initial={rm ? false : { scaleY: 0.2, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.45, delay: delay + 0.03 * i, ease: EASE }} />
      ))}
    </span>
  );
}

function MixCard({ d }: { d: PipelineTableData }) {
  const mix = d.mix!, max = Math.max(...d.stages.map((s) => s.count)), SEG = 5, SSEG = 16;
  const sectorTotal = (d.sectors ?? []).reduce((a, b) => a + b.count, 0);
  // The stage a below-benchmark step leads into gets the sienna fill: that is where deals leak.
  const lows = d.conversion.filter((c) => c.rate < c.firmAvg);
  const leak = new Set(d.conversion.map((c, i) => (c.rate < c.firmAvg ? d.stages[i + 1]?.id : undefined)).filter(Boolean));
  return (
    <section className={cx(CARD, "grid grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)] @max-[1040px]/main:grid-cols-1")}>
      <div className="flex flex-col px-5 pt-4 pb-4">
        <div className="flex items-center gap-2">
          <span><span className="block text-[14px] font-medium">{mix.title}</span><span className="mt-0.5 block text-[12px] text-zinc-500">{mix.sub}</span></span>
          {lows.map((c) => <span key={c.label} className="tnum ml-auto inline-flex h-6 items-center gap-1.5 rounded-full bg-rust-50 px-2.5 text-[11.5px] font-medium text-rust ring-1 ring-rust-100/80"><span className="size-1.5 rounded-full bg-rust" />{c.label} {Math.round(c.rate * 100)}% · below {mix.benchmark} {Math.round(c.firmAvg * 100)}%</span>)}
          <span className={cx(!lows.length && "ml-auto")}><IconMenu icon={<Info />} label="About stage mix" w={260} tone="bare"><DetailRows rows={[{ k: "Blocks", v: "Active deals by stage" }, { k: "Pills", v: mix.sub }, { k: "Compared to", v: `${mix.benchmark} average` }, { k: "Passed this year", v: <span className="tnum">{d.header.passedThisYear}</span> }]} /></IconMenu></span>
        </div>
        <div className="mt-auto flex pt-3">
          {d.stages.map((s, i) => { const c = d.conversion[i], low = c && c.rate < c.firmAvg; return (
            <div key={s.id} className="contents">
              <div className="min-w-0 flex-1">
                <Blocks n={SEG} on={s.count ? Math.max(1, Math.ceil((s.count / max) * SEG)) : 0} h={22} r={6} tone={leak.has(s.id) ? "bg-rust" : "bg-ink"} delay={0.2 + 0.06 * i} />
                <div className="mt-2.5 flex min-w-0 items-baseline gap-1.5"><span className={cx("numeral text-[20px] leading-none", leak.has(s.id) && "text-rust")}><Count to={s.count} /></span><span title={s.label} className="truncate text-[11.5px] text-zinc-500">{s.short ?? s.label}</span></div>
              </div>
              {c && <div className="flex w-[54px] shrink-0 flex-col items-center">
                <span title={`${c.label} · ${mix.benchmark} ${Math.round(c.firmAvg * 100)}%`} className={cx("tnum -mt-px inline-flex h-6 items-center gap-0.5 rounded-full pr-1.5 pl-2 text-[12px] font-medium", low ? "bg-rust text-white shadow-[0_4px_10px_-4px_rgba(156,68,15,.6)]" : "bg-white text-zinc-600 ring-1 ring-zinc-200")}>{Math.round(c.rate * 100)}%<ChevronRight className="size-3 opacity-80" strokeWidth={2.25} /></span>
              </div>}
            </div>
          ); })}
        </div>
      </div>
      <div className="border-l border-zinc-100 px-5 pt-3.5 pb-3 @max-[1040px]/main:border-t @max-[1040px]/main:border-l-0">
        <div className="flex items-center gap-2"><span className="text-[14px] font-medium">{mix.sectorTitle}</span><span className="text-[12px] text-zinc-500">· {mix.sectorSub}</span><span className="tnum ml-auto text-[12px] text-zinc-500">{sectorTotal}</span></div>
        <ul className="mt-1.5">
          {(d.sectors ?? []).map((x, i) => { const pct = x.count / sectorTotal; return (
            <li key={x.label} className="grid h-[21px] grid-cols-[92px_minmax(0,224px)_36px] items-center gap-3 text-[12.5px]">
              <span className="truncate text-zinc-600">{x.label}</span>
              <Blocks n={SSEG} on={Math.max(1, Math.round(pct * SSEG))} h={9} delay={0.3 + 0.05 * i} />
              <span className="tnum text-right text-[12px] text-zinc-500">{Math.round(pct * 100)}%</span>
            </li>
          ); })}
        </ul>
      </div>
    </section>
  );
}

type SortKey = "company" | "stage" | "fit" | "owner" | "next" | "last";
const fitOf = (d: PipelineDeal) => Math.round(d.thesisFit * 100);
const ownerOf = (d: PipelineDeal): PersonRef | undefined => (d.owner && !d.restricted ? { initials: d.owner, name: d.ownerName ?? d.owner } : undefined);

function SortHead({ k, sort, onSort, children, className }: { k: SortKey; sort: { k: SortKey; dir: 1 | -1 } | null; onSort: (k: SortKey) => void; children: ReactNode; className?: string }) {
  const on = sort?.k === k;
  return (
    <button type="button" onClick={() => onSort(k)} aria-sort={on ? (sort!.dir === 1 ? "ascending" : "descending") : "none"} className={cx("group/sh inline-flex min-w-0 items-center gap-1 text-left transition-colors hover:text-ink", on && "text-ink", className)}>
      <span className="truncate">{children}</span>
      {on ? (sort!.dir === 1 ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />) : <ChevronsUpDown className="size-3 text-zinc-300 group-hover/sh:text-zinc-500" />}
    </button>
  );
}

/** Small popover anchored to the snooze icon; closes on outside click or Escape. */
function SnoozeMenu({ options, onPick, onClose }: { options: NonNullable<PipelineTableData["snoozeOptions"]>; onPick: (id: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const rm = useReducedMotion();
  useEffect(() => {
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const key = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [onClose]);
  return (
    <motion.div ref={ref} role="menu" aria-label="Snooze until" onClick={(e) => e.stopPropagation()}
      initial={rm ? false : { opacity: 0, y: 4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.16, ease: EASE }}
      className="absolute right-0 bottom-full z-40 mb-1.5 w-[200px] origin-bottom-right rounded-[14px] border border-zinc-200/80 bg-white p-1 shadow-[0_1px_2px_rgba(9,9,11,.04),0_16px_36px_-14px_rgba(9,9,11,.28)]">
      <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-zinc-400">Snooze until</div>
      {options.map((o) => (
        <button key={o.id} type="button" role="menuitem" onClick={() => onPick(o.id)} className="flex h-8 w-full items-center gap-2 rounded-[10px] px-2.5 text-left text-[12.5px] text-zinc-700 hover:bg-zinc-50 hover:text-ink">
          {o.hint ? <AlarmClock className="size-3.5 text-zinc-400" /> : <CalendarDays className="size-3.5 text-zinc-400" />}<span>{o.label}</span>{o.hint && <span className="tnum ml-auto text-[11.5px] text-zinc-400">{o.hint}</span>}
        </button>
      ))}
    </motion.div>
  );
}

const ICON_BTN = "grid size-8 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-white hover:text-ink hover:shadow-[0_1px_2px_rgba(9,9,11,.08)] [&_svg]:size-4";
function PipelineRow({ d, i, stage, me, sel, onSel, onOpen, snooze, snoozeOpen, onSnoozeOpen, onSnooze, cols }: {
  d: PipelineDeal; i: number; stage?: Stage; me?: ShellData["user"]; sel: boolean; onSel: () => void; onOpen?: (id: string) => void;
  snooze?: PipelineTableData["snoozeOptions"]; snoozeOpen: boolean; onSnoozeOpen: (open: boolean) => void; onSnooze?: (id: string, until: string) => void; cols: string;
}) {
  const rm = useReducedMotion();
  const WIDE = "hidden @[1000px]/pt:flex";
  const pill = <StagePill tone={stage?.tone}>{stage?.short ?? stage?.label ?? d.stage}</StagePill>;
  const motionProps = rm ? { initial: false as const } : {
    layout: "position" as const, initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35, delay: Math.min(i, 8) * 0.04, ease: EASE } },
    exit: { opacity: 0, transition: { duration: 0.12 } }, transition: { layout: { duration: 0.3, ease: EASE } },
  };
  if (d.restricted) return (
    <motion.li {...motionProps} className={cx("grid h-[60px] items-center gap-x-3 border-b border-zinc-100 bg-[repeating-linear-gradient(135deg,rgba(9,9,11,.045)_0_1px,transparent_1px_7px)] px-4 text-[13px]", cols)}>
      <span className="size-[18px] rounded-[6px] bg-zinc-100/80" />
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-white text-zinc-500 shadow-[0_1px_1px_rgba(9,9,11,.06)] ring-1 ring-zinc-200/80"><Lock className="size-3.5" /></span>
        <span className="min-w-0"><span className="flex items-center gap-1.5 font-medium"><span className="truncate">{d.restricted.codeName}</span><WallBadge size="xs" iconOnly /></span><span className="block truncate text-[11.5px] text-zinc-500">{d.restricted.note}</span></span>
      </span>
      <span>{pill}</span>
      <span><span className="block h-6 w-[52px] rounded-full bg-zinc-100" /></span>
      <span className={cx(WIDE, "items-center gap-2")}><span className="size-6 rounded-full bg-zinc-100" /><span className="h-2.5 w-12 rounded-full bg-zinc-100" /></span>
      <span className={cx(WIDE, "flex-col gap-1.5")}><span className="h-2.5 w-24 rounded-full bg-zinc-100" /><span className="h-2 w-14 rounded-full bg-zinc-100/80" /></span>
      <span className={WIDE}><span className="h-2.5 w-8 rounded-full bg-zinc-100" /></span>
      <span className="flex justify-end">{d.restricted.request && <DecisionBtn label={d.restricted.request} />}</span>
    </motion.li>
  );
  return (
    <motion.li {...motionProps} onClick={() => onOpen?.(d.id)}
      className={cx("group relative grid h-[60px] cursor-pointer items-center gap-x-3 border-b border-zinc-100 px-4 text-[13px] transition-[background-color,box-shadow,translate] duration-200 motion-safe:hover:-translate-y-px hover:shadow-[0_1px_2px_rgba(9,9,11,.04),0_8px_20px_-12px_rgba(9,9,11,.22)]", cols, snoozeOpen ? "z-30 bg-[#f8f7f5]" : "hover:z-10", sel ? "bg-rust-50/50" : "hover:bg-[#fbfaf9]")}>
      <Checkbox on={sel} label={`Select ${d.company.name}`} onChange={onSel} />
      <span className="flex min-w-0 items-center gap-3 pr-1"><CompanyLogo c={d.company} size={32} /><span className="min-w-0"><span className="block truncate font-medium">{d.company.name}</span><span className="block truncate text-[11.5px] text-zinc-500">{d.company.line}{d.sector && <span className="text-zinc-400"> · {d.sector}</span>}</span></span></span>
      <span>{pill}</span>
      <span onClick={(e) => e.stopPropagation()}><FitPill score={fitOf(d)} signals={d.fitSignals} /></span>
      <span className={cx(WIDE, "min-w-0")}><OwnerChip o={ownerOf(d)} me={me} /></span>
      <span className={cx(WIDE, "min-w-0 flex-col")}><span className="truncate text-zinc-800">{d.nextStep}</span>{d.nextDate && <span className={cx("tnum flex items-center gap-1 truncate text-[11.5px]", d.nextDate.due ? "font-medium text-rust" : "text-zinc-500")}><CalendarDays className="size-3 shrink-0" />{d.nextDate.label}</span>}</span>
      <span className={cx(WIDE, "tnum text-[12.5px]", d.lastTouch.stale ? "font-medium text-rust" : "text-zinc-500")}>{d.lastTouch.label}</span>
      <span className="flex items-center justify-end gap-1">
        <span className={cx("relative flex gap-0.5 transition-all duration-200", snoozeOpen ? "translate-x-0 opacity-100" : "translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100")}>
          <Link href={ROUTES.deal(d.id)} onClick={(e) => e.stopPropagation()} aria-label={`Open ${d.company.name}`} title="Open" className={ICON_BTN}><ArrowUpRight /></Link>
          {snooze?.length ? <button type="button" aria-haspopup="menu" aria-expanded={snoozeOpen} onClick={(e) => { e.stopPropagation(); onSnoozeOpen(!snoozeOpen); }} aria-label={`Snooze ${d.company.name}`} title="Snooze" className={cx(ICON_BTN, snoozeOpen && "bg-white text-ink shadow-[0_1px_2px_rgba(9,9,11,.08)]")}><AlarmClock /></button> : null}
          {snoozeOpen && snooze && <SnoozeMenu options={snooze} onClose={() => onSnoozeOpen(false)} onPick={(u) => { onSnooze?.(d.id, u); onSnoozeOpen(false); }} />}
        </span>
        {d.decision && <DecisionBtn label={d.decision.label} recommended={d.decision.recommended} onClick={() => onOpen?.(d.id)} />}
      </span>
    </motion.li>
  );
}

/** Empty / error: a fanned stack of tiles (logo-tile language), one line, one action. */
function PipelineState({ kind, title, body, action, onAction }: { kind: "empty" | "error"; title: string; body: string; action: string; onAction?: () => void }) {
  const tile = "absolute grid size-14 place-items-center rounded-[16px] ring-1 ring-zinc-200/80 shadow-[0_1px_2px_rgba(9,9,11,.04),0_10px_24px_-14px_rgba(9,9,11,.25)]";
  return (
    <Rise className={cx(CARD, "mt-6 flex flex-col items-center px-6 pt-14 pb-14 text-center")}>
      <div aria-hidden className="relative h-16 w-[132px]">
        <span className={cx(tile, "top-1 left-0 -rotate-[8deg] bg-white text-zinc-300")}><Layers className="size-5" /></span>
        <span className={cx(tile, "top-1 right-0 rotate-[8deg] bg-white text-zinc-300")}><Inbox className="size-5" /></span>
        <span className={cx(tile, "left-1/2 top-0 z-10 -translate-x-1/2", kind === "error" ? "bg-rust-50 text-rust ring-rust-100" : "bg-white text-ink")}>{kind === "error" ? <CloudOff className="size-5" /> : <Plus className="size-5" />}</span>
      </div>
      <h2 className="serif mt-7 text-[24px] leading-tight tracking-[-0.01em]">{title}</h2>
      <p className="mt-2 max-w-[420px] text-[13.5px] text-zinc-500">{body}</p>
      <button type="button" onClick={onAction} className={cx("mt-6 inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-all hover:-translate-y-px", kind === "error" ? "bg-white text-ink ring-1 ring-zinc-200 hover:shadow-[0_6px_14px_-8px_rgba(9,9,11,.3)]" : "bg-ink text-white shadow-[0_1px_2px_rgba(9,9,11,.2)] hover:shadow-[0_6px_14px_-6px_rgba(9,9,11,.45)]")}>{kind === "error" ? <RotateCw className="size-3.5" /> : <Plus className="size-4" />}{action}</button>
    </Rise>
  );
}

function PipelineSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="mt-5 space-y-4">
      <div className="grid grid-cols-4 gap-4 @max-[900px]/main:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className={cx(CARD, "h-[123px] space-y-3 p-5 @max-[900px]/main:h-[162px]")}><Skeleton className="h-4 w-1/2" /><Skeleton className="h-8 w-2/3" /><Skeleton className="h-3 w-1/3" /></div>)}</div>
      <div className={cx(CARD, "grid h-[139px] grid-cols-[2.3fr_1fr] gap-8 p-5 @max-[900px]/main:h-[235px] @max-[900px]/main:grid-cols-1")}><div className="space-y-3"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-[74px]" /></div><div className="space-y-2.5 @max-[900px]/main:hidden">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-3" />)}</div></div>
      <div className={cx(CARD, "h-[392px] p-4 @max-[900px]/main:h-[440px]")}><Skeleton className="h-9 w-1/2 rounded-full" /><div className="mt-[40px]">{Array.from({ length: 4 }, (_, i) => <div key={i} className="flex h-[60px] items-center"><Skeleton className="h-11 w-full" /></div>)}</div></div>
      <div className={cx(CARD, "h-[118px] space-y-3 p-5")}><Skeleton className="h-4 w-1/4" /><Skeleton className="h-4 w-1/2" /></div>
    </div>
  );
}

const BULK_ICON = { assign: <UserPlus />, move: <MoveRight />, pass: <X />, export: <Download /> } as const;

export interface PipelineTableScreenProps extends ScreenStatus, PipelineCallbacks {
  shell: ShellData; data: PipelineTableData; filter?: string; query?: string;
  onSnooze?: (dealId: string, until: string) => void;
  onBulk?: (action: "assign" | "move" | "pass" | "export", dealIds: string[]) => void;
  /** Pre-select rows (screenshots / tests). */
  selected?: string[];
}
export function PipelineTableScreen(p: PipelineTableScreenProps) {
  const { data: d, status = "ready" } = p, h = d.header;
  const rm = useReducedMotion();
  const filters = d.filters ?? [{ id: "all", label: "All", stages: [] }];
  const [filter, setFilter] = useState(p.filter ?? filters[0].id);
  const [q, setQ] = useState(p.query ?? "");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 } | null>(null);
  const [sel, setSel] = useState<Set<string>>(() => new Set(p.selected ?? []));
  const [snoozing, setSnoozing] = useState<string | null>(null);
  const stageIdx = (id: StageId) => d.stages.findIndex((s) => s.id === id);
  const f = filters.find((x) => x.id === filter) ?? filters[0];
  const inF = (x: PipelineDeal) => f.stages.length === 0 || f.stages.includes(x.stage);
  const countOf = (x: StageFilter) => d.stages.filter((s) => x.stages.length === 0 || x.stages.includes(s.id)).reduce((a, s) => a + s.count, 0);
  const needle = q.trim().toLowerCase();
  const match = (x: PipelineDeal) => !needle || (x.restricted ? [x.restricted.codeName] : [x.company.name, x.company.line ?? "", x.sector ?? "", ...(x.founders ?? [])]).some((t) => t.toLowerCase().includes(needle));
  const key: Record<SortKey, (x: PipelineDeal) => string | number> = {
    company: (x) => (x.restricted?.codeName ?? x.company.name).toLowerCase(), stage: (x) => stageIdx(x.stage), fit: (x) => (x.restricted ? -1 : fitOf(x)),
    owner: (x) => ownerOf(x)?.name ?? "~", next: (x) => (x.nextDate?.due ? 0 : 1), last: (x) => x.lastTouch.days ?? 99,
  };
  let rows = d.deals.filter((x) => inF(x) && match(x));
  if (sort) rows = [...rows].sort((a, b) => { const A = key[sort.k](a), B = key[sort.k](b); return (A < B ? -1 : A > B ? 1 : 0) * sort.dir; });
  const onSort = (k: SortKey) => setSort((s) => (s?.k === k ? (s.dir === 1 ? { k, dir: -1 } : null) : { k, dir: k === "fit" || k === "last" ? -1 : 1 }));
  const live = rows.filter((x) => !x.restricted), allOn = live.length > 0 && live.every((x) => sel.has(x.id)), some = live.some((x) => sel.has(x.id));
  const picked = d.deals.filter((x) => sel.has(x.id) && !x.restricted).map((x) => x.id);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  // Owner, next step and last touch step out when the docked assistant narrows the table (container query).
  const COLS = "grid-cols-[18px_minmax(170px,1fr)_108px_56px_172px] @[1000px]/pt:grid-cols-[18px_minmax(200px,1.5fr)_108px_56px_112px_minmax(140px,1fr)_88px_172px]";
  const WIDE = "hidden @[1000px]/pt:inline-flex";
  const empty = status === "empty" || d.deals.length === 0;
  const st = d.states;

  return (
    <Page active="pipeline" shell={p.shell} top={<TopBar crumbs={crumbs(h.view)} ctx="Pipeline" />}>
      <div className="mx-auto w-full max-w-[1240px] px-7 pt-6 pb-16">
        <div className="flex items-end justify-between px-1">
          <div>
            <div className="flex items-center gap-3"><h1 className="serif text-[34px] leading-none tracking-[-0.02em]">Pipeline</h1>{status === "ready" && !empty ? <span className="tnum inline-flex h-7 items-center rounded-full bg-white px-2.5 text-[13px] font-medium text-zinc-600 shadow-[0_1px_2px_rgba(9,9,11,.05)] ring-1 ring-zinc-200/80">{h.active}</span> : null}</div>
            <p className="mt-2 text-[13px] text-zinc-500">{status === "ready" && !empty && <><span className="font-medium text-ok">+{h.newThisWeek}</span> this week · </>}{h.scope} · {h.view}</p>
          </div>
          <div className="flex items-center gap-2">
            <Toggle2 board={false} />
            <IconMenu icon={<Download />} label="Download" w={230} title="Download this view" items={[
              { id: "xlsx", label: "Excel workbook", hint: ".xlsx", icon: <Table2 />, onSelect: p.onExport },
              { id: "csv", label: "CSV", hint: ".csv", icon: <FileText />, onSelect: p.onExport },
              { id: "pdf", label: "PDF snapshot", hint: ".pdf", icon: <FileText />, onSelect: p.onExport },
            ]} />
            <button type="button" onClick={p.onAddDeal} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink pr-4 pl-3 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(9,9,11,.2),inset_0_1px_0_rgba(255,255,255,.12)] transition-all hover:-translate-y-px hover:shadow-[0_6px_14px_-6px_rgba(9,9,11,.45)]"><Plus className="size-4" />New deal</button>
          </div>
        </div>
        {status === "loading" ? <PipelineSkeleton />
          : status === "error" ? <PipelineState kind="error" title={st?.errorTitle ?? "Couldn’t load the pipeline"} body={p.error ?? st?.errorBody ?? ""} action={st?.errorAction ?? "Try again"} onAction={p.onRetry} />
          : empty ? <PipelineState kind="empty" title={st?.emptyTitle ?? "No deals in this view"} body={st?.emptyBody ?? ""} action={st?.emptyAction ?? "New deal"} onAction={p.onAddDeal} />
          : <>
          {d.stats && <div className="mt-5 grid grid-cols-4 gap-4 @max-[900px]/main:grid-cols-2">{d.stats.map((s, i) => <Rise key={s.id} i={i}><StatCard s={s} /></Rise>)}</div>}
          {d.mix && <Rise i={4} className="mt-4"><MixCard d={d} /></Rise>}
          <Rise i={5} className="mt-4">
            <section className={cx(CARD, "@container/pt")}>
              <div className="flex items-center gap-3 px-4 pt-3.5 pb-3 @max-[1000px]/pt:flex-wrap">
                <div role="tablist" aria-label="Stage" className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
                  {filters.map((x) => { const on = filter === x.id; return (
                    <button key={x.id} type="button" role="tab" aria-selected={on} onClick={() => setFilter(x.id)} className={cx("relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] whitespace-nowrap transition-colors", on ? "text-white" : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200/70 hover:bg-white hover:text-ink")}>
                      {on && <motion.span layoutId={rm ? undefined : "pipe-tab"} transition={{ type: "spring", stiffness: 500, damping: 38 }} className="absolute inset-0 rounded-full bg-ink shadow-[0_1px_2px_rgba(9,9,11,.2)]" />}
                      <span className="relative">{x.label}</span><span className="tnum relative text-[11px] text-zinc-400">{countOf(x)}</span>
                    </button>
                  ); })}
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2 @max-[1000px]/pt:ml-0 @max-[1000px]/pt:w-full">
                  <label className="flex h-9 w-[240px] items-center gap-2 rounded-full bg-zinc-50 px-3.5 ring-1 ring-zinc-200/70 transition-colors focus-within:bg-white focus-within:ring-rust/30 @max-[1000px]/pt:w-auto @max-[1000px]/pt:flex-1"><Search className="size-4 shrink-0 text-zinc-400" /><input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search pipeline" placeholder={d.search} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-zinc-400" /></label>
                  <IconMenu icon={<SlidersHorizontal />} label={`View: ${h.view}`} w={220} title="Saved views" items={d.savedViews.map((v) => ({ id: v.id, label: v.label, icon: v.label === h.view ? <Check /> : <span className="size-3.5" />, onSelect: () => p.onChangeView?.(v.id) }))} />
                </div>
              </div>
              <div className={cx("grid h-10 items-center gap-x-3 border-y border-zinc-100 bg-zinc-50/50 px-4 text-[11.5px] text-zinc-500", COLS)}>
                <Checkbox on={allOn} mixed={!allOn && some} label="Select all" onChange={() => setSel(allOn ? new Set() : new Set(live.map((x) => x.id)))} />
                <SortHead k="company" sort={sort} onSort={onSort}>Company</SortHead>
                <SortHead k="stage" sort={sort} onSort={onSort}>Stage</SortHead>
                <SortHead k="fit" sort={sort} onSort={onSort}>Fit</SortHead>
                <span className={WIDE}><SortHead k="owner" sort={sort} onSort={onSort}>Owner</SortHead></span>
                <span className={WIDE}><SortHead k="next" sort={sort} onSort={onSort}>Next step</SortHead></span>
                <span className={WIDE}><SortHead k="last" sort={sort} onSort={onSort}>Last touch</SortHead></span>
                <span className="text-right">Decision</span>
              </div>
              <ul className="relative">
                <AnimatePresence mode="popLayout" initial={!rm}>
                  {rows.map((x, i) => <PipelineRow key={x.id} d={x} i={i} stage={d.stages.find((s) => s.id === x.stage)} me={p.shell.user} sel={sel.has(x.id)} onSel={() => toggle(x.id)} onOpen={p.onOpenDeal}
                    snooze={d.snoozeOptions} snoozeOpen={snoozing === x.id} onSnoozeOpen={(o) => setSnoozing(o ? x.id : null)} onSnooze={p.onSnooze} cols={COLS} />)}
                  {rows.length === 0 && <motion.li key="none" initial={rm ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-12 text-center text-[13px] text-zinc-500">{needle ? <>No deals match “{q}”.</> : "Nothing at this stage."}</motion.li>}
                </AnimatePresence>
              </ul>
              <div className="flex h-12 items-center justify-between rounded-b-[20px] border-t border-zinc-100 px-4 text-[12px] text-zinc-500">
                <span className="tnum">Showing <b className="font-medium text-ink">{rows.length}</b> of {countOf(f)}</span>
                {d.footnote && <span className="flex items-center gap-2"><Src k="crust">Crustdata</Src>{d.footnote}</span>}
              </div>
            </section>
          </Rise>
          <AnimatePresence>
            {picked.length > 0 && (
              <motion.div key="bulk" role="toolbar" aria-label="Bulk actions" initial={rm ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={rm ? { opacity: 0 } : { opacity: 0, y: 24 }} transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="sticky bottom-5 z-40 mx-auto mt-4 flex w-fit items-center gap-1 rounded-full bg-ink py-1.5 pr-1.5 pl-4 text-[13px] text-white shadow-[0_18px_40px_-14px_rgba(9,9,11,.55),inset_0_1px_0_rgba(255,255,255,.08)]">
                <span className="tnum mr-2 flex items-center gap-2"><span className="grid h-6 min-w-6 place-items-center rounded-full bg-white/15 px-1.5 text-[12px] font-medium">{picked.length}</span>selected</span>
                <span className="mx-1 h-5 w-px bg-white/15" />
                {(d.bulkActions ?? []).map((a) => <button key={a.id} type="button" onClick={() => p.onBulk?.(a.id, picked)} className={cx("inline-flex h-8 items-center gap-1.5 rounded-full px-3 transition-colors hover:bg-white/10 [&_svg]:size-3.5", a.id === "pass" ? "text-[#f0b48a]" : "text-white/90")}>{BULK_ICON[a.id]}{a.label}</button>)}
                <button type="button" aria-label="Clear selection" onClick={() => setSel(new Set())} className="ml-1 grid size-8 place-items-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"><X className="size-3.5" /></button>
              </motion.div>
            )}
          </AnimatePresence>
          <Rise i={6} className={cx(CARD, "mt-4 p-5")}>
            <div className="flex items-center justify-between"><span className="text-[14px] font-medium">Activity</span><IconBtn size="sm" tone="bare" icon={<History />} label="Audit log" /></div>
            <div className="mt-2 grid grid-cols-2 gap-x-8 [&>*]:border-b [&>*]:border-zinc-100">
              {d.activity.length === 0 && <div className="flex h-10 items-center text-[12.5px] text-zinc-400">Nothing yet today</div>}
              {d.activity.map((a) => <div key={a.id} className="flex h-10 items-center gap-2.5 text-[12.5px]"><Pop><Check className="size-3.5 text-ok" /></Pop><span>{a.label}</span><span className="ml-auto tnum text-[11px] text-zinc-400">{a.at}</span>{a.undoable !== false && <Undo onClick={() => p.onUndo?.(a.id)} />}</div>)}
            </div>
          </Rise>
        </>}
      </div>
    </Page>
  );
}

/* ============ Board: drag between stages (mouse) or Space → ←/→ → Space (keyboard) ============ */
function Card({ d, closed, dragging, grabbed, onKeyDown, onDragStart, onDragEnd, onOpen }: { d: PipelineDeal; closed?: string; dragging?: boolean; grabbed?: boolean; onKeyDown?: (e: KeyboardEvent) => void; onDragStart?: (e: DragEvent) => void; onDragEnd?: () => void; onOpen?: () => void }) {
  if (d.restricted) return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="flex items-center gap-2"><span className="size-[22px] rounded-[6px] bg-[repeating-linear-gradient(135deg,#e4e4e7_0_3px,#f4f4f5_3px_6px)]" /><span className="truncate text-[12.5px] font-semibold">{d.restricted.codeName}</span><WallBadge size="xs" iconOnly className="ml-auto" /></div>
      <div className="mt-2.5"><Masked w={90} /></div>
    </div>
  );
  return (
    <div role="button" tabIndex={0} aria-roledescription="Draggable deal" aria-pressed={grabbed} aria-label={`${d.company.name}. Press Space to move.`}
      draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onKeyDown={onKeyDown} onDoubleClick={onOpen}
      className={cx("group relative cursor-grab rounded-xl border bg-white p-3 shadow-[0_1px_2px_rgba(9,9,11,.04)] outline-none hover:border-zinc-300 focus-visible:ring-2 focus-visible:ring-ink/30 active:cursor-grabbing", d.focus ? "border-ink shadow-[0_8px_24px_-14px_rgba(9,9,11,.45)]" : "border-zinc-200", dragging && "opacity-40", grabbed && "rotate-[1.5deg] border-ink ring-2 ring-ink shadow-[0_16px_32px_-12px_rgba(9,9,11,.45)]")}>
      <GripVertical className="absolute top-3 -left-0.5 size-3.5 text-zinc-300 opacity-0 group-hover:opacity-100" />
      <div className="flex items-center gap-2"><CompanyLogo c={d.company} size={22} /><span className="min-w-0"><span className="block truncate text-[12.5px] font-semibold">{d.company.name}</span><span className="block truncate text-[11px] text-zinc-500">{d.company.line}</span></span><span className="ml-auto">{d.owner && <Avatar i={d.owner} size={20} />}</span></div>
      <div className="mt-2.5 flex items-center justify-between text-[11.5px]"><span className={cx("truncate", d.lastTouch.stale ? "text-rust" : "text-zinc-700")}>{d.nextStep}{d.nextDate && ` · ${d.nextDate.label}`}</span>{d.flags ? <Severity levels={d.flags} size={6} /> : d.signal ? <Pill tone={d.signal.tone}>{d.signal.label}</Pill> : null}</div>
      {closed && <div className="mt-2 flex items-center gap-1.5 rounded-md bg-ok/10 px-2 py-1 text-[11px] font-medium text-ok"><Check className="size-3" />{closed}</div>}
      <div className="mt-2 flex items-center gap-2 border-t border-zinc-100 pt-2 text-[11px] text-zinc-500"><Meter v={d.thesisFit} w={34} /><span className="tnum">{Math.round(d.thesisFit * 100)}</span><span className="ml-auto flex items-center gap-1.5"><Strength n={d.intro.strength} />{d.intro.via}</span></div>
    </div>
  );
}

/** v3 · Pipeline → Portfolio handoff. Phases are frames (closed · moving · filling · done) so video/screens can capture each. */
function PortfolioDock({ h, deal, onOpen }: { h: PortfolioHandoff; deal?: PipelineDeal; onOpen?: () => void }) {
  const inDock = h.phase === "filling" || h.phase === "done", moving = h.phase === "moving";
  const n = h.filled.filter((f) => f.done).length;
  return (
    <div role="list" aria-label="Portfolio" className={cx("relative flex min-h-[460px] flex-col rounded-2xl p-2", moving ? "bg-ink/[.06] ring-2 ring-ink/25" : "bg-[linear-gradient(180deg,#f0efed,#f4f4f3)] ring-1 ring-zinc-200")}>
      <div className="flex items-center gap-2 px-1.5 pt-1 pb-2.5"><Briefcase className="size-3.5 text-zinc-600" /><span className="text-[12px] font-medium">Portfolio · Fund III</span><span className="tnum ml-auto text-[11.5px] text-zinc-500">{inDock ? 15 : 14}</span></div>
      {!inDock && !moving && <div className="rounded-xl border border-dashed border-zinc-300 px-3 py-6 text-center text-[11.5px] text-zinc-400">Closed deals land here</div>}
      {moving && deal && <>
        <div className="rounded-xl border border-dashed border-ink/40 px-3 py-6 text-center text-[11.5px] text-ink/70">Release to add to Portfolio</div>
        <div className="absolute top-[52px] -left-[72%] z-10 w-[86%] rotate-[2.5deg] rounded-xl border border-ink bg-white p-3 shadow-[0_24px_48px_-16px_rgba(9,9,11,.45),0_2px_6px_rgba(9,9,11,.08)]">
          <div className="flex items-center gap-2"><CompanyLogo c={deal.company} size={22} /><span className="min-w-0"><span className="block truncate text-[12.5px] font-semibold">{deal.company.name}</span><span className="block truncate text-[11px] text-zinc-500">{h.closedLabel}</span></span><span className="ml-auto"><Avatar i={deal.owner} size={20} /></span></div>
        </div>
      </>}
      {inDock && deal && (
        <div className="rounded-xl border border-ink bg-white p-3 shadow-[0_8px_24px_-14px_rgba(9,9,11,.45)]">
          <div className="flex items-center gap-2"><CompanyLogo c={deal.company} size={22} /><span className="min-w-0"><span className="block truncate text-[12.5px] font-semibold">{deal.company.name}</span><span className="block truncate text-[11px] text-zinc-500">{h.closedLabel}</span></span></div>
          <div className="mt-2.5 flex items-center justify-between text-[10.5px] font-medium tracking-[.06em] text-zinc-500 uppercase"><span>Filling the page</span><span className="tnum">{n}/{h.filled.length}</span></div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${(n / h.filled.length) * 100}%` }} /></div>
          <ul className="mt-2 space-y-1">
            {h.filled.map((f, i) => <li key={f.label} className={cx("flex items-center gap-1.5 text-[11.5px]", f.done ? "text-ink" : "text-zinc-400")}>{f.done ? <Check className="size-3 text-ok" /> : i === n ? <span className="size-3 animate-spin rounded-full border-[1.5px] border-zinc-300 border-t-ink" /> : <span className="size-3 rounded-full border border-zinc-300" />}{f.label}</li>)}
          </ul>
          {h.phase === "done" && <button type="button" onClick={onOpen} className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-lg bg-ink py-1.5 text-[11.5px] font-medium text-white">Open in Portfolio<ArrowRight className="size-3" /></button>}
        </div>
      )}
    </div>
  );
}
function HandoffToast({ h, name }: { h: PortfolioHandoff; name: string }) {
  return (
    <div role="status" className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-[12.5px] text-white shadow-[0_16px_40px_-12px_rgba(9,9,11,.5)]">
      <Check className="size-4 text-[#9fd3b0]" /><span><b className="font-semibold">{name}</b> is in Portfolio · page filled from the deal ({h.filled.length} items)</span><span className="text-white/50">·</span><span className="underline decoration-white/40 underline-offset-2">Undo</span>
    </div>
  );
}

export interface PipelineBoardScreenProps extends ScreenStatus, PipelineCallbacks {
  shell: ShellData;
  data: PipelineBoardData;
  /** Fired after an optimistic move. Reject the promise to roll back. */
  onMoveStage?: (dealId: string, toStage: StageId) => void | Promise<void>;
}
export function PipelineBoardScreen(p: PipelineBoardScreenProps) {
  const { data: d, status = "ready" } = p;
  const [deals, setDeals] = useState(d.deals);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<StageId | null>(null);
  const [grab, setGrab] = useState<{ id: string; from: StageId; at: StageId } | null>(null);
  const [live, setLive] = useState("");
  const counts = useRef(Object.fromEntries(d.stages.map((s) => [s.id, s.count])) as Record<StageId, number>);

  const move = async (id: string, to: StageId) => {
    const prev = deals.find((x) => x.id === id);
    if (!prev || prev.stage === to) return;
    counts.current[prev.stage] -= 1; counts.current[to] += 1;
    setDeals((xs) => xs.map((x) => (x.id === id ? { ...x, stage: to } : x)));
    setLive(`${prev.company.name} moved to ${stageLabel(d.stages, to)}.`);
    try { await p.onMoveStage?.(id, to); } catch {
      counts.current[prev.stage] += 1; counts.current[to] -= 1;
      setDeals((xs) => xs.map((x) => (x.id === id ? { ...x, stage: prev.stage } : x)));
      setLive(`Couldn’t move ${prev.company.name}. Put back in ${stageLabel(d.stages, prev.stage)}.`);
    }
  };
  const keyFor = (x: PipelineDeal) => (e: KeyboardEvent) => {
    const idx = d.stages.findIndex((s) => s.id === (grab?.id === x.id ? grab.at : x.stage));
    if (!grab || grab.id !== x.id) {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setGrab({ id: x.id, from: x.stage, at: x.stage }); setLive(`Picked up ${x.company.name}. Left and right arrows choose a stage, Space drops, Escape cancels.`); }
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const n = Math.max(0, Math.min(d.stages.length - 1, idx + (e.key === "ArrowRight" ? 1 : -1)));
      setGrab({ ...grab, at: d.stages[n].id }); setOver(d.stages[n].id); setLive(`Over ${d.stages[n].label}.`);
    } else if (e.key === " " || e.key === "Enter") { e.preventDefault(); setGrab(null); setOver(null); void move(x.id, grab.at); }
    else if (e.key === "Escape") { e.preventDefault(); setGrab(null); setOver(null); setLive(`Cancelled. ${x.company.name} stays in ${stageLabel(d.stages, grab.from)}.`); }
  };

  return (
    <Page active="pipeline" shell={p.shell} top={<TopBar crumbs={crumbs(d.header.view)} ctx="Pipeline" />}>
      <div className="px-8 pt-6 pb-10">
        <Head board title="Pipeline" sub={sub(d.header)} view={d.header.view} primary="Add deal" onPrimary={p.onAddDeal} onExport={p.onExport} onView={p.onChangeView} />
        <div aria-live="assertive" className="sr-only">{live}</div>
        {status === "loading" ? <ScreenSkeleton cols="grid-cols-[1fr]" /> : status === "error" ? <ErrorState message={p.error} onRetry={p.onRetry} /> : (
          <Rise i={1} className="mt-6 grid gap-3" >
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${d.stages.length}, minmax(0,1fr))${d.handoff ? " minmax(0,1.15fr)" : ""}` }}>
              {d.stages.map((s, i) => {
                const ho = d.handoff, away = ho && ho.phase !== "closed" ? ho.dealId : null;
                const cards = deals.filter((x) => x.id !== away && (grab?.id === x.id ? grab.at : x.stage) === s.id);
                const ghost = away && deals.find((x) => x.id === away)?.stage === s.id;
                // v3.1: a deal that has left for Portfolio no longer counts in its old column (Term sheet read 1 + "1 more").
                const n = Math.max(counts.current[s.id] - (ghost ? 1 : 0), cards.length), isOver = over === s.id;
                return (
                  <div key={s.id} role="list" aria-label={`${s.label}, ${n} deals`}
                    onDragOver={(e) => { if (dragId) { e.preventDefault(); setOver(s.id); } }}
                    onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
                    onDrop={(e) => { e.preventDefault(); if (dragId) void move(dragId, s.id); setDragId(null); setOver(null); }}
                    className={cx("group/col flex min-h-[460px] flex-col rounded-2xl p-2 transition-colors", isOver ? "bg-zinc-200/80 ring-2 ring-ink/20" : "bg-zinc-100/70")}>
                    <div className="flex items-center gap-2 px-1.5 pt-1 pb-2.5"><span className={cx("size-2 rounded-[2px]", shade(i))} /><span className="text-[12px] font-medium">{s.label}</span><span className="tnum ml-auto text-[11.5px] text-zinc-500">{n}</span></div>
                    <div className="space-y-2">
                      {cards.map((x) => <div role="listitem" key={x.id}><Card d={x} closed={d.handoff?.dealId === x.id ? d.handoff.closedLabel : undefined} dragging={dragId === x.id} grabbed={grab?.id === x.id} onKeyDown={keyFor(x)} onOpen={() => p.onOpenDeal?.(x.id)}
                        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", x.id); setDragId(x.id); }} onDragEnd={() => { setDragId(null); setOver(null); }} /></div>)}
                      {ghost && ho?.phase !== "done" && <div className="h-[104px] rounded-xl border border-dashed border-zinc-300 bg-[repeating-linear-gradient(135deg,transparent_0_5px,rgba(9,9,11,.03)_5px_10px)]" />}
                      {cards.length === 0 && !(ghost && ho?.phase !== "done") && <div className={cx("rounded-xl border border-dashed px-3 py-6 text-center text-[11.5px]", isOver ? "border-ink text-ink" : "border-zinc-300 text-zinc-400")}>Drop here</div>}
                    </div>
                    {n > cards.length && <div className="mt-2 rounded-lg px-2 py-1.5 text-[11.5px] text-zinc-500 hover:bg-white">+ {n - cards.length} more</div>}
                    <button type="button" onClick={p.onAddDeal} aria-label={`Add to ${s.label}`} className="mt-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11.5px] text-zinc-400 opacity-0 transition-opacity group-hover/col:opacity-100 focus-visible:opacity-100 hover:bg-white"><Plus className="size-3" />Add</button>
                  </div>
                );
              })}
              {d.handoff && <PortfolioDock h={d.handoff} deal={deals.find((x) => x.id === d.handoff!.dealId)} onOpen={() => p.onOpenDeal?.(d.handoff!.dealId)} />}
            </div>
          </Rise>
        )}
        {d.handoff?.phase === "done" && <HandoffToast h={d.handoff} name={deals.find((x) => x.id === d.handoff!.dealId)?.company.name ?? ""} />}
      </div>
    </Page>
  );
}

/* ============ Watchlist: table + docked intro-path panel ============ */
export interface WatchlistScreenProps extends ScreenStatus { shell: ShellData; data: WatchlistData; onSelect?: (rowId: string) => void; onAction?: (actionId: string) => void; onAdd?: () => void; onClosePanel?: () => void }
export function WatchlistScreen(p: WatchlistScreenProps) {
  const { data: d, status = "ready" } = p, w = d.panel;
  return (
    <Page active="pipeline" shell={p.shell} top={<TopBar crumbs={crumbs("Watchlist")} ctx="Watchlist" />}>
      <div className="grid flex-1 grid-cols-[1fr_420px]">
        <div className="px-8 pt-6 pb-10">
          <Head title="Pipeline" sub={<span title={`${d.worthACall} worth a call`}><b className="font-semibold text-ink">{d.count}</b> on watchlist</span>} view="Watchlist" primary="Add company" onPrimary={p.onAdd} />
          {status === "loading" ? <ScreenSkeleton cols="grid-cols-[1fr]" /> : status === "error" ? <ErrorState message={p.error} onRetry={p.onRetry} /> : d.rows.length === 0 ? <EmptyState title="Nothing on your watchlist" body="Star a company anywhere to track headcount and intros." /> : (
            <Rise i={1} className="card mt-5 overflow-hidden">
              <div className="grid h-9 grid-cols-[1.5fr_1.2fr_.7fr_1fr_1.2fr] items-center border-b border-zinc-100 bg-zinc-50/70 px-4 text-[11.5px] font-medium text-zinc-500">
                <span>Company</span><span>Headcount · 12 mo</span><span>Est. ARR</span><span>Signal</span><span>Warm intro</span>
              </div>
              {d.rows.map((r) => { const neg = r.growth.startsWith("−"), pos = r.growth.startsWith("+"); return (
                <button type="button" key={r.id} onClick={() => p.onSelect?.(r.id)} className={cx("grid h-[58px] w-full grid-cols-[1.5fr_1.2fr_.7fr_1fr_1.2fr] items-center border-b border-zinc-100 px-4 text-left text-[12.5px] last:border-0 hover:bg-zinc-50", r.selected && "bg-zinc-50 shadow-[inset_3px_0_0_#09090b]")}>
                  <span className="flex items-center gap-2.5"><CompanyLogo c={r.company} size={26} /><span><span className="block font-semibold">{r.company.name}</span><span className="text-[11.5px] text-zinc-500">{r.company.line}</span></span></span>
                  <span className="flex items-center gap-3"><Spark d={r.headcount} w={92} h={24} color={neg ? "#9c440f" : "#09090b"} /><span className={cx("tnum font-medium", pos ? "text-ok" : neg ? "text-rust" : "text-zinc-500")}>{r.growth}</span></span>
                  <span className="tnum">{r.estArr}</span>
                  <span>{r.signal ? <Pill tone={r.signal.tone}>{r.signal.label}</Pill> : <span className="text-zinc-300">—</span>}</span>
                  <span className="flex items-center gap-2"><Strength n={r.intro.strength} /><span className="truncate text-zinc-600">{r.intro.via}</span></span>
                </button>
              ); })}
            </Rise>
          )}
          <div className="mt-3 flex items-center gap-4 px-1 text-[11.5px] text-zinc-500"><Src k="crust">Crustdata</Src>{d.refreshNote}</div>
        </div>
        <aside className="sticky top-[52px] h-[calc(100vh-52px)] border-l border-zinc-200/70 bg-white px-6 pt-6">
          <div className="flex items-center gap-2.5"><CompanyLogo c={w.company} size={30} /><div><div className="text-[14px] font-semibold">{w.person.name}</div><div className="text-[12px] text-zinc-500">{w.person.title}</div></div><button type="button" onClick={p.onClosePanel} className="ml-auto flex items-center gap-1 text-zinc-400"><Kbd>Esc</Kbd></button></div>
          <div className="mt-6 eyebrow">Warm intros · relationship strength</div>
          <svg viewBox="0 0 372 230" className="mt-2 w-full" role="img" aria-label={`You to ${w.person.name} via ${w.path.via.name}`}>
            <defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 8 4 0 8z" fill="#09090b" /></marker></defs>
            <DrawPath d="M44 115 C110 115 110 50 168 50" stroke="#09090b" strokeWidth="2.5" delay={0.3} />
            <DrawPath d="M204 50 C260 50 270 115 318 115" stroke="#09090b" strokeWidth="2.5" markerEnd="url(#ar)" delay={1.0} />
            {w.path.alt && <><path d="M44 115 C110 115 110 180 168 180" stroke="#d4d4d8" strokeWidth="1.5" strokeDasharray="4 4" fill="none" /><path d="M204 180 C260 180 270 115 318 115" stroke="#d4d4d8" strokeWidth="1.5" strokeDasharray="4 4" fill="none" /></>}
            <circle cx="26" cy="115" r="18" fill="#09090b" /><text x="26" y="119" textAnchor="middle" fontSize="11" fill="#fff" fontWeight="600">{w.path.you}</text>
            <circle cx="186" cy="50" r="18" fill="#e4e4e7" /><text x="186" y="54" textAnchor="middle" fontSize="11" fontWeight="600">{w.path.via.initials}</text>
            {w.path.alt && <><circle cx="186" cy="180" r="18" fill="#f4f4f5" /><text x="186" y="184" textAnchor="middle" fontSize="11" fill="#71717a" fontWeight="600">{w.path.alt.initials}</text><text x="186" y="216" textAnchor="middle" fontSize="10.5" fill="#a1a1aa">{w.path.alt.label}</text></>}
            <circle cx="342" cy="115" r="22" fill="#ece7df" /><text x="342" y="119" textAnchor="middle" fontSize="11" fill="#5b5245" fontWeight="600">{w.path.target}</text>
            <text x="186" y="18" textAnchor="middle" fontSize="11" fill="#09090b" fontWeight="600">{w.path.via.name}</text>
            <text x="186" y="88" textAnchor="middle" fontSize="10.5" fill="#71717a">{w.path.via.context}</text>
          </svg>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">{w.stats.map((s) => <div key={s.label} className="rounded-xl bg-zinc-50 py-2.5"><div className="tnum text-[16px] font-semibold">{s.value}</div><div className="text-[11px] text-zinc-500">{s.label}</div></div>)}</div>
          <div className="mt-3 flex gap-1">{w.sources.map((s) => <Src key={s.label} k={s.kind}>{s.label}</Src>)}</div>
          <div className="mt-6 eyebrow">{w.company.name} at a glance</div>
          <div className="mt-2 space-y-2 text-[12.5px]">
            <div className="flex items-center justify-between"><span className="text-zinc-500">Headcount</span><Delta a={w.glance.headcount[0]} b={w.glance.headcount[1]} tone="ok" /></div>
            <div className="flex items-center justify-between"><span className="text-zinc-500">Thesis fit</span><Meter v={w.glance.thesisFit} w={120} /></div>
            <div className="flex items-center justify-between"><span className="text-zinc-500">Last raise</span><span>{w.glance.lastRaise}</span></div>
          </div>
          <div className="mt-6 flex items-center gap-2 border-t border-zinc-100 pt-4"><Btn variant="primary" icon={<Mail className="size-3.5" />} onClick={() => p.onAction?.(w.action.id)}>{w.action.label}</Btn><span className="text-[11.5px] text-zinc-500">{w.actionNote}</span></div>
        </aside>
      </div>
    </Page>
  );
}
