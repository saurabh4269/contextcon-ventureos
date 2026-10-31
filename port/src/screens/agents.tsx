"use client";
/**
 * v4 · Agents list (/agents) and Runs (/agents?tab=runs), in Today's language: stat cards with delta pills, pill filters with counts,
 * a hairline table (icon chip, trigger, the tools it touches, status, 14-day activity, last run, owner, flow link) and, under it,
 * the live step rail plus "Waiting on you". Rows expand into the agent's steps; ?agent=<id> opens one (Connectors "Used by" chips).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, ArrowUp, ArrowDown, ArrowUpRight, ArrowRight, Check, ChevronDown, CloudOff, RotateCw, MoreHorizontal, Pause, Play, Workflow, ListChecks,
  Inbox, ScanSearch, CalendarCheck, FileText, Radar, Reply, Mail, ArrowRightLeft, Clock3, CalendarClock, BellRing, Activity, Hourglass, Timer, ShieldCheck, Zap,
} from "lucide-react";
import { Page, TopBar } from "../components/shell";
import { Avatar, CompanyLogo, IconMenu, Src, cx } from "../components/ui";
import { Rise, Count, Pulse, useReducedMotion } from "../components/motion";
import { Skeleton } from "../components/states";
import { DecisionBtn } from "../components/dealbits";
import { LiveRail } from "../components/liverail";
import { ToolLogo, TOOL_NAME } from "../components/tools";
import type { AgentIconId, AgentListRow, AgentListStat, AgentRunOutcome, AgentRunRow, AgentStatusId, AgentTriggerKind, AgentsListData, ScreenStatus, ShellData } from "../types";

const CARD = "rounded-[20px] border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(9,9,11,.03),0_12px_32px_-18px_rgba(9,9,11,.10)]";
const EASE = [0.22, 1, 0.36, 1] as const;
const AGENT_ICON: Record<AgentIconId, ReactNode> = { inbox: <Inbox />, scan: <ScanSearch />, calendar: <CalendarCheck />, memo: <FileText />, radar: <Radar />, reply: <Reply /> };
const TRIGGER_ICON: Record<AgentTriggerKind, ReactNode> = { email: <Mail />, stage: <ArrowRightLeft />, schedule: <Clock3 />, meeting: <CalendarClock />, signal: <BellRing /> };
const STAT_ICON: Record<AgentListStat["icon"], ReactNode> = { runs: <Activity />, waiting: <Hourglass />, time: <Timer />, success: <ShieldCheck /> };

export type AgentsTab = "agents" | "runs";
export type AgentStatusFilter = "all" | AgentStatusId;
export interface AgentsScreenProps extends ScreenStatus {
  shell: ShellData; data: AgentsListData;
  tab?: AgentsTab; statusFilter?: AgentStatusFilter; runFilter?: string; query?: string;
  /** Agent row opened on load (?agent=<id>). */
  open?: string;
  onTab?: (tab: AgentsTab) => void;
  onNewAgent?: () => void;
  onPause?: (agentId: string, paused: boolean) => void;
  onRunNow?: (agentId: string) => void;
}

