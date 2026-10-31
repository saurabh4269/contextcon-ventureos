"use client";
/**
 * v3.2 · Today summary. Left: an "Ask Deal Desk" card on a sienna orb wash, "Inbound this week" with one small
 * axis chart and a delta pill (P6), and "Waiting on you" counts. Main: greeting with one hero number, then the work
 * list (stage pills; checkbox, logo, company, fit score banded from data, sector, stage, owner, the decision inline).
 * The live step rail and Next meetings sit under the list. Calm: one accent, one chart.
 */
import Link from "next/link";
import { ArrowUpRight, ChevronRight, FileSignature, Inbox, Maximize2, Mic, PhoneCall, PieChart, Plus, ScanSearch, Search, Sparkles, TrendingDown, TrendingUp, UserPlus, Workflow } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Page, TopBar } from "../components/shell";
import { LiveRail } from "../components/liverail";
import { NextMeetings } from "../components/meeting";
import { ConnectChip } from "../components/connect";
import { InboundChart } from "../components/charts";
import { Skeleton, SkCard, EmptyState, ErrorState } from "../components/states";
import { CompanyLogo, cx } from "../components/ui";
import { FitPill, StagePill as SPill, Checkbox, OwnerChip, DecisionBtn, type PillTone } from "../components/dealbits";
import { Rise } from "../components/motion";
import { ROUTES } from "../routes";
import { type ScreenStatus, type ShellData, type ToolId, type TodaySummaryData, type WorkAction, type WorkRow, type WorkStage } from "../types";

const STAGES: { id: "all" | WorkStage; label: string }[] = [{ id: "all", label: "All" }, { id: "new", label: "New" }, { id: "screening", label: "Screening" }, { id: "diligence", label: "Diligence" }, { id: "ic", label: "IC" }];
const STAGE_LABEL: Record<WorkStage, string> = { new: "New", screening: "Screening", diligence: "Diligence", ic: "IC" };
/** Stage pill tones: New neutral, Screening warn, Diligence rust, IC ink (matches the filter pills' active ink). */
const STAGE_TONE: Record<WorkStage, PillTone> = { new: "neutral", screening: "warn", diligence: "rust", ic: "ink" };
const chipIcon = { search: <Search />, pipeline: <Workflow />, insight: <PieChart /> };
const WAIT_ICON: Record<WorkAction, ReactNode> = { memo: <FileSignature />, book: <PhoneCall />, claim: <UserPlus />, review: <ScanSearch />, pass: <Inbox /> };
/** Shared card chrome: 20px radius, hairline border, soft layered shadow. */
const CARD = "rounded-[20px] border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(9,9,11,.03),0_12px_32px_-18px_rgba(9,9,11,.10)]";
/** Film grain for the ask card wash (SVG turbulence, data URI). */
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export { FitPill };

