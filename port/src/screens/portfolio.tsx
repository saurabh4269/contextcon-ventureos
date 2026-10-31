"use client";
/**
 * v4 · Portfolio in Today's language: serif title + one hero number, four stat cards, a filterable table
 * (Today's pill tabs, logo + two-line rows, status pills), report cards that open drafted documents, and a
 * Callora-style detail column (runway chart with hover tooltip, facts, pattern, the decision) over the live rail.
 */
import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, ChevronRight, Download, FileText, ListFilter, Mail, Presentation, Sparkles, TrendingDown, TrendingUp, TriangleAlert, Undo2 } from "lucide-react";
import { RunwayChart, MiniBars } from "../components/charts";
import { Page, TopBar } from "../components/shell";
import { LiveRail } from "../components/liverail";
import { Src, Spark, cx, CompanyLogo, CARD, Undo } from "../components/ui";
import { StagePill, type PillTone } from "../components/dealbits";
import { Sheet, PillBtn, Popover, downloadText, csvRow } from "../components/sheet";
import { Rise, Count, Grow } from "../components/motion";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/states";
import type { PortfolioCompany, PortfolioData, PortfolioDoc, PortfolioPanel, ReportTile, ScreenStatus, ShellData, Tone } from "../types";

export interface PortfolioScreenProps extends ScreenStatus {
  shell: ShellData;
  data: PortfolioData;
  onSelect?: (companyId: string) => void;
  onExport?: () => void;
  onAction?: (actionId: string) => void;
  onOpenReport?: (reportId: string) => void;
  /** v3.2 · kept for compatibility; rows now open the detail column. */
  onRowAction?: (companyId: string, action: "update" | "message" | "ask") => void;
}

const TONE: Record<Tone, PillTone> = { ok: "ok", warn: "warn", rust: "rust", neutral: "neutral", ink: "ink" };
const TONE_TEXT: Record<Tone, string> = { ok: "text-ok", warn: "text-warn", rust: "text-rust", neutral: "text-zinc-600", ink: "text-ink" };
const SORTS = [{ id: "default", label: "Needs you first" }, { id: "runway", label: "Runway, lowest first" }, { id: "arr", label: "ARR, highest first" }, { id: "name", label: "Name, A to Z" }] as const;
type SortId = (typeof SORTS)[number]["id"];
// Columns follow the table's own width (container query): the 6-month trend and Update columns join from 720px.
const COLS = "grid-cols-[minmax(170px,1fr)_64px_minmax(116px,.8fr)_minmax(124px,auto)] @[720px]/tb:grid-cols-[minmax(190px,1.6fr)_64px_92px_minmax(124px,1fr)_52px_minmax(128px,auto)] gap-x-4";
const WIDE = "hidden @[720px]/tb:flex";
const lastOf = (a: number[]) => a[a.length - 1] ?? 0;
const fmtM = (n: number) => `$${n.toFixed(1)}M`;
const attention = (c: PortfolioCompany) => !!c.alert && c.alert.tone !== "ok";
const matches = (c: PortfolioCompany, f: string) => f === "all" ? true : f === "attention" ? attention(c) : c.alert?.kind === f;