/* ---------- shared bits ---------- */
function StatCard({ s }: { s: AgentListStat }) {
  const good = s.dir === s.better;
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

/** Pill filter with a count; the dark fill slides between pills (Pipeline's stage pills). */
function FilterPills<T extends string>({ items, on, onPick, group }: { items: { id: T; label: string; count: number; dot?: ReactNode }[]; on: T; onPick: (id: T) => void; group: string }) {
  const rm = useReducedMotion();
  return (
    <div role="tablist" aria-label={group} className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
      {items.map((x) => { const sel = on === x.id; return (
        <button key={x.id} type="button" role="tab" aria-selected={sel} onClick={() => onPick(x.id)} className={cx("relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] whitespace-nowrap transition-colors", sel ? "text-white" : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200/70 hover:bg-white hover:text-ink")}>
          {sel && <motion.span layoutId={rm ? undefined : `${group}-pill`} transition={{ type: "spring", stiffness: 500, damping: 38 }} className="absolute inset-0 rounded-full bg-ink shadow-[0_1px_2px_rgba(9,9,11,.2)]" />}
          {x.dot && <span className="relative">{x.dot}</span>}
          <span className="relative">{x.label}</span><span className={cx("tnum relative text-[11px]", sel ? "text-zinc-400" : "text-zinc-400")}>{x.count}</span>
        </button>
      ); })}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return <label className="flex h-9 w-[260px] items-center gap-2 rounded-full bg-zinc-50 px-3.5 ring-1 ring-zinc-200/70 transition-colors focus-within:bg-white focus-within:ring-rust/30 @max-[1000px]/at:w-auto @max-[1000px]/at:flex-1"><Search className="size-4 shrink-0 text-zinc-400" /><input value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-zinc-400" /></label>;
}

const STATUS_PILL: Record<AgentStatusId, string> = { live: "bg-ok-50 text-ok", paused: "bg-zinc-100/80 text-zinc-600", attention: "bg-warn-50 text-warn" };
function StatusPill({ s, label }: { s: AgentStatusId; label: string }) {
  return (
    <span className={cx("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap", STATUS_PILL[s])}>
      {s === "live" ? <Pulse className="bg-[#2f9a5c]" /> : s === "paused" ? <Pause className="size-2.5 fill-current" strokeWidth={0} /> : <span className="size-1.5 rounded-full bg-[#d39a2c]" />}{label}
    </span>
  );
}

/** Runs per day, oldest first. This week in ink, the week before in zinc, days with a failed run in rust. */
function ActivityBars({ a, paused, delay = 0 }: { a: AgentListRow["activity"]; paused?: boolean; delay?: number }) {
  const rm = useReducedMotion();
  const max = Math.max(1, ...a.map((d) => d.runs)), H = 20, week = a.length - 7;
  return (
    <span aria-hidden className="flex items-end gap-[2px]" style={{ height: H }}>
      {a.map((d, i) => (
        <motion.span key={i} className={cx("w-[4px] rounded-[1.5px]", d.failed ? "bg-rust" : d.runs === 0 ? "bg-zinc-200" : paused || i < week ? "bg-zinc-300" : "bg-ink")}
          style={{ height: d.runs === 0 ? 2 : Math.max(3, Math.round((d.runs / max) * H)), transformOrigin: "bottom" }}
          initial={rm ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.4, delay: delay + 0.02 * i, ease: EASE }} />
      ))}
    </span>
  );
}

function AgentChip({ icon, size = 40, hot }: { icon: AgentIconId; size?: number; hot?: boolean }) {
  return (
    <span style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }} className={cx("relative grid shrink-0 place-items-center ring-1 [&_svg]:stroke-[1.75]", size >= 36 ? "[&_svg]:size-[18px]" : "[&_svg]:size-3.5", hot ? "bg-[linear-gradient(160deg,#fbefe6,#f6e2d3)] text-rust ring-[#ecd3c0] shadow-[0_4px_12px_-6px_rgba(156,68,15,.45)]" : "bg-zinc-50 text-zinc-700 ring-zinc-200/80")}>
      {AGENT_ICON[icon]}
    </span>
  );
}

function ToolStack({ tools, max = 4 }: { tools: AgentListRow["tools"]; max?: number }) {
  const shown = tools.length > max ? tools.slice(0, max - 1) : tools, rest = tools.length - shown.length;
  return (
    <span className="flex items-center gap-1" aria-label={tools.map((t) => TOOL_NAME[t]).join(", ")}>
      {shown.map((t) => <ToolLogo key={t} id={t} size={24} />)}
      {rest > 0 && <span title={tools.slice(shown.length).map((t) => TOOL_NAME[t]).join(", ")} className="tnum grid h-6 min-w-6 place-items-center rounded-[7px] bg-zinc-50 px-1 text-[11px] font-medium text-zinc-500 ring-1 ring-zinc-200">+{rest}</span>}
    </span>
  );
}

/* ---------- Agents tab ---------- */
const AGENT_COLS = "grid-cols-[minmax(200px,1fr)_minmax(140px,180px)_116px_minmax(132px,150px)_140px] @[1040px]/at:grid-cols-[minmax(210px,1.3fr)_minmax(170px,1fr)_116px_136px_128px_84px_32px_128px]";
const WIDE = "hidden @[1040px]/at:flex";

/** The agent's steps as a horizontal rail: tool mark, label, dashed joins. A live run shimmers on its current step. */
function StepStrip({ a }: { a: AgentListRow }) {
  const rm = useReducedMotion();
  return (
    <ol className="flex items-center" aria-label={`${a.name} steps`}>
      {a.steps.map((s, i) => (
        <li key={s.id} className="flex min-w-0 max-w-max flex-1 items-center">
          {i > 0 && <span aria-hidden className={cx("mx-1 h-px w-3 shrink-0 border-t border-dashed", s.state === "done" || s.state === "running" ? "border-zinc-500" : "border-zinc-300")} />}
          <motion.span initial={rm ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 * i, ease: EASE }}
            className={cx("inline-flex h-8 min-w-0 items-center gap-2 rounded-full pr-3 pl-1 text-[12.5px] whitespace-nowrap ring-1", s.state === "running" ? "glow-sienna bg-white ring-[#ecd3c0] shadow-[0_0_0_3px_rgba(194,101,43,.08)]" : "bg-white ring-zinc-200/80", s.state === "queued" && "text-zinc-400")}>
            {s.tool ? <ToolLogo id={s.tool} size={24} className="shrink-0 rounded-full" /> : <span className="tnum grid size-6 shrink-0 place-items-center rounded-full bg-zinc-50 text-[11px] text-zinc-500 ring-1 ring-zinc-200">{i + 1}</span>}
            <span title={s.label} className={cx("truncate", s.state === "running" && "shimmer shimmer-sienna font-medium")}>{s.label}{s.state === "running" ? "…" : ""}</span>
            {s.state === "done" && <span className="grid size-4 shrink-0 place-items-center rounded-full bg-ink text-white"><Check className="size-2.5" strokeWidth={3} /></span>}
          </motion.span>
        </li>
      ))}
    </ol>
  );
}