function AskCard({ d, onAsk, onExpand }: { d: TodaySummaryData["ask"]; onAsk?: (q: string) => void; onExpand?: () => void }) {
  const expand = "ml-auto grid size-9 place-items-center rounded-full bg-white/75 text-zinc-600 shadow-[0_1px_2px_rgba(9,9,11,.06)] ring-1 ring-black/[.04] backdrop-blur hover:text-ink";
  return (
    <section className="relative overflow-hidden rounded-[20px] border border-[#f1e2d2] group-data-[dock=open]/page:hidden bg-[#fbf6f0] shadow-[0_1px_2px_rgba(120,60,20,.04),0_16px_36px_-20px_rgba(156,68,15,.28)]">
      {/* orb wash: amber core, sienna glow top-right, cream lift bottom-left, faint blush */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -right-24 size-[320px] rounded-full bg-[radial-gradient(circle,rgba(206,112,52,.42),rgba(206,112,52,.12)_45%,transparent_70%)] blur-[6px]" />
        <div className="absolute top-[70px] left-[18px] size-[300px] rounded-full bg-[radial-gradient(circle_at_60%_40%,rgba(246,196,120,.62),rgba(246,196,120,.18)_48%,transparent_72%)] blur-[2px]" />
        <div className="absolute -bottom-24 -left-20 size-[280px] rounded-full bg-[radial-gradient(circle,rgba(255,250,242,.95),transparent_65%)]" />
        <div className="absolute top-[150px] -right-10 size-[200px] rounded-full bg-[radial-gradient(circle,rgba(235,160,150,.22),transparent_70%)]" />
        <div className="absolute inset-0 opacity-[.07] mix-blend-multiply" style={{ backgroundImage: GRAIN }} />
      </div>
      <div className="relative flex flex-col p-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#d27a3e,#9c440f_70%)] text-white shadow-[0_6px_14px_-6px_rgba(156,68,15,.7),inset_0_1px_0_rgba(255,255,255,.3)]"><Sparkles className="size-4" strokeWidth={1.75} /></span>
          <span className="text-[14px] font-medium">Ask Deal Desk</span>
          {onExpand ? <button type="button" aria-label="Open the full assistant" onClick={onExpand} className={expand}><Maximize2 className="size-3.5" /></button> : <Link href={ROUTES.ask("today")} aria-label="Open the full assistant" className={expand}><Maximize2 className="size-3.5" /></Link>}
        </div>
        <p className="serif mt-11 line-clamp-3 text-[25px] leading-[1.2] tracking-[-0.01em] text-zinc-800">{d.prompt}</p>
        <div className="mt-4 flex flex-wrap gap-1">{d.chips.map((c) => <button key={c.id} type="button" onClick={() => onAsk?.(c.id)} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-white/70 pr-2.5 pl-2 text-[12px] whitespace-nowrap text-zinc-700 ring-1 ring-black/[.05] backdrop-blur transition-all hover:-translate-y-px hover:bg-white hover:text-ink hover:shadow-[0_6px_14px_-8px_rgba(120,60,20,.35)] [&_svg]:size-3.5 [&_svg]:text-rust/70">{chipIcon[c.icon]}{c.label}</button>)}</div>
        <form onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get("q") ?? "").trim(); if (v) onAsk?.(v); }} className="mt-5 flex items-center gap-2">
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-4 shadow-[0_1px_2px_rgba(9,9,11,.05)] ring-1 ring-black/[.04] focus-within:ring-rust/30"><Plus className="size-4 text-zinc-400" /><input aria-label="Ask Deal Desk" name="q" placeholder={d.placeholder} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-zinc-400" /></label>
          <button type="button" aria-label="Dictate" className="grid size-11 shrink-0 place-items-center rounded-full bg-rust text-white shadow-[0_8px_18px_-8px_rgba(156,68,15,.8),inset_0_1px_0_rgba(255,255,255,.22)] transition-transform hover:scale-[1.04] active:scale-95"><Mic className="size-[18px]" strokeWidth={1.9} /></button>
        </form>
      </div>
    </section>
  );
}