/* ───────── Stat cards (Today's MetricCard chrome, compact) ───────── */
function Stat({ label, sub, value, unit, viz, chip, onClick, vizWide }: { label: string; sub: ReactNode; value: ReactNode; unit?: string; viz?: ReactNode; chip?: ReactNode; onClick?: () => void; /** viz only when the card is at least 230px wide */ vizWide?: boolean }) {
  const body = <>
    <div className="flex items-start gap-3"><span className="min-w-0"><span className="block text-[14px] font-medium">{label}</span><span className="block truncate text-[12px] text-zinc-500">{sub}</span></span>{chip && <span className="ml-auto shrink-0">{chip}</span>}</div>
    <div className="mt-3 flex items-end gap-2"><span className="numeral text-[38px] leading-[.9]">{value}</span>{unit && <span className="pb-0.5 text-[12.5px] text-zinc-500">{unit}</span>}<span className={cx("ml-auto self-end", vizWide && "hidden @[230px]/st:block")}>{viz}</span></div>
  </>;
  return onClick ? <button type="button" onClick={onClick} className={cx(CARD, "@container/st block p-5 text-left transition-shadow hover:shadow-[0_1px_2px_rgba(9,9,11,.04),0_18px_36px_-18px_rgba(9,9,11,.22)]")}>{body}</button> : <div className={cx(CARD, "@container/st p-5")}>{body}</div>;
}
function Delta({ up, children }: { up: boolean; children: ReactNode }) {
  return <span className={cx("tnum inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-medium", up ? "bg-ok-50 text-ok" : "bg-rust-50 text-rust")}>{up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{children}</span>;
}
function Stats({ d, onFilter }: { d: PortfolioData; onFilter: (f: string) => void }) {
  const cs = d.companies, alert = d.alertLineMonths;
  const n = Math.max(...cs.map((c) => c.arrTrend.length));
  const total = Array.from({ length: n }, (_, i) => cs.reduce((s, c) => s + (c.arrTrend[c.arrTrend.length - n + i] ?? c.arrTrend[0] ?? 0), 0));
  const growth = total[0] ? lastOf(total) / total[0] - 1 : 0;
  const runways = cs.map((c) => c.runwayMonths).sort((a, b) => a - b), med = runways[Math.floor(runways.length / 2)] ?? 0;
  const low = cs.filter((c) => c.runwayMonths < alert).length;
  const kpi = d.reports.find((r): r is Extract<ReportTile, { kind: "kpiRequests" }> => r.kind === "kpiRequests");
  const dot = (c: PortfolioCompany) => c.runwayMonths < alert ? "bg-rust" : attention(c) ? "bg-[#d39a2c]" : c.alert?.tone === "ok" ? "bg-[#2f9a5c]" : "bg-zinc-300";
  return (
    <div className="grid grid-cols-4 gap-4">
      <Stat label="Companies" sub={`${d.fundLabel} · ${cs.filter((c) => !c.onTrack).length} with news`} value={<Count to={cs.length} />}
        viz={<span className="grid grid-cols-7 gap-[3px]" aria-label="Status of each company">{cs.map((c) => <span key={c.id} title={`${c.company.name}${c.alert ? ` · ${c.alert.label}` : " · on track"}`} className={cx("size-[9px] rounded-[3px]", dot(c))} />)}</span>} />
      <Stat label="Combined ARR" sub={`${total.length} months · latest KPIs`} value={fmtM(lastOf(total))} chip={<Delta up={growth >= 0}>{`${growth >= 0 ? "+" : "−"}${Math.round(Math.abs(growth) * 100)}%`}</Delta>}
        vizWide viz={<Spark d={total} w={86} h={30} color="#09090b" />} />
      <Stat label="Median runway" sub={low ? `${low} below the ${alert} mo line` : `All above the ${alert} mo line`} value={<Count to={med} />} unit="mo" onClick={low ? () => onFilter("runway") : undefined}
        viz={<MiniBars d={runways} w={92} h={30} hl={0} tone={low ? "rust" : "ink"} />} />
      {kpi && <Stat label="KPIs in" sub={kpi.caption} value={<>{kpi.received}<span className="font-sans text-[15px] text-zinc-400">/{kpi.total}</span></>}
        viz={<span className="flex gap-[3px]">{Array.from({ length: kpi.total }).map((_, i) => <span key={i} className={cx("h-[22px] w-[5px] rounded-[2px]", i < kpi.received ? "bg-ink" : "bg-zinc-200")} />)}</span>} />}
    </div>
  );
}

/* ───────── Table ───────── */
function RunwayBar({ c, d }: { c: PortfolioCompany; d: PortfolioData }) {
  const low = c.runwayMonths < d.alertLineMonths;
  return (
    <span className="flex items-center gap-2.5" title={`${c.runwayMonths} months · alert line ${d.alertLineMonths} mo`}>
      <span className="relative h-[6px] w-full max-w-[84px] min-w-[56px] rounded-full bg-zinc-100"><Grow w={`${Math.min(c.runwayMonths / d.runwayAxisMax, 1) * 100}%`} className={cx("absolute inset-y-0 left-0 rounded-full", low ? "bg-rust" : "bg-ink")} /><span className="absolute -top-[3px] h-3 w-px bg-zinc-400" style={{ left: `${(d.alertLineMonths / d.runwayAxisMax) * 100}%` }} /></span>
      <span className={cx("tnum text-[12.5px] whitespace-nowrap", low ? "font-semibold text-rust" : "text-zinc-600")}>{c.runwayMonths} mo</span>
    </span>
  );
}
function Row({ c, d, sel, onSelect, i }: { c: PortfolioCompany; d: PortfolioData; sel: boolean; onSelect: () => void; i: number }) {
  const flat = c.alert?.kind === "growth";
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.025 }}>
      <button type="button" onClick={onSelect} aria-pressed={sel} className={cx("group relative grid h-[60px] w-full items-center border-b border-zinc-100 px-4 text-left text-[13px] outline-none transition-colors focus-visible:bg-[#f8f7f5]", COLS, sel ? "bg-rust-50/45" : "hover:bg-[#f8f7f5]")}>
        {sel && <motion.span layoutId="pf-sel" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-rust" />}
        <span className="flex min-w-0 items-center gap-3"><CompanyLogo c={c.company} size={32} /><span className="min-w-0"><span className="block truncate font-medium">{c.company.name}</span>{c.line && <span className="block truncate text-[11.5px] text-zinc-500">{c.line}</span>}</span></span>
        <span className="tnum text-right font-medium">{c.arr}</span>
        <span className={cx(WIDE, "justify-center")}><Spark d={c.arrTrend} w={80} h={24} color={flat ? "#c58a26" : c.runwayMonths < d.alertLineMonths ? "#9c440f" : "#09090b"} /></span>
        <RunwayBar c={c} d={d} />
        <span className={cx(WIDE, "tnum text-[12.5px]", c.lastUpdate.late ? "font-medium text-warn" : "text-zinc-500")}>{c.lastUpdate.label}</span>
        <span className="flex items-center justify-end gap-2">{c.alert ? <StagePill tone={TONE[c.alert.tone]}>{c.alert.label}</StagePill> : <span className="text-[12px] text-zinc-400">On track</span>}<ArrowRight className={cx("size-3.5 transition-all", sel ? "text-rust" : "-translate-x-1 text-zinc-300 opacity-0 group-hover:translate-x-0 group-hover:opacity-100")} /></span>
      </button>
    </motion.li>
  );
}