function AgentRow({ a, i, label, open, focus, paused, queued, me, onToggle, onPause, onRun }: {
  a: AgentListRow; i: number; label: (s: AgentStatusId) => string; open: boolean; focus: boolean; paused: boolean; queued: boolean; me: ShellData["user"];
  onToggle: () => void; onPause: () => void; onRun: () => void;
}) {
  const rm = useReducedMotion();
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => { if (focus) ref.current?.scrollIntoView({ block: "center", behavior: rm ? "auto" : "smooth" }); }, [focus, rm]);
  const status: AgentStatusId = paused ? "paused" : a.status === "paused" ? "live" : a.status;
  const running = status === "live" && a.running;
  const motionProps = rm ? { initial: false as const } : {
    layout: "position" as const, initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35, delay: Math.min(i, 8) * 0.045, ease: EASE } },
    exit: { opacity: 0, transition: { duration: 0.12 } }, transition: { layout: { duration: 0.3, ease: EASE } },
  };
  const isMe = a.owner.id === me.id || a.owner.name === me.name;
  return (
    <motion.li ref={ref} {...motionProps} className={cx("relative border-b border-zinc-100 last:border-b-0", open && "bg-[#fbfaf9]")}>
      {focus && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] rounded-r bg-rust" />}
      <div role="button" tabIndex={0} aria-expanded={open} onClick={onToggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        className={cx("group relative grid h-[68px] cursor-pointer items-center gap-x-3 px-4 text-[13px] outline-none transition-[background-color,box-shadow,translate] duration-200 focus-visible:bg-[#fbfaf9] motion-safe:hover:-translate-y-px hover:z-10 hover:bg-[#fbfaf9] hover:shadow-[0_1px_2px_rgba(9,9,11,.04),0_8px_20px_-12px_rgba(9,9,11,.22)]", AGENT_COLS)}>
        <span className="flex min-w-0 items-center gap-3">
          <AgentChip icon={a.icon} hot={!!running} />
          <span className="min-w-0"><span className="block truncate font-medium text-ink">{a.name}</span><span title={a.job} className="block truncate text-[11.5px] text-zinc-500">{a.job}</span></span>
        </span>
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200/80 [&_svg]:size-3.5 [&_svg]:stroke-[1.75]">{TRIGGER_ICON[a.trigger.kind]}</span>
          <span className="min-w-0"><span className="block truncate text-zinc-800">{a.trigger.label}</span><span className="block truncate text-[11.5px] text-zinc-500">{a.trigger.sub}</span></span>
        </span>
        <ToolStack tools={a.tools} />
        <span className="flex min-w-0 flex-col items-start gap-1">
          <StatusPill s={status} label={label(status)} />
          {status === "attention" && a.attention && <Link href={a.attention.href} onClick={(e) => e.stopPropagation()} title={a.attention.hint} className="inline-flex max-w-full items-center gap-1 truncate pl-1 text-[11.5px] font-medium text-rust hover:underline">{a.attention.action}<span className="truncate font-normal text-zinc-500">· {a.attention.hint.split(" ")[0]}</span></Link>}
        </span>
        <span className={cx(WIDE, "items-center gap-2")} title={`${Math.round(a.success * 100)}% of runs finished clean`}>
          <ActivityBars a={a.activity} paused={status === "paused"} delay={0.2 + Math.min(i, 8) * 0.045} />
          <span className="tnum w-9 text-right text-[12px] text-zinc-500">{Math.round(a.success * 100)}%</span>
        </span>
        <span className={cx(WIDE, "min-w-0 flex-col")}>
          {queued ? <span className="tnum inline-flex items-center gap-1 text-[12.5px] font-medium text-ink"><Zap className="size-3 text-rust" />Queued</span>
            : running ? <><span className="shimmer shimmer-sienna text-[12.5px] font-medium">{a.lastRun.label}</span><span className="truncate text-[11.5px] text-zinc-500">{a.running!.subject}</span></>
            : <span className="tnum text-[12.5px] text-zinc-500">{a.lastRun.label}</span>}
        </span>
        <span className={WIDE} title={`Owner · ${isMe ? "You" : a.owner.name}`}><Avatar i={a.owner.initials} size={26} tone={isMe ? "ink" : "sand"} /></span>
        <span className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {a.flowHref ? <DecisionBtn label="View flow" href={a.flowHref} /> : <DecisionBtn label={open ? "Hide steps" : "Steps"} onClick={onToggle} />}
          <IconMenu icon={<MoreHorizontal />} label={`${a.name} actions`} tone="bare" w={200} items={[
            { id: "steps", label: open ? "Hide steps" : "Show steps", icon: <ListChecks />, onSelect: onToggle },
            { id: "run", label: "Run now", icon: <Zap />, onSelect: onRun },
            { id: "pause", label: status === "paused" ? "Resume agent" : "Pause agent", icon: status === "paused" ? <Play /> : <Pause />, onSelect: onPause },
          ]} />
        </span>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="steps" initial={rm ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={rm ? { opacity: 0 } : { height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: EASE }} className="overflow-hidden">
            <div className="px-4 pt-0.5 pb-4 pl-[68px]">
              <div className="mb-3 flex items-center gap-2 text-[11.5px] text-zinc-500">
                <span className="font-medium text-zinc-700">How it runs</span><span>·</span><span className="tnum">{a.steps.length} steps</span>
                {running && <><span>·</span><span className="inline-flex items-center gap-1.5"><Pulse className="bg-[#c2652b]" />on {a.running!.subject}</span></>}
                <span>·</span><span className="tnum"><b className="font-semibold text-ink">{a.runsThisWeek}</b> runs this week, <b className="font-semibold text-ink">{Math.round(a.success * 100)}%</b> clean</span>
                <span className="ml-auto flex items-center gap-1.5">
                  <button type="button" onClick={onPause} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[12.5px] font-medium text-zinc-700 ring-1 ring-zinc-200 transition-all hover:-translate-y-px hover:text-ink hover:shadow-[0_4px_12px_-6px_rgba(9,9,11,.22)]">{status === "paused" ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}{status === "paused" ? "Resume" : "Pause"}</button>
                  {a.stepsHref && <Link href={a.stepsHref} className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[12.5px] font-medium text-zinc-700 ring-1 ring-zinc-200 transition-all hover:-translate-y-px hover:text-ink hover:shadow-[0_4px_12px_-6px_rgba(9,9,11,.22)]">Open run<ArrowUpRight className="size-3.5" /></Link>}
                  {a.flowHref && <Link href={a.flowHref} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-[12.5px] font-medium text-white shadow-[0_1px_2px_rgba(9,9,11,.2)] transition-all hover:-translate-y-px hover:shadow-[0_6px_14px_-6px_rgba(9,9,11,.45)]"><Workflow className="size-3.5" />How it works</Link>}
                </span>
              </div>
              <StepStrip a={running ? a : { ...a, steps: a.steps.map((s) => ({ ...s, state: undefined })) }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function WaitingCard({ d }: { d: AgentsListData }) {
  const by = (id: string) => d.agents.find((a) => a.id === id);
  return (
    <section className={cx(CARD, "flex h-full flex-col px-5 pt-4 pb-2")}>
      <div className="flex items-center gap-2"><span className="text-[14px] font-medium">Waiting on you</span><span className="tnum ml-auto grid h-6 min-w-6 place-items-center rounded-full bg-rust-50 px-2 text-[12px] font-medium text-rust ring-1 ring-rust-100/80">{d.waiting.length}</span></div>
      <ul className="mt-2">
        {d.waiting.map((w) => { const a = by(w.agent); return (
          <li key={w.id} className="group flex h-[60px] items-center gap-3 border-b border-zinc-100 last:border-b-0">
            <CompanyLogo c={w.company} size={32} />
            <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{w.company.name} <span className="font-normal text-zinc-600">· {w.label}</span></span><span className="flex items-center gap-1.5 truncate text-[11.5px] text-zinc-500">{a && <AgentChip icon={a.icon} size={16} />}{w.sub}</span></span>
            <DecisionBtn label={w.action} href={w.href} recommended={w === d.waiting[0]} />
          </li>
        ); })}
      </ul>
    </section>
  );
}

/* ---------- Runs tab ---------- */
const OUTCOME_PILL: Record<AgentRunOutcome, { pill: string; dot: string }> = {
  running: { pill: "bg-rust-50 text-rust", dot: "" }, waiting: { pill: "bg-ink text-white", dot: "bg-[#f0b48a]" },
  fits: { pill: "bg-[#eaf5ee] text-[#1d6b3e]", dot: "bg-[#2f9a5c]" }, maybe: { pill: "bg-[#fbf3e4] text-[#8a5a12]", dot: "bg-[#d39a2c]" },
  pass: { pill: "bg-zinc-100/80 text-zinc-600", dot: "bg-zinc-400" }, booked: { pill: "bg-ok-50 text-ok", dot: "" },
  drafted: { pill: "bg-zinc-100/80 text-zinc-700", dot: "bg-zinc-500" }, flagged: { pill: "bg-rust-50 text-rust", dot: "bg-rust" }, failed: { pill: "bg-[#fbeee8] text-rust", dot: "" },
};
function OutcomePill({ o, label }: { o: AgentRunOutcome; label: string }) {
  const t = OUTCOME_PILL[o];
  return (
    <span className={cx("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap", t.pill)}>
      {o === "running" ? <Pulse className="bg-rust" /> : o === "booked" ? <CalendarCheck className="size-3" /> : o === "failed" ? <CloudOff className="size-3" /> : <span className={cx("size-1.5 rounded-full", t.dot)} />}{label}
    </span>
  );
}

function StepMeter({ s, o }: { s: AgentRunRow["steps"]; o: AgentRunOutcome }) {
  return (
    <span className="flex items-center gap-2" title={`${s.done} of ${s.total} steps`}>
      <span aria-hidden className="flex gap-[3px]">
        {Array.from({ length: s.total }, (_, i) => (
          <span key={i} className={cx("h-[6px] w-3 rounded-full", i < s.done ? "bg-ink" : i === s.done && o === "running" ? "bg-[#c2652b] motion-safe:animate-pulse" : i === s.done && o === "failed" ? "bg-rust" : i === s.done && o === "waiting" ? "bg-[#f0b48a]" : "bg-zinc-200")} />
        ))}
      </span>
      <span className="tnum text-[12px] text-zinc-500">{s.done}/{s.total}</span>
    </span>
  );
}

const RUN_COLS = "grid-cols-[minmax(220px,1.6fr)_150px_136px_minmax(110px,128px)_28px] @[1040px]/at:grid-cols-[minmax(240px,1.6fr)_minmax(150px,1fr)_136px_128px_76px_96px_28px]";

function RunRow({ r, i, agent, label }: { r: AgentRunRow; i: number; agent?: AgentListRow; label: string }) {
  const rm = useReducedMotion();
  const motionProps = rm ? { initial: false as const } : {
    layout: "position" as const, initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35, delay: Math.min(i, 10) * 0.035, ease: EASE } },
    exit: { opacity: 0, transition: { duration: 0.12 } }, transition: { layout: { duration: 0.3, ease: EASE } },
  };
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-3"><CompanyLogo c={r.subject} size={32} /><span className="min-w-0"><span className="block truncate font-medium text-ink">{r.subject.name}</span><span className={cx("block truncate text-[11.5px]", r.outcome === "running" ? "shimmer shimmer-sienna" : "text-zinc-500")}>{r.detail}</span></span></span>
      <span className="flex min-w-0 items-center gap-2">{agent && <AgentChip icon={agent.icon} size={24} hot={r.outcome === "running"} />}<span className="truncate text-zinc-700">{agent?.name ?? r.agent}</span></span>
      <span><OutcomePill o={r.outcome} label={label} /></span>
      <StepMeter s={r.steps} o={r.outcome} />
      <span className={cx(WIDE, "tnum text-[12.5px] text-zinc-500")}>{r.duration}</span>
      <span className={cx(WIDE, "tnum text-[12.5px] text-zinc-500")}>{r.started}</span>
      <span className="grid size-7 place-items-center justify-self-end rounded-full text-zinc-400 transition-colors group-hover:bg-white group-hover:text-ink group-hover:shadow-[0_1px_2px_rgba(9,9,11,.08)]"><ArrowRight className="size-3.5" /></span>
    </>
  );
  const cls = cx("group relative grid h-[60px] items-center gap-x-3 px-4 text-[13px] transition-[background-color,box-shadow,translate] duration-200 motion-safe:hover:-translate-y-px hover:z-10 hover:bg-[#fbfaf9] hover:shadow-[0_1px_2px_rgba(9,9,11,.04),0_8px_20px_-12px_rgba(9,9,11,.22)]", RUN_COLS);
  return <motion.li {...motionProps} className="border-b border-zinc-100 last:border-b-0">{r.href ? <Link href={r.href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>}</motion.li>;
}

/* ---------- states ---------- */
function AgentsState({ kind, title, body, action, onAction }: { kind: "empty" | "error"; title: string; body: string; action: string; onAction?: () => void }) {
  const tile = "absolute grid size-14 place-items-center rounded-[16px] ring-1 ring-zinc-200/80 shadow-[0_1px_2px_rgba(9,9,11,.04),0_10px_24px_-14px_rgba(9,9,11,.25)]";
  return (
    <Rise className={cx(CARD, "mt-6 flex flex-col items-center px-6 pt-14 pb-14 text-center")}>
      <div aria-hidden className="relative h-16 w-[132px]">
        <span className={cx(tile, "top-1 left-0 -rotate-[8deg] bg-white text-zinc-300")}><Inbox className="size-5" /></span>
        <span className={cx(tile, "top-1 right-0 rotate-[8deg] bg-white text-zinc-300")}><CalendarCheck className="size-5" /></span>
        <span className={cx(tile, "left-1/2 top-0 z-10 -translate-x-1/2", kind === "error" ? "bg-rust-50 text-rust ring-rust-100" : "bg-white text-ink")}>{kind === "error" ? <CloudOff className="size-5" /> : <Workflow className="size-5" />}</span>
      </div>
      <h2 className="serif mt-7 text-[24px] leading-tight tracking-[-0.01em]">{title}</h2>
      <p className="mt-2 max-w-[440px] text-[13.5px] text-zinc-500">{body}</p>
      <button type="button" onClick={onAction} className={cx("mt-6 inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-all hover:-translate-y-px", kind === "error" ? "bg-white text-ink ring-1 ring-zinc-200 hover:shadow-[0_6px_14px_-8px_rgba(9,9,11,.3)]" : "bg-ink text-white shadow-[0_1px_2px_rgba(9,9,11,.2)] hover:shadow-[0_6px_14px_-6px_rgba(9,9,11,.45)]")}>{kind === "error" ? <RotateCw className="size-3.5" /> : <Plus className="size-4" />}{action}</button>
    </Rise>
  );
}

function AgentsSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="mt-5 space-y-4">
      <div className="grid grid-cols-4 gap-4 @max-[900px]/main:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className={cx(CARD, "space-y-3 p-5")}><Skeleton className="h-4 w-1/2" /><Skeleton className="h-8 w-2/3" /><Skeleton className="h-3 w-1/3" /></div>)}</div>
      <div className={cx(CARD, "space-y-3 p-4")}><Skeleton className="h-9 w-1/2 rounded-full" />{Array.from({ length: 6 }, (_, i) => <div key={i} className="flex items-center gap-3"><Skeleton className="size-10 rounded-xl" /><Skeleton className="h-11 flex-1" /></div>)}</div>
    </div>
  );
}

/* ---------- screen ---------- */
export function AgentsScreen(p: AgentsScreenProps) {
  const { data: d, status = "ready" } = p;
  const rm = useReducedMotion();
  const [tab, setTab] = useState<AgentsTab>(p.tab ?? "agents");
  useEffect(() => { setTab(p.tab ?? "agents"); }, [p.tab]);
  const [sf, setSf] = useState<AgentStatusFilter>(p.statusFilter ?? "all");
  const [rf, setRf] = useState(p.runFilter ?? d.runFilters[0]?.id ?? "all");
  const [q, setQ] = useState(p.query ?? "");
  const [open, setOpen] = useState<string | null>(p.open ?? null);
  // Local, optimistic pause/resume and "run now", reported up through callbacks.
  const [pausedOver, setPausedOver] = useState<Record<string, boolean>>({});
  const [queued, setQueued] = useState<Set<string>>(() => new Set());
  const isPaused = (a: AgentListRow) => pausedOver[a.id] ?? a.status === "paused";
  const statusOf = (a: AgentListRow): AgentStatusId => (isPaused(a) ? "paused" : a.status === "paused" ? "live" : a.status);

  const ready = status === "ready";
  const empty = status === "empty" || d.agents.length === 0;
  const counts = useMemo(() => {
    const c: Record<AgentStatusFilter, number> = { all: d.agents.length, live: 0, paused: 0, attention: 0 };
    for (const a of d.agents) c[statusOf(a)]++;
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.agents, pausedOver]);
  const needle = q.trim().toLowerCase();
  const agentName = (id: string) => d.agents.find((a) => a.id === id)?.name ?? id;
  const agents = d.agents.filter((a) => (sf === "all" || statusOf(a) === sf) && (!needle || [a.name, a.job, a.trigger.label, a.trigger.sub, a.owner.name, ...a.tools.map((t) => TOOL_NAME[t])].some((t) => t.toLowerCase().includes(needle))));
  const rFilter = d.runFilters.find((x) => x.id === rf) ?? d.runFilters[0];
  const inRf = (r: AgentRunRow, f = rFilter) => !f || f.outcomes.length === 0 || f.outcomes.includes(r.outcome);
  const runs = d.runs.filter((r) => inRf(r) && (!needle || [r.subject.name, r.detail, agentName(r.agent), d.outcomeLabels[r.outcome]].some((t) => t.toLowerCase().includes(needle))));

  const pickTab = (t: AgentsTab) => { setTab(t); setQ(""); p.onTab?.(t); };
  const togglePause = (a: AgentListRow) => { const next = !isPaused(a); setPausedOver((o) => ({ ...o, [a.id]: next })); p.onPause?.(a.id, next); };
  const runNow = (a: AgentListRow) => { setQueued((s) => new Set(s).add(a.id)); if (isPaused(a)) setPausedOver((o) => ({ ...o, [a.id]: false })); p.onRunNow?.(a.id); };

  const tabs: { id: AgentsTab; label: string; count: number }[] = [{ id: "agents", label: "Agents", count: d.agents.length }, { id: "runs", label: "Runs", count: d.runs.length }];
  const st = d.states;

  return (
    <Page active={tab === "runs" ? "runs" : "agents"} shell={p.shell} top={<TopBar crumbs={[{ label: "Agents" }]} ctx="Agents" />}>
      <div className="mx-auto w-full max-w-[1240px] px-7 pt-6 pb-16">
        <div className="flex items-end justify-between px-1">
          <div>
            <div className="flex items-center gap-3"><h1 className="serif text-[34px] leading-none tracking-[-0.02em]">Agents</h1>{ready && !empty ? <span className="tnum inline-flex h-7 items-center rounded-full bg-white px-2.5 text-[13px] font-medium text-zinc-600 shadow-[0_1px_2px_rgba(9,9,11,.05)] ring-1 ring-zinc-200/80">{d.agents.length}</span> : null}</div>
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-zinc-500">
              {ready && !empty && <><span className="inline-flex items-center gap-1.5 font-medium text-ok"><Pulse className="bg-[#2f9a5c]" />{counts.live} live</span><span>·</span>{counts.attention > 0 && <><span className="font-medium text-warn">{counts.attention} {d.statusLabels.attention.toLowerCase()}</span><span>·</span></>}</>}
              <span>{d.header.scope}</span>
            </p>
          </div>
          <button type="button" onClick={p.onNewAgent} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink pr-4 pl-3 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(9,9,11,.2),inset_0_1px_0_rgba(255,255,255,.12)] transition-all hover:-translate-y-px hover:shadow-[0_6px_14px_-6px_rgba(9,9,11,.45)]"><Plus className="size-4" />New agent</button>
        </div>

        <div role="tablist" aria-label="Agents view" className="mt-5 flex items-center gap-6 border-b border-zinc-200/70 px-1">
          {tabs.map((t) => { const on = tab === t.id; return (
            <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => pickTab(t.id)} className={cx("relative flex h-10 items-center gap-2 text-[14px] transition-colors", on ? "font-medium text-ink" : "text-zinc-500 hover:text-ink")}>
              {t.label}{ready && !empty && <span className={cx("tnum inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-medium", on ? "bg-ink text-white" : "bg-white text-zinc-500 ring-1 ring-zinc-200")}>{t.count}</span>}
              {on && <motion.span layoutId={rm ? undefined : "agents-tab"} transition={{ type: "spring", stiffness: 500, damping: 40 }} className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-ink" />}
            </button>
          ); })}
        </div>

        {status === "loading" ? <AgentsSkeleton />
          : status === "error" ? <AgentsState kind="error" title={st.errorTitle} body={p.error ?? st.errorBody} action={st.errorAction} onAction={p.onRetry} />
          : empty ? <AgentsState kind="empty" title={st.emptyTitle} body={st.emptyBody} action={st.emptyAction} onAction={p.onNewAgent} />
          : <>
          <div className="mt-5 grid grid-cols-4 gap-4 @max-[900px]/main:grid-cols-2">{d.stats.map((s, i) => <Rise key={s.id} i={i}><StatCard s={s} /></Rise>)}</div>

          <Rise i={4} className="mt-4">
            <section className={cx(CARD, "@container/at")}>
              <AnimatePresence mode="wait" initial={false}>
                {tab === "agents" ? (
                  <motion.div key="agents" initial={rm ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
                    <div className="flex items-center gap-3 px-4 pt-3.5 pb-3 @max-[1000px]/at:flex-wrap">
                      <FilterPills group="agent-status" on={sf} onPick={setSf} items={(["all", "live", "paused", "attention"] as const).map((id) => ({
                        id, label: id === "all" ? "All" : d.statusLabels[id], count: counts[id],
                        dot: id === "live" ? <Pulse className="bg-[#2f9a5c]" /> : id === "attention" ? <span className="block size-1.5 rounded-full bg-[#d39a2c]" /> : undefined,
                      }))} />
                      <div className="ml-auto flex shrink-0 items-center gap-2 @max-[1000px]/at:ml-0 @max-[1000px]/at:w-full"><SearchBox value={q} onChange={setQ} placeholder={d.search.agents} label="Search agents" /></div>
                    </div>
                    <div className={cx("grid h-10 items-center gap-x-3 border-y border-zinc-100 bg-zinc-50/50 px-4 text-[11.5px] text-zinc-500", AGENT_COLS)}>
                      <span>Agent</span><span>Trigger</span><span>Uses</span><span>Status</span><span className={WIDE}>Recent activity</span><span className={WIDE}>Last run</span><span className={WIDE}>Owner</span><span />
                    </div>
                    <ul className="relative">
                      <AnimatePresence mode="popLayout" initial={!rm}>
                        {agents.map((a, i) => <AgentRow key={a.id} a={a} i={i} label={(s) => d.statusLabels[s]} open={open === a.id} focus={p.open === a.id} paused={isPaused(a)} queued={queued.has(a.id)} me={p.shell.user}
                          onToggle={() => setOpen((o) => (o === a.id ? null : a.id))} onPause={() => togglePause(a)} onRun={() => runNow(a)} />)}
                        {agents.length === 0 && <motion.li key="none" initial={rm ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-12 text-center text-[13px] text-zinc-500">{needle ? <>No agents match “{q}”.</> : <>No agents are {sf === "all" ? "set up" : d.statusLabels[sf as AgentStatusId].toLowerCase()} right now.</>}</motion.li>}
                      </AnimatePresence>
                    </ul>
                    <div className="flex h-12 items-center justify-between rounded-b-[20px] border-t border-zinc-100 px-4 text-[12px] text-zinc-500">
                      <span className="tnum">Showing <b className="font-medium text-ink">{agents.length}</b> of {d.agents.length}</span>
                      {d.footnote && <span className="flex items-center gap-2"><Src k="crust">Crustdata</Src><span className="tnum">{d.footnote}</span></span>}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="runs" initial={rm ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
                    <div className="flex items-center gap-3 px-4 pt-3.5 pb-3 @max-[1000px]/at:flex-wrap">
                      <FilterPills group="run-outcome" on={rf} onPick={setRf} items={d.runFilters.map((f) => ({ id: f.id, label: f.label, count: d.runs.filter((r) => inRf(r, f)).length, dot: f.outcomes.includes("waiting") ? <span className="block size-1.5 rounded-full bg-rust" /> : undefined }))} />
                      <div className="ml-auto flex shrink-0 items-center gap-2 @max-[1000px]/at:ml-0 @max-[1000px]/at:w-full"><SearchBox value={q} onChange={setQ} placeholder={d.search.runs} label="Search runs" /></div>
                    </div>
                    <div className={cx("grid h-10 items-center gap-x-3 border-y border-zinc-100 bg-zinc-50/50 px-4 text-[11.5px] text-zinc-500", RUN_COLS)}>
                      <span>Company</span><span>Agent</span><span>Outcome</span><span>Steps</span><span className={WIDE}>Duration</span><span className={WIDE}>Started</span><span />
                    </div>
                    <ul className="relative">
                      <AnimatePresence mode="popLayout" initial={!rm}>
                        {runs.map((r, i) => <RunRow key={r.id} r={r} i={i} agent={d.agents.find((a) => a.id === r.agent)} label={d.outcomeLabels[r.outcome]} />)}
                        {runs.length === 0 && <motion.li key="none" initial={rm ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-12 text-center text-[13px] text-zinc-500">{needle ? <>No runs match “{q}”.</> : "No runs with this outcome yet."}</motion.li>}
                      </AnimatePresence>
                    </ul>
                    <div className="flex h-12 items-center justify-between rounded-b-[20px] border-t border-zinc-100 px-4 text-[12px] text-zinc-500">
                      <span className="tnum">Showing <b className="font-medium text-ink">{runs.length}</b> of {d.runs.length} runs from {d.runsWindow}</span>
                      <button type="button" onClick={() => pickTab("agents")} className="inline-flex items-center gap-1 hover:text-ink">All agents<ChevronDown className="size-3.5 -rotate-90" /></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </Rise>

          {(d.running || d.waiting.length > 0) && (
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-4 @max-[900px]/main:grid-cols-1">
              {d.running && <Rise i={5} className="h-full"><LiveRail run={d.running} boxed tone="sienna" className={cx(CARD, "h-full")} /></Rise>}
              {d.waiting.length > 0 && <Rise i={6} className="h-full"><WaitingCard d={d} /></Rise>}
            </div>
          )}
        </>}
      </div>
    </Page>
  );
}