function MetricCard({ m }: { m: TodaySummaryData["metric"] }) {
  return (
    <section className={cx(CARD, "p-5")}>
      <div className="flex items-start gap-3">
        <span className="min-w-0"><span className="block text-[14px] font-medium">{m.label}</span><span className="block truncate text-[12px] text-zinc-500">{m.sub}</span></span>
        {m.href && <Link href={m.href} aria-label={`Open ${m.label}`} className="ml-auto grid size-9 shrink-0 place-items-center rounded-full text-zinc-500 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 hover:text-ink"><ArrowUpRight className="size-3.5" /></Link>}
      </div>
      <div className="mt-4 flex items-end gap-2.5">
        <span className="numeral text-[40px] leading-[.9]">{m.value}</span>
        <span className="pb-0.5 text-[12.5px] text-zinc-500">{m.unit}</span>
        <span className={cx("tnum ml-auto mb-0.5 inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-medium", m.up ? "bg-ok-50 text-ok" : "bg-rust-50 text-rust")}>{m.up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{m.delta}</span>
      </div>
      <div className="mt-3 -mx-1"><InboundChart days={m.days} series={m.series} unit={m.unit} h={120} /></div>
    </section>
  );
}

function WaitingCard({ w, rows }: { w: NonNullable<TodaySummaryData["waiting"]>; rows: WorkRow[] }) {
  const items = w.items.map((it) => ({ ...it, n: rows.filter((r) => r.action.kind === it.kind).length })).filter((it) => it.n > 0);
  const total = items.reduce((a, b) => a + b.n, 0);
  return (
    <section className={cx(CARD, "flex flex-1 flex-col p-5")}>
      <div className="flex items-baseline justify-between"><span className="text-[14px] font-medium">{w.label}</span><span className="tnum text-[12px] text-zinc-500">{total}</span></div>
      <ul className="mt-2 -mx-2 flex flex-1 flex-col divide-y divide-zinc-100">
        {items.map((it) => { const body = <>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200/70 [&_svg]:size-3.5">{WAIT_ICON[it.kind]}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-[13px] text-zinc-800">{it.label}</span>{it.due && <span className="block truncate text-[11.5px] text-rust">{it.due}</span>}</span>
          <span className="tnum min-w-6 text-right text-[15px] font-medium">{it.n}</span>
          <ChevronRight className="size-3.5 text-zinc-300 transition-colors group-hover:text-zinc-500" />
        </>; const cls = "group flex h-12 items-center gap-3 rounded-xl px-2 transition-colors hover:bg-zinc-50";
          return <li key={it.id} className="flex flex-1 flex-col justify-center py-1">{it.href ? <Link href={it.href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>}</li>; })}
      </ul>
    </section>
  );
}

function StagePill({ stage }: { stage: WorkStage }) {
  return <SPill tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</SPill>;
}

function ActionBtn({ r, onAction }: { r: WorkRow; onAction?: (id: string, k: WorkAction) => void }) {
  return <DecisionBtn label={r.action.label} recommended={r.action.recommended} href={r.href} onClick={() => onAction?.(r.id, r.action.kind)} />;
}


const Owner = ({ o, me }: { o?: WorkRow["owner"]; me?: ShellData["user"] }) => <OwnerChip o={o} me={me} />;

export function WorkList({ rows, filter, onFilter, onAction, waiting, me }: { me?: ShellData["user"]; rows: WorkRow[]; filter: "all" | WorkStage; onFilter: (f: "all" | WorkStage) => void; onAction?: (id: string, k: WorkAction) => void; waiting?: Record<string, ToolId> }) {
  const shown = filter === "all" ? rows : rows.filter((r) => r.stage === filter);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = shown.length > 0 && shown.every((r) => sel.has(r.id)), some = shown.some((r) => sel.has(r.id));
  // Columns follow the list's own width (container query), not the viewport, so the docked assistant can take space:
  // Sector shows from 780px, Owner from 600px; Company, Fit, Stage and the decision always stay.
  const COLS = "grid-cols-[18px_minmax(160px,1fr)_52px_88px_96px] @[600px]/wl:grid-cols-[18px_minmax(200px,1fr)_52px_88px_100px_96px] @[780px]/wl:grid-cols-[18px_minmax(244px,1.75fr)_52px_minmax(0,1fr)_88px_100px_96px]";
  const SECTOR = "hidden truncate @[780px]/wl:block", OWNER = "hidden min-w-0 @[600px]/wl:flex";
  return (
    <section className={cx(CARD, "@container/wl overflow-x-auto")}>
      <div role="tablist" aria-label="Stage" className="flex items-center gap-1.5 px-4 pt-4 pb-3">
        {STAGES.map((s) => { const n = s.id === "all" ? rows.length : rows.filter((r) => r.stage === s.id).length; return (
          <button key={s.id} type="button" role="tab" aria-selected={filter === s.id} onClick={() => onFilter(s.id)} className={cx("inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] transition-colors", filter === s.id ? "bg-ink text-white shadow-[0_1px_2px_rgba(9,9,11,.2)]" : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200/70 hover:bg-white hover:text-ink")}>{s.label}<span className={cx("tnum text-[11px]", filter === s.id ? "text-zinc-400" : "text-zinc-400")}>{n}</span></button>
        ); })}
        {some && <span className="tnum ml-auto text-[12px] text-zinc-500">{shown.filter((r) => sel.has(r.id)).length} selected</span>}
      </div>
      <div className={cx("grid h-10 items-center gap-x-3 border-y border-zinc-100 bg-zinc-50/50 px-4 text-[11.5px] text-zinc-500", COLS)}>
        <Checkbox on={allOn} mixed={!allOn && some} label="Select all" onChange={() => setSel(allOn ? new Set() : new Set(shown.map((r) => r.id)))} />
        <span>Company</span><span>Fit</span><span className={SECTOR}>Sector</span><span>Stage</span><span className={OWNER}>Owner</span><span className="text-right">Decision</span>
      </div>
      <ul>
        {shown.map((r, i) => (
          <Rise key={r.id} i={i}>
            <li className={cx("group grid h-[60px] items-center gap-x-3 border-b border-zinc-100 px-4 text-[13px] transition-colors last:border-0", COLS, sel.has(r.id) ? "bg-rust-50/50" : "hover:bg-[#f8f7f5]")}>
              <Checkbox on={sel.has(r.id)} label={`Select ${r.company.name}`} onChange={() => toggle(r.id)} />
              <span className="flex min-w-0 items-center gap-3 pr-1"><CompanyLogo c={r.company} size={32} /><span className="min-w-0"><span className="block truncate font-medium">{r.company.name}</span><span title={r.fit.why} className="block truncate text-[11.5px] text-zinc-500">{r.fit.why}</span></span></span>
              <FitPill score={r.fit.score} signals={r.fit.signals} />
              <span title={r.company.sector} className={cx(SECTOR, "whitespace-nowrap text-zinc-600")}>{/* one short tag until the list is wide enough for the full sector */}{r.company.sectorShort ? <><span className="@[900px]/wl:hidden">{r.company.sectorShort}</span><span className="hidden @[900px]/wl:inline">{r.company.sector}</span></> : r.company.sector}</span>
              <span><StagePill stage={r.stage} /></span>
              <span className={cx(OWNER, waiting?.[r.id] && "@[600px]/wl:hidden")}><Owner o={r.owner} me={me} /></span>
              <span className={cx("flex justify-end", waiting?.[r.id] && "@[600px]/wl:col-span-2")}>{waiting?.[r.id] ? <ConnectChip tool={waiting[r.id]} onClick={() => onAction?.(r.id, r.action.kind)} /> : <ActionBtn r={r} onAction={onAction} />}</span>
            </li>
          </Rise>
        ))}
        {shown.length === 0 && <li className="px-4 py-10 text-center text-[13px] text-zinc-500">Nothing at this stage.</li>}
      </ul>
    </section>
  );
}

/** Loading state: the loaded page's grid, with each card at its loaded height (4 work rows). */
function TodaySkeleton() {
  const bars = (n: number) => Array.from({ length: n }, (_, i) => <Skeleton key={i} className="h-3.5" />);
  return (
    <div aria-busy="true" aria-live="polite" className="mx-auto grid w-full max-w-[1240px] grid-cols-[320px_minmax(0,1fr)] gap-5 px-7 pt-7 pb-16 @max-[1040px]/main:grid-cols-1">
      <div className="flex flex-col gap-4 @max-[1040px]/main:order-2 @max-[1040px]/main:grid @max-[1040px]/main:grid-cols-2">
        <SkCard className="h-[366px] space-y-3 p-5 @max-[1040px]/main:h-[423px] group-data-[dock=open]/page:hidden"><Skeleton className="size-9 rounded-full" /><Skeleton className="mt-8 h-[74px]" /><Skeleton className="h-8 w-2/3" /><Skeleton className="h-11" /></SkCard>
        <SkCard className="h-[265px] space-y-3 p-5 @max-[1040px]/main:h-[423px]"><Skeleton className="h-4 w-1/2" />{bars(2)}<Skeleton className="h-[120px]" /></SkCard>
        <SkCard className="h-[127px] space-y-3 p-5"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-9" /></SkCard>
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-end justify-between px-1 pt-1 pb-2"><div className="min-w-0 flex-1"><Skeleton className="h-9 w-[479px] max-w-full @max-[720px]/main:h-[72px] @max-[720px]/main:w-[262px]" /><Skeleton className="mt-2.5 h-[21px] w-2/3" /></div><Skeleton className="h-[52px] w-[88px]" /></div>
        <SkCard className="h-[346px] space-y-3 p-4"><Skeleton className="h-9 w-2/3 rounded-full" />{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[48px]" />)}</SkCard>
        <div className="grid flex-1 grid-cols-2 items-stretch gap-4"><SkCard className="h-full min-h-[290px] space-y-3 p-5 @max-[1040px]/main:min-h-[95px]"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-10" /></SkCard></div>
      </div>
    </div>
  );
}

export function TodaySummaryScreen({ shell, data, overlay, filter: f0 = "all", onAction, onAsk, onExpand, onMeeting, activeMeeting, waiting, status = "ready", error, onRetry }: {
  shell: ShellData; data: TodaySummaryData; overlay?: ReactNode; filter?: "all" | WorkStage;
  onAction?: (rowId: string, kind: WorkAction) => void; onAsk?: (q: string) => void; onExpand?: () => void; onMeeting?: (id: string) => void; activeMeeting?: string; waiting?: Record<string, ToolId>;
} & ScreenStatus) {
  const [filter, setFilter] = useState(f0);
  const top = <TopBar crumbs={[{ label: "Today" }]} me={shell.user} lead={<span className="flex items-baseline gap-2"><span className="text-[13px] font-medium text-ink">Today</span><span className="text-zinc-300">/</span><span className="truncate">{data.date}</span></span>} />;
  const empty = status === "empty" || data.rows.length === 0;
  // Two columns while the page is wide; when the docked assistant narrows it (container query on <main>), one column:
  // the work comes first, the metric and waiting cards pair up underneath, and the Ask card hides (the dock replaces it).
  return (
    <Page active="today" shell={shell} overlay={overlay} top={top}>
      {status === "loading" ? <TodaySkeleton /> : status === "error" ? <ErrorState message={error} onRetry={onRetry} /> : (
      <div className="mx-auto grid w-full max-w-[1240px] grid-cols-[320px_minmax(0,1fr)] gap-5 px-7 pt-7 pb-16 @max-[1040px]/main:grid-cols-1">
        <div className="flex flex-col gap-4 @max-[1040px]/main:order-2 @max-[1040px]/main:grid @max-[1040px]/main:grid-cols-2">
          <AskCard d={data.ask} onAsk={onAsk} onExpand={onExpand} />
          <MetricCard m={data.metric} />
          {data.waiting && !empty && <WaitingCard w={data.waiting} rows={data.rows} />}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-end justify-between px-1 pt-1 pb-2">
            <div><h1 className="serif text-[36px] leading-none tracking-[-0.02em]">{data.greeting}</h1><p className="mt-2.5 text-[14px] text-zinc-500">{data.sub}</p></div>
            <Link href={ROUTES.pipeline} className="group text-right">
              <span className="numeral block text-[52px] leading-[.85] transition-colors group-hover:text-rust">{data.hero.value}</span>
              <span className="mt-1.5 flex items-center justify-end gap-1.5 text-[12px] text-zinc-500"><Inbox className="size-3.5" />{data.hero.label}</span>
              {data.hero.delta && <span className="tnum mt-1 block text-[11.5px] font-medium text-ok">{data.hero.delta}</span>}
            </Link>
          </div>
          {empty ? <EmptyState title="Inbox zero" body="No inbound waiting on a decision. New decks land here as they arrive." />
            : <WorkList me={shell.user} rows={data.rows} filter={filter} onFilter={setFilter} onAction={onAction} waiting={waiting} />}
          <div className="grid flex-1 grid-cols-2 items-stretch gap-4">
            {data.live && <LiveRail run={data.live} boxed tone="sienna" className={cx(CARD, "h-full")} />}
            <NextMeetings items={data.meetings} empty={data.meetingsEmpty} onOpen={onMeeting} active={activeMeeting} prepFooter className={cx(CARD, "h-full overflow-hidden")} />
          </div>
        </div>
      </div>)}
    </Page>
  );
}