function Table({ d, filter, setFilter, sel, onSelect }: { d: PortfolioData; filter: string; setFilter: (f: string) => void; sel: string; onSelect: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false), [sort, setSort] = useState<SortId>("default"), [saved, setSaved] = useState<string | null>(null);
  const filters = d.filters ?? [{ id: "all", label: "All" }];
  const inFilter = d.companies.filter((c) => matches(c, filter));
  const sorted = useMemo(() => {
    const a = [...inFilter];
    if (sort === "runway") a.sort((x, y) => x.runwayMonths - y.runwayMonths);
    if (sort === "arr") a.sort((x, y) => lastOf(y.arrTrend) - lastOf(x.arrTrend));
    if (sort === "name") a.sort((x, y) => x.company.name.localeCompare(y.company.name));
    return a;
  }, [inFilter, sort]);
  // Folding only applies to the unsorted "All" view; any filter or sort shows every matching row.
  const folds = filter === "all" && sort === "default" && !expanded;
  const shown = folds ? sorted.filter((c) => !c.onTrack) : sorted, hidden = sorted.length - shown.length;
  const exportCsv = (rows: PortfolioCompany[], tag: string) => {
    const head = ["Company", "Sector · stage", "ARR", "Burn / mo", "Cash", "Runway (mo)", "Last update", "Status"];
    const body = rows.map((c) => csvRow([c.company.name, c.line ?? "", c.arr, c.burn, c.cash ?? "", c.runwayMonths, c.lastUpdate.label, c.alert?.label ?? "On track"]));
    const name = `${d.exportName ?? "portfolio"}${tag}.csv`;
    downloadText(name, [csvRow(head), ...body].join("\n"), "text/csv");
    setSaved(`${name} · ${rows.length} rows`); setTimeout(() => setSaved(null), 2600);
  };
  return (
    <section className={cx(CARD, "@container/tb overflow-hidden")}>
      <div role="tablist" aria-label="Filter companies" className="flex items-center gap-1.5 px-4 pt-4 pb-3">
        {filters.map((f) => { const n = d.companies.filter((c) => matches(c, f.id)).length; if (!n && f.id !== "all") return null; return (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)} className={cx("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] whitespace-nowrap transition-colors @[720px]/tb:h-9 @[720px]/tb:px-4 @[720px]/tb:text-[13px]", filter === f.id ? "bg-ink text-white shadow-[0_1px_2px_rgba(9,9,11,.2)]" : "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-200/70 hover:bg-white hover:text-ink")}>{f.label}<span className="tnum text-[11px] text-zinc-400">{n}</span></button>
        ); })}
        <span className="ml-auto flex items-center gap-2">
          <AnimatePresence>{saved && <motion.span initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} role="status" className="flex items-center gap-1 text-[11.5px] text-ok"><Check className="size-3.5" />Saved</motion.span>}</AnimatePresence>
          <Popover icon={<ListFilter />} label="Sort and fold" w={250} badge={sort !== "default" ? 1 : undefined}>{(close) => <>
            <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-zinc-500">Sort rows</div>
            {SORTS.map((s) => <button key={s.id} type="button" onClick={() => { setSort(s.id); close(); }} className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px] hover:bg-zinc-50">{s.label}{sort === s.id && <Check className="ml-auto size-3.5 text-rust" />}</button>)}
            <div className="mx-2 my-1.5 h-px bg-zinc-100" />
            <button type="button" onClick={() => { setExpanded((e) => !e); close(); }} className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px] hover:bg-zinc-50">{expanded ? "Fold on-track companies" : "Show on-track companies"}<span className="tnum ml-auto text-[11.5px] text-zinc-400">{d.companies.filter((c) => c.onTrack).length}</span></button>
          </>}</Popover>
          <Popover icon={<Download />} label="Download CSV" w={260}>{(close) => <>
            <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-zinc-500">Download as CSV</div>
            <button type="button" onClick={() => { exportCsv(sorted, filter === "all" ? "" : `-${filter}`); close(); }} className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] hover:bg-zinc-50"><FileText className="size-3.5 text-zinc-400" />This view<span className="tnum ml-auto text-[11.5px] text-zinc-400">{sorted.length} rows</span></button>
            <button type="button" onClick={() => { exportCsv(d.companies, "-all"); close(); }} className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] hover:bg-zinc-50"><FileText className="size-3.5 text-zinc-400" />All of {d.fundLabel}<span className="tnum ml-auto text-[11.5px] text-zinc-400">{d.companies.length} rows</span></button>
          </>}</Popover>
        </span>
      </div>
      <div className={cx("grid h-10 items-center border-y border-zinc-100 bg-zinc-50/50 px-4 text-[11.5px] text-zinc-500", COLS)}>
        <span>Company</span><span className="text-right">ARR</span><span className={cx(WIDE, "justify-center")}>Trend</span><span title={`Tick marks the ${d.alertLineMonths} mo alert line`}>Runway</span><span className={WIDE}>Update</span><span className="pr-[22px] text-right">Status</span>
      </div>
      <ul>
        <AnimatePresence initial={false}>{shown.map((c, i) => <Row key={c.id} c={c} d={d} i={i} sel={sel === c.id} onSelect={() => onSelect(c.id)} />)}</AnimatePresence>
        {shown.length === 0 && <li className="px-4 py-10 text-center text-[13px] text-zinc-500">No companies match this filter.</li>}
      </ul>
      {(hidden > 0 || (filter === "all" && sort === "default" && expanded)) && (
        <button type="button" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} className="group flex h-11 w-full items-center gap-2 border-t border-zinc-100 bg-zinc-50/40 px-4 text-[12.5px] text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-ink">
          <span className="flex -space-x-1.5">{d.companies.filter((c) => c.onTrack).slice(0, 4).map((c) => <CompanyLogo key={c.id} c={c.company} size={20} className="ring-2 ring-white" />)}</span>
          {expanded ? "Fold on-track companies" : <><span className="font-medium text-ink">+{hidden} on track</span><span className="text-zinc-400">· runway above {d.alertLineMonths} mo, KPIs current</span></>}
          <ChevronDown className={cx("ml-auto size-4 text-zinc-400 transition-transform", expanded && "rotate-180")} />
        </button>
      )}
    </section>
  );
}

/* ───────── Reports (Today's "Waiting on you" list) ───────── */
function Reports({ reports, onOpen, done }: { reports: ReportTile[]; onOpen: (id: string) => void; done: Record<string, string> }) {
  const icon = (r: ReportTile) => r.kind === "lpUpdate" ? <FileText /> : r.kind === "boardDeck" ? <Presentation /> : <Mail />;
  return (
    <section className={cx(CARD, "@container/rp flex h-full flex-col p-5")}>
      <div className="flex items-baseline justify-between gap-3"><span className="text-[14px] font-medium whitespace-nowrap">Board decks & LP updates</span><span className="hidden text-[12px] whitespace-nowrap text-zinc-500 @[380px]/rp:inline">From the KPI packs</span></div>
      <ul className="mt-2 -mx-2 flex flex-1 flex-col divide-y divide-zinc-100">
        {reports.map((r) => (
          <li key={r.id} className="flex flex-1 flex-col justify-center py-1">
            <button type="button" onClick={() => onOpen(r.id)} className="group flex min-h-[56px] w-full items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-zinc-50">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200/70 [&_svg]:size-3.5">{icon(r)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-zinc-800">{r.title}</span>
                {done[r.id] ? <span className="flex items-center gap-1 text-[11.5px] font-medium text-ok"><Check className="size-3" />{done[r.id]}</span> : <span className="block truncate text-[11.5px] text-zinc-500">{r.caption}</span>}
              </span>
              <span className="shrink-0 text-right">
                {r.kind === "lpUpdate" && <span className="flex w-[60px] flex-col items-end gap-1.5 @[400px]/rp:w-[84px]"><span className="tnum text-[12px] text-zinc-600">{Math.round(r.progress * 100)}%</span><span className="block h-1 w-full rounded-full bg-zinc-100"><Grow w={`${r.progress * 100}%`} className="h-full rounded-full bg-ink" /></span></span>}
                {r.kind === "boardDeck" && <span className="serif text-[15px] whitespace-nowrap @[400px]/rp:text-[17px]">{r.date}</span>}
                {r.kind === "kpiRequests" && <span className="tnum text-[15px] font-medium">{r.received}<span className="text-[12px] font-normal text-zinc-400">/{r.total}</span></span>}
              </span>
              <ChevronRight className="size-3.5 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ───────── Document sheet (reports + decision) ───────── */
function DocBody({ doc }: { doc: PortfolioDoc }) {
  return (
    <div className="space-y-5">
      {doc.sections.map((s) => (
        <section key={s.id}>
          <h3 className="text-[12px] font-medium text-zinc-500">{s.title}</h3>
          {s.body && <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-800">{s.body}</p>}
          {s.items && <ul className="mt-2 divide-y divide-zinc-100 rounded-[14px] border border-zinc-200/70">
            {s.items.map((it) => <li key={it.label} className="flex min-h-11 items-center gap-3 px-3.5 py-2 text-[13px]">
              {it.done !== undefined && <span className={cx("grid size-[18px] shrink-0 place-items-center rounded-full", it.done ? "bg-ink text-white" : "border border-dashed border-zinc-300")}>{it.done && <Check className="size-2.5" strokeWidth={3} />}</span>}
              <span className={cx("min-w-0 flex-1", it.done === false && "text-zinc-500")}>{it.label}</span>
              {it.value && <span className={cx("tnum shrink-0 text-right text-[12.5px]", it.tone ? cx("font-medium", TONE_TEXT[it.tone]) : "text-zinc-600")}>{it.value}</span>}
            </li>)}
          </ul>}
        </section>
      ))}
    </div>
  );
}
function DocSheet({ doc, onClose, done, onDone, onUndo, decision }: { doc: PortfolioDoc; onClose: () => void; done: boolean; onDone: () => void; onUndo: () => void; decision?: PortfolioPanel["decision"] }) {
  const [pick, setPick] = useState(decision?.recommended ?? "");
  const opt = decision?.options.find((o) => o.id === pick);
  return (
    <Sheet title={doc.title} sub={doc.sub} onClose={onClose} w={540}
      eyebrow={<span className="flex items-center gap-2"><StagePill tone={done ? "ok" : "warn"}>{done ? doc.primary.done : doc.status}</StagePill>{doc.source && <Src k={doc.source.kind}>{doc.source.label}</Src>}</span>}
      foot={done
        ? <><span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ok"><Check className="size-4" />{doc.primary.done}{opt ? ` · ${opt.label}` : ""}</span><span className="ml-auto flex items-center gap-3"><Undo onClick={onUndo} /><PillBtn size="sm" onClick={onClose}>Close</PillBtn></span></>
        : <><span className="text-[12px] text-zinc-500">Nothing is sent until you press {doc.primary.label.toLowerCase().startsWith("send") ? "send" : "the button"}.</span><span className="ml-auto flex items-center gap-2"><PillBtn size="sm" onClick={onClose}>Keep as draft</PillBtn><PillBtn size="sm" primary icon={<ArrowRight />} onClick={onDone}>{doc.primary.label}</PillBtn></span></>}>
      {decision && (
        <section className="mb-6">
          <h3 className="text-[12px] font-medium text-zinc-500">Recommendation</h3>
          <div role="radiogroup" aria-label="Decision" className="mt-2 space-y-2">
            {decision.options.map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={pick === o.id} disabled={done} onClick={() => setPick(o.id)} className={cx("flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-left transition-all disabled:cursor-default", pick === o.id ? "bg-rust-50/60 ring-1 ring-rust/30" : "ring-1 ring-zinc-200/80 hover:ring-zinc-300")}>
                <span className={cx("grid size-[18px] shrink-0 place-items-center rounded-full", pick === o.id ? "bg-rust text-white" : "ring-1 ring-zinc-300")}>{pick === o.id && <span className="size-1.5 rounded-full bg-white" />}</span>
                <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-medium">{o.label}</span><span className="block text-[12px] text-zinc-500">{o.sub}</span></span>
                {o.id === decision.recommended && <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-white"><Sparkles className="size-3 text-[#f0b48a]" />Recommended</span>}
              </button>
            ))}
          </div>
        </section>
      )}
      <DocBody doc={doc} />
    </Sheet>
  );
}

/* ───────── Detail column ───────── */
type Detail = { company: PortfolioCompany["company"]; alert?: { label: string; tone: Tone }; runwayMonths: number; history: { month: string; months: number }[]; projection?: number; facts: PortfolioPanel["facts"]; pattern?: string; patternLabel: string; action: PortfolioPanel["action"]; decision?: PortfolioPanel["decision"]; line?: string; onboarded?: PortfolioPanel["onboarded"] };
function detailFor(d: PortfolioData, id: string): Detail {
  const c = d.companies.find((x) => x.id === id), pn = d.panel;
  if (!c || c.id === pn.company.id) return { ...pn, line: c?.line, patternLabel: pn.onboarded ? "What to watch" : "Pattern match" };
  const hist = c.runwayHistory ?? [{ month: c.lastUpdate.label, months: c.runwayMonths }];
  const kpis = { kind: "xlsx" as const, label: `${c.lastUpdate.label} KPIs` };
  return {
    company: c.company, alert: c.alert, runwayMonths: c.runwayMonths, history: hist, line: c.line,
    projection: Math.max(0, Math.round((c.runwayMonths - 1) * 10) / 10),
    facts: [{ label: "Cash", value: c.cash ?? "—", source: kpis }, { label: "Burn", value: `${c.burn} / mo`, source: kpis }, { label: "ARR", value: c.arr, source: kpis }],
    patternLabel: "Founder", pattern: c.founder ? `${c.founder} · last update ${c.lastUpdate.label}${c.lastUpdate.late ? ", late" : ""}` : undefined,
    action: c.lastUpdate.late ? { id: `remind_${c.id}`, label: "Request latest KPIs" } : { id: `note_${c.id}`, label: `Draft a note to ${c.founder?.split(" ")[0] ?? c.company.name}` },
  };
}
function DetailCard({ x, alert, onPrimary, done, onUndo }: { x: Detail; alert: number; onPrimary: () => void; done?: string; onUndo: () => void }) {
  const low = x.runwayMonths < alert;
  return (
    <section className={cx(CARD, "@container/dc p-5")}>
      <div className="flex items-center gap-3"><CompanyLogo c={x.company} size={36} /><span className="min-w-0"><span className="block truncate text-[15px] font-medium">{x.company.name}</span>{x.line && <span className="block truncate text-[12px] text-zinc-500">{x.line}</span>}</span>{x.alert && <span className="ml-auto"><StagePill tone={TONE[x.alert.tone]}>{x.alert.label}</StagePill></span>}</div>
      <div className="mt-5 flex items-end gap-2"><span className={cx("numeral text-[52px] leading-[.85]", low ? "text-rust" : "text-ink")}><Count key={x.company.id} to={x.runwayMonths} decimals={Number.isInteger(x.runwayMonths) ? 0 : 1} /></span><span className="pb-0.5 text-[13px] whitespace-nowrap text-zinc-500">months of runway</span>{low && <span className="mb-0.5 ml-auto hidden h-6 whitespace-nowrap @[300px]/dc:inline-flex items-center gap-1 rounded-full bg-rust-50 px-2 text-[11.5px] font-medium text-rust"><TriangleAlert className="size-3" />below {alert} mo</span>}</div>
      <div className="mt-4 rounded-[16px] bg-[#fafaf9] px-3 pt-3 pb-1 ring-1 ring-zinc-200/60">
        <div className="mb-1 flex items-center justify-between px-1 text-[11.5px] text-zinc-500"><span>Runway · months</span>{x.onboarded ? <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10.5px] font-medium text-white"><Sparkles className="size-3" />{x.onboarded.label} · {x.onboarded.at}</span> : <span className="flex items-center gap-1.5"><span className="h-px w-3 border-t border-dashed border-rust" />{alert} mo alert</span>}</div>
        <RunwayChart key={x.company.id} history={x.history} projection={x.projection} alert={alert} w={300} h={150} />
      </div>
      {x.onboarded && <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11.5px]"><span className="text-zinc-500">From the deal:</span>{x.onboarded.from.map((f) => <span key={f} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700"><Check className="size-3 text-ok" />{f}</span>)}</div>}
      <dl className="mt-4 divide-y divide-zinc-100 text-[13px]">
        {x.facts.map((f) => <div key={f.label} className="flex h-11 items-center gap-3"><dt className="w-[72px] shrink-0 whitespace-nowrap text-zinc-500">{f.label}</dt><dd className="tnum font-medium whitespace-nowrap">{f.value}</dd><span className="ml-auto"><Src k={f.source.kind}>{f.source.label}</Src></span></div>)}
      </dl>
      {x.pattern && <div className="mt-3 rounded-[14px] bg-[#fbf6f0] px-3.5 py-3 ring-1 ring-[#f1e2d2]"><div className="flex items-center gap-1.5 text-[11.5px] font-medium text-rust"><Sparkles className="size-3" />{x.patternLabel}</div><div className="mt-1 text-[13px] leading-snug text-zinc-800">{x.pattern}</div></div>}
      <div className="mt-4 flex items-center gap-3">
        {done
          ? <><span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium text-ok"><Check className="size-4 shrink-0" /><span className="truncate">{done}</span></span><button type="button" onClick={onUndo} className="ml-auto inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-ink"><Undo2 className="size-3.5" />Undo</button></>
          : <PillBtn primary icon={<Sparkles className="text-[#f0b48a]" />} onClick={onPrimary} className="w-full">{x.action.label}</PillBtn>}
      </div>
    </section>
  );
}

export function PortfolioScreen(p: PortfolioScreenProps) {
  const { data: d, status = "ready" } = p, alert = d.alertLineMonths;
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState(d.companies.find((c) => c.selected)?.id ?? d.panel.company.id);
  const [open, setOpen] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const need = d.companies.filter(attention).length;
  const x = detailFor(d, sel);
  const select = (id: string) => { setSel(id); p.onSelect?.(id); };
  const primary = () => { p.onAction?.(x.action.id); if (x.decision) setOpen("decision"); else setDone((s) => ({ ...s, [x.action.id]: x.action.label.startsWith("Request") ? "Request drafted in Gmail" : x.action.label.startsWith("Draft") ? "Draft saved to Gmail" : `${x.action.label} · done` })); };
  const undo = (k: string) => setDone((s) => { const n = { ...s }; delete n[k]; return n; });
  const doc: PortfolioDoc | undefined = open === "decision" ? x.decision : open ? d.docs?.[open] : undefined;
  const top = <TopBar crumbs={[{ label: "Portfolio" }]} ctx="Portfolio" lead={<span className="flex items-baseline gap-2"><span className="text-[13px] font-medium text-ink">Portfolio</span><span className="text-zinc-300">/</span><span className="truncate">{d.fundLabel}</span></span>} />;
  const decisionDone = x.decision ? done[x.action.id] : undefined;
  return (
    <Page active="portfolio" shell={p.shell} top={top}
      overlay={doc && open ? <DocSheet key={open} doc={doc} decision={open === "decision" ? x.decision : undefined} onClose={() => setOpen(null)} done={!!done[open === "decision" ? x.action.id : open]} onDone={() => { const k = open === "decision" ? x.action.id : open; setDone((s) => ({ ...s, [k]: doc.primary.done })); }} onUndo={() => undo(open === "decision" ? x.action.id : open)} /> : undefined}>
      {status === "loading" ? <ScreenSkeleton cols="grid-cols-[1fr_360px]" /> : status === "error" ? <ErrorState message={p.error} onRetry={p.onRetry} /> : status === "empty" || d.companies.length === 0 ? <EmptyState title="No portfolio companies yet" body="Closed deals land here with their memo, model and data room. You can also import a fund from Carta in Settings." /> : (
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-7 pt-7 pb-16">
        <div className="flex items-end justify-between px-1 pt-1">
          <div><h1 className="serif text-[36px] leading-none tracking-[-0.02em]">Portfolio</h1><p className="mt-2.5 text-[14px] text-zinc-500">{d.fundLabel} · {d.companies.length} companies{d.sub ? ` · ${d.sub}` : ""}</p></div>
          <button type="button" onClick={() => setFilter("attention")} className="group text-right" aria-label={`Show the ${need} companies that need attention`}>
            <span className={cx("numeral block text-[52px] leading-[.85] transition-colors", need ? "group-hover:text-rust" : "")}>{need}</span>
            <span className="mt-1.5 flex items-center justify-end gap-1.5 text-[12px] text-zinc-500"><TriangleAlert className="size-3.5" />need attention</span>
          </button>
        </div>
        <Rise i={0}><Stats d={d} onFilter={setFilter} /></Rise>
        <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-5 @max-[1120px]/main:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Rise i={1}><Table d={d} filter={filter} setFilter={setFilter} sel={sel} onSelect={select} /></Rise>
            <Rise i={2} className="grid grid-cols-2 items-stretch gap-4">
              {d.live && <LiveRail run={d.live} boxed tone="sienna" className={cx(CARD, "h-full")} />}
              <Reports reports={d.reports} done={done} onOpen={(id) => { p.onOpenReport?.(id); if (d.docs?.[id]) setOpen(id); }} />
            </Rise>
          </div>
          <Rise i={1} className="sticky top-[72px] flex flex-col gap-4">
            <DetailCard x={x} alert={alert} onPrimary={primary} done={decisionDone ?? done[x.action.id]} onUndo={() => undo(x.action.id)} />
          </Rise>
        </div>
      </div>
      )}
    </Page>
  );
}
