"use client";
/**
 * v3.4 · Agent flow canvas ("How this agent works"). Read-mostly: no palette, no node drag.
 * Everything comes from AgentFlowData: nodes sit in columns (x from the column, y from the fixture), edges route as
 * rounded orthogonal dashed lines with small branch pills, and a run is a timeline of node/edge beats.
 * The run is a pure function of time (flowRunAt) so any moment can be frozen (?t=ms, ?frame=n).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, ScanText, DatabaseZap, Split, Hash, Reply, CalendarClock, FolderOpen, Scale, Landmark, Users, ChartNoAxesColumn, FileText,
  MessageSquareText, Inbox, X, Minus, Plus, Maximize2, Pencil, ChevronDown, Lock, Lightbulb, Settings2, ArrowDownToLine, ArrowUpFromLine, Check,
} from "lucide-react";
import { Btn, Toggle, cx } from "./ui";
import { LiveRail } from "./liverail";
import { ToolLogo, TOOL_NAME } from "./tools";
import type { AgentFlowData, LiveRun, FlowEdge, FlowIcon, FlowKind, FlowNode, FlowTone, ToolId } from "../types";

/* ---------- run engine (pure) ---------- */
export type FlowNodeState = "idle" | "queued" | "running" | "done" | "skipped";
export type FlowEdgeState = "idle" | "queued" | "active" | "done" | "skipped";
export interface FlowRunView { live: boolean; ms: number; total: number; i: number; p: number; complete: boolean; node: Record<string, FlowNodeState>; edge: Record<string, FlowEdgeState> }

export const flowTotal = (d: AgentFlowData) => d.run.events.reduce((s, e) => s + e.ms, 0);
/** ms for screenshot frame n (1-based): the middle of beat n; past the end = the finished run. */
export function flowFrameMs(d: AgentFlowData, frame: number): number {
  const ev = d.run.events, f = Math.max(1, Math.round(frame));
  if (f > ev.length) return flowTotal(d);
  return ev.slice(0, f - 1).reduce((s, e) => s + e.ms, 0) + ev[f - 1].ms * 0.55;
}
export function flowRunAt(d: AgentFlowData, ms: number | null): FlowRunView {
  const total = flowTotal(d), ev = d.run.events;
  const node: Record<string, FlowNodeState> = {}, edge: Record<string, FlowEdgeState> = {};
  if (ms == null) {
    d.nodes.forEach((n) => (node[n.id] = "idle")); d.edges.forEach((e) => (edge[e.id] = "idle"));
    return { live: false, ms: 0, total, i: -1, p: 0, complete: false, node, edge };
  }
  let acc = 0, i = ev.length, p = 1;
  for (let k = 0; k < ev.length; k++) { if (ms < acc + ev[k].ms) { i = k; p = (ms - acc) / ev[k].ms; break; } acc += ev[k].ms; }
  const complete = i >= ev.length;
  const at = (kind: "node" | "edge", ref: string) => ev.findIndex((e) => e.at === kind && e.ref === ref);
  const st = <T,>(k: number, done: T, now: T, later: T) => (k < i ? done : k === i ? now : later);
  d.nodes.forEach((n) => { const k = at("node", n.id); if (k >= 0) node[n.id] = st<FlowNodeState>(k, "done", "running", "queued"); });
  for (let pass = 0; pass < 2; pass++) d.nodes.forEach((n) => {
    if (at("node", n.id) >= 0) return;
    node[n.id] = complete || d.edges.some((e) => e.to === n.id && (node[e.from] === "done" || node[e.from] === "skipped")) ? "skipped" : "queued";
  });
  d.edges.forEach((e) => {
    const k = at("edge", e.id);
    if (k >= 0) edge[e.id] = st<FlowEdgeState>(k, "done", "active", "queued");
    else if (at("node", e.to) >= 0) edge[e.id] = node[e.to] === "done" || node[e.to] === "running" ? "done" : "queued";
    else edge[e.id] = node[e.to] === "skipped" ? "skipped" : "queued";
  });
  return { live: true, ms, total, i, p, complete, node, edge };
}
/** Live fields ticked so far on a node: -1 = template (no run). */
function fieldsDone(n: FlowNode, s: FlowNodeState, run: FlowRunView): number {
  const len = n.fields?.items.length ?? 0;
  if (s === "idle") return -1;
  if (s === "done") return len;
  if (s === "running") return Math.min(len, Math.floor(run.p * (len + 1)));
  return 0;
}

/** Clock: plays from 0 when `autoplay`, holds still when `frozen` is set. Reduced motion jumps to the finished run. */
export function useFlowClock(total: number, frozen: number | undefined, autoplay: boolean, reduced: boolean) {
  const [ms, setMs] = useState<number | null>(frozen ?? (autoplay ? 0 : null));
  const [playing, setPlaying] = useState(frozen == null && autoplay);
  useEffect(() => { if (frozen != null) { setMs(frozen); setPlaying(false); } }, [frozen]);
  useEffect(() => {
    if (!playing) return;
    if (reduced) { setMs(total); setPlaying(false); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const m = now - t0;
      if (m >= total) { setMs(total); setPlaying(false); return; }
      setMs(m); raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total, reduced]);
  return { ms, playing, play: () => { setMs(0); setPlaying(true); } };
}

/* ---------- look ---------- */
export const KIND_LABEL: Record<FlowKind, string> = { trigger: "Trigger", step: "Step", tool: "Tool", decision: "Decision", action: "Action" };
const KIND_CHIP: Record<FlowKind, string> = {
  trigger: "bg-rust-50 text-rust ring-rust-100",
  step: "bg-zinc-100 text-zinc-600 ring-zinc-200/80",
  tool: "bg-zinc-100 text-ink ring-zinc-300/70",
  decision: "bg-warn-50 text-[#a8690f] ring-warn-100",
  action: "bg-ok-50 text-ok ring-ok-100",
};
const KIND_DOT: Record<FlowKind, string> = { trigger: "bg-rust", step: "bg-zinc-400", tool: "bg-ink", decision: "bg-[#d39a2c]", action: "bg-[#2f9a5c]" };
const ICON: Record<FlowIcon, typeof Mail> = {
  mail: Mail, extract: ScanText, enrich: DatabaseZap, decision: Split, slack: Hash, reply: Reply, calendar: CalendarClock, files: FolderOpen,
  claims: Scale, bank: Landmark, team: Users, value: ChartNoAxesColumn, memo: FileText, brief: MessageSquareText, inbox: Inbox,
};
const TONE_PILL: Record<FlowTone, string> = {
  ok: "bg-ok-50 text-ok ring-ok-100", warn: "bg-warn-50 text-warn ring-warn-100", neutral: "bg-white text-zinc-500 ring-zinc-200", rust: "bg-rust-50 text-rust ring-rust-100",
};
const EDGE_STROKE: Record<FlowEdgeState, string> = { idle: "#c9c9cf", queued: "#d4d4d8", active: "#c2652b", done: "#9f9fa8", skipped: "#e7e7ea" };

export function KindChip({ kind, icon, size = 28 }: { kind: FlowKind; icon: FlowIcon; size?: number }) {
  const I = ICON[icon];
  return <span style={{ width: size, height: size }} className={cx("inline-flex shrink-0 items-center justify-center rounded-[8px] ring-1", KIND_CHIP[kind])}><I style={{ width: size * 0.54, height: size * 0.54 }} strokeWidth={1.8} /></span>;
}
export function FlowIconChip({ icon, size = 40 }: { icon: FlowIcon; size?: number }) {
  const I = ICON[icon];
  return <span style={{ width: size, height: size }} className="inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#fdf6f1] to-rust-50 text-rust shadow-[0_0_0_1px_rgba(156,68,15,.14),0_1px_2px_rgba(156,68,15,.08)]"><I style={{ width: size * 0.45, height: size * 0.45 }} strokeWidth={1.7} /></span>;
}

/** A tool's full-colour brand mark on a white tile, sized like a kind chip. */
export function ToolTile({ id, size = 28 }: { id: ToolId; size?: number }) {
  return <span style={{ width: size, height: size }} className="inline-flex shrink-0 items-center justify-center rounded-[8px] bg-white ring-1 ring-zinc-200"><ToolLogo id={id} size={Math.round(size * 0.72)} bare /></span>;
}

/* ---------- geometry ---------- */
const ANCHOR = 27; // header row centre (border 1 + padding 12 + chip 28 / 2)
type Pt = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };
type Seg = { a: Pt; b: Pt; c?: Pt; len: number };
const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
const toward = (p: Pt, q: Pt, r: number): Pt => { const d = dist(p, q) || 1; return { x: p.x + ((q.x - p.x) * r) / d, y: p.y + ((q.y - p.y) * r) / d }; };
const quad = (s: Seg, t: number): Pt => { const u = 1 - t, c = s.c!; return { x: u * u * s.a.x + 2 * u * t * c.x + t * t * s.b.x, y: u * u * s.a.y + 2 * u * t * c.y + t * t * s.b.y }; };

function rounded(pts: Pt[], r: number): Seg[] {
  const segs: Seg[] = [];
  let cur = pts[0];
  for (let k = 1; k < pts.length - 1; k++) {
    const p = pts[k], rr = Math.min(r, dist(pts[k - 1], p) / 2, dist(p, pts[k + 1]) / 2);
    const s = toward(p, pts[k - 1], rr), e = toward(p, pts[k + 1], rr);
    segs.push({ a: cur, b: s, len: dist(cur, s) });
    const q: Seg = { a: s, c: p, b: e, len: 0 };
    let L = 0, prev = s; for (let j = 1; j <= 8; j++) { const pt = quad(q, j / 8); L += dist(prev, pt); prev = pt; }
    q.len = L; segs.push(q); cur = e;
  }
  segs.push({ a: cur, b: pts[pts.length - 1], len: dist(cur, pts[pts.length - 1]) });
  return segs;
}
interface Geom { d: string; at: (t: number) => Pt; label: Pt }
function route(a: Box, b: Box, e: FlowEdge): Geom {
  let pts: Pt[], label: Pt;
  if (b.x >= a.x + a.w - 2) {
    const p0 = { x: a.x + a.w, y: a.y + ANCHOR }, p3 = { x: b.x - 1, y: b.y + ANCHOR }, gap = p3.x - p0.x;
    // labelled edges share a trunk close to the source, so each pill sits on its own final run, clear of the trunk
    const mx = p0.x + (e.label ? Math.min(22, gap / 4) : gap / 2);
    pts = Math.abs(p3.y - p0.y) < 1 ? [p0, p3] : [p0, { x: mx, y: p0.y }, { x: mx, y: p3.y }, p3];
    const pillW = (e.label?.length ?? 0) * 5.8 + 16;
    label = p3.x - mx >= pillW + 14 ? { x: (mx + p3.x) / 2 + 3, y: p3.y } : { x: mx, y: (p0.y + p3.y) / 2 };
  } else {
    const p0 = { x: a.x + a.w / 2, y: a.y + a.h }, p3 = { x: b.x + b.w / 2, y: b.y - 1 }, my = (p0.y + p3.y) / 2;
    pts = Math.abs(p3.x - p0.x) < 1 ? [p0, p3] : [p0, { x: p0.x, y: my }, { x: p3.x, y: my }, p3];
    label = { x: (p0.x + p3.x) / 2, y: my };
  }
  const segs = rounded(pts, 12);
  const f = (v: number) => Math.round(v * 100) / 100;
  const d = `M${f(segs[0].a.x)},${f(segs[0].a.y)} ` + segs.map((s) => (s.c ? `Q${f(s.c.x)},${f(s.c.y)} ${f(s.b.x)},${f(s.b.y)}` : `L${f(s.b.x)},${f(s.b.y)}`)).join(" ");
  const total = segs.reduce((s, x) => s + x.len, 0);
  const at = (t: number) => {
    let L = Math.max(0, Math.min(1, t)) * total;
    for (const s of segs) {
      if (L <= s.len || s === segs[segs.length - 1]) { const u = s.len ? Math.min(1, L / s.len) : 1; return s.c ? quad(s, u) : { x: s.a.x + (s.b.x - s.a.x) * u, y: s.a.y + (s.b.y - s.a.y) * u }; }
      L -= s.len;
    }
    return pts[pts.length - 1];
  };
  return { d, at, label: { x: f(label.x), y: f(label.y) } };
}
const r2 = (p: Pt): Pt => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function useLayout(d: AgentFlowData) {
  return useMemo(() => {
    const cols = Math.max(...d.nodes.map((n) => n.col)) + 1;
    const colW = Array.from({ length: cols }, (_, c) => Math.max(d.layout.colW, ...d.nodes.filter((n) => n.col === c).map((n) => n.w ?? d.layout.colW)));
    const colX: number[] = [];
    colW.forEach((w, c) => colX.push(c === 0 ? 0 : colX[c - 1] + colW[c - 1] + (d.layout.gaps[c - 1] ?? d.layout.gaps[d.layout.gaps.length - 1] ?? 64)));
    const pos: Record<string, { x: number; y: number; w: number }> = {};
    d.nodes.forEach((n) => { const w = n.w ?? d.layout.colW; pos[n.id] = { x: colX[n.col] + (colW[n.col] - w) / 2, y: n.y, w }; });
    return { pos, W: colX[cols - 1] + colW[cols - 1], H: d.layout.h };
  }, [d]);
}
const estH = (n: FlowNode) => 92 + (n.chips?.length ? 30 : 0) + (n.fields ? 50 + n.fields.items.length * 28 : 0);

/* ---------- node ---------- */
function StateBadge({ s, frozen }: { s: FlowNodeState; frozen: boolean }) {
  if (s === "done") return (
    <motion.span key="done" aria-label="Done" initial={frozen ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 520, damping: 22 }} className="flex size-[18px] items-center justify-center rounded-full bg-ok text-white shadow-[0_0_0_3px_#eff5f0]">
      <svg viewBox="0 0 12 12" className="size-[11px]" aria-hidden><motion.path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" initial={frozen ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, delay: 0.08 }} /></svg>
    </motion.span>
  );
  if (s === "running") return (
    <span aria-label="Running" className="relative flex size-[18px] items-center justify-center">
      <svg viewBox="0 0 20 20" className={cx("absolute inset-0", !frozen && "motion-safe:animate-spin [animation-duration:1.1s]")} aria-hidden><circle cx="10" cy="10" r="7.5" fill="none" stroke="#f1dfd2" strokeWidth="2.2" /><path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" fill="none" stroke="#c2652b" strokeWidth="2.2" strokeLinecap="round" /></svg>
    </span>
  );
  if (s === "skipped") return <span className="text-[10.5px] text-zinc-400">Skipped</span>;
  return null;
}

function Fields({ n, done, s, frozen }: { n: FlowNode; done: number; s: FlowNodeState; frozen: boolean }) {
  if (!n.fields) return null;
  const items = n.fields.items;
  return (
    <div className="mt-3 rounded-xl bg-zinc-50/90 p-1 ring-1 ring-zinc-200/60">
      <div className="flex h-6 items-center px-1.5 text-[10.5px] font-medium tracking-[.06em] text-zinc-400 uppercase">
        {n.fields.title}
        <span className="ml-auto flex items-center gap-1 normal-case tracking-normal tnum">
          {s === "running" && <span className="size-1.5 rounded-full bg-[#c2652b] motion-safe:animate-pulse" />}
          {done < 0 ? `${items.length} fields` : `${done} of ${items.length}`}
        </span>
      </div>
      <ul className="rounded-[9px] bg-white ring-1 ring-zinc-200/60">
        {items.map((f, k) => {
          const tpl = done < 0, got = !tpl && k < done, fetching = !tpl && s === "running" && k === done;
          return (
            <li key={f.id} className="flex h-7 items-center gap-2 border-t border-zinc-100 px-2 first:border-t-0">
              <span className="flex size-3.5 shrink-0 items-center justify-center">
                {got ? <motion.span initial={frozen ? false : { scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 600, damping: 24 }} className="flex size-3.5 items-center justify-center rounded-full bg-ok-50 text-ok ring-1 ring-ok-100"><Check className="size-2.5" strokeWidth={3} /></motion.span>
                  : fetching ? <span className="size-2 rounded-full bg-[#c2652b] shadow-[0_0_0_3px_rgba(194,101,43,.16)] motion-safe:animate-pulse" />
                  : <span className={cx("size-1.5 rounded-full", tpl ? "bg-rose-300" : "bg-zinc-200")} />}
              </span>
              <span className={cx("text-[12px] whitespace-nowrap", fetching ? cx("shimmer shimmer-think", frozen && "shimmer-frozen") : got || tpl ? "text-zinc-600" : "text-zinc-400")}>{f.label}</span>
              <span className="ml-auto text-right text-[12px] whitespace-nowrap tnum">
                {tpl ? <span className="text-[11px] text-zinc-400">{f.hint}</span>
                  : got ? <motion.span initial={frozen ? false : { opacity: 0, x: 4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="font-medium text-ink">{f.value}</motion.span>
                  : <span className="text-zinc-300">—</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NodeCard({ n, box, s, run, selected, frozen, onSelect, measure, takenTone }: {
  n: FlowNode; box: { x: number; y: number; w: number }; s: FlowNodeState; run: FlowRunView; selected: boolean; frozen: boolean;
  onSelect: (id: string) => void; measure: (id: string, el: HTMLDivElement | null) => void; takenTone?: FlowTone;
}) {
  const running = s === "running";
  return (
    <div ref={(el) => measure(n.id, el)} role="button" tabIndex={0} aria-pressed={selected} aria-label={`${KIND_LABEL[n.kind]}: ${n.title}`}
      onClick={(e) => { e.stopPropagation(); onSelect(n.id); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(n.id); } }}
      data-node={n.id}
      className={cx("absolute cursor-pointer rounded-[16px] border bg-white p-3 outline-none transition-[opacity,filter,box-shadow,border-color] duration-300 focus-visible:ring-2 focus-visible:ring-ink/30",
        running ? cx(frozen ? "flow-ring-frozen" : "flow-ring", "border-[#e9b48e]") : selected ? "border-ink shadow-[0_0_0_1px_#18181b,0_12px_32px_-16px_rgba(9,9,11,.30)]" : "border-zinc-200/70 shadow-[0_1px_2px_rgba(9,9,11,.03),0_12px_32px_-18px_rgba(9,9,11,.10)] hover:border-zinc-300",
        s === "skipped" && "opacity-45 saturate-0")}
      style={{ left: box.x, top: box.y, width: box.w }}>
      <div className="flex h-[28px] items-center gap-2">
        {n.kind === "tool" && n.tool ? <ToolTile id={n.tool} /> : <KindChip kind={n.kind} icon={n.icon} />}
        <span className="text-[11.5px] text-zinc-500">{KIND_LABEL[n.kind]}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {n.tool && n.kind !== "tool" && <ToolLogo id={n.tool} size={20} bare className="opacity-95" />}
          <AnimatePresence initial={false}><StateBadge key={s} s={s} frozen={frozen} /></AnimatePresence>
        </span>
      </div>
      <div className={cx("mt-2.5 text-[14px] leading-5 font-medium tracking-[-0.01em]", running ? cx("shimmer shimmer-think", frozen && "shimmer-frozen") : "text-ink")}>{n.title}</div>
      <div className="mt-0.5 text-[12px] leading-[17px] text-zinc-500">{n.sub}</div>
      {n.chips && n.chips.length > 0 && !(s === "done" && n.result) && (
        <div className="mt-2.5 flex flex-wrap gap-1">{n.chips.map((c) => <span key={c} className="rounded-md bg-zinc-50 px-1.5 py-[2px] text-[11px] whitespace-nowrap text-zinc-600 ring-1 ring-zinc-200/70">{c}</span>)}</div>
      )}
      <Fields n={n} done={fieldsDone(n, s, run)} s={s} frozen={frozen} />
      <AnimatePresence initial={false}>
        {s === "done" && n.result && (
          <motion.div key="res" initial={frozen ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28 }} className="overflow-hidden">
            <div className={cx("mt-2.5 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-medium ring-1 tnum", TONE_PILL[takenTone ?? "ok"])}><Check className="size-3" strokeWidth={2.5} />{n.result}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- live step rail (Today's LiveRail, fed by the run) ---------- */
const RAIL_ID = "__rail", RAIL_GAP = 32;
/** Today's card chrome, so the rail and panels read as the same family as the home screen. */
export const CARD = "rounded-[20px] border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(9,9,11,.03),0_12px_32px_-18px_rgba(9,9,11,.10)]";
function railRun(d: AgentFlowData, run: FlowRunView): { run: LiveRun; status?: string } {
  const beats = d.run.events.map((e, k) => ({ e, k })).filter(({ e }) => e.at === "node");
  const steps = beats.map(({ e, k }) => {
    const state: LiveRun["steps"][number]["state"] = !run.live || k < run.i ? "done" : k === run.i ? "running" : "queued";
    return { id: `${d.id}-${k}`, label: (state === "done" ? e.done ?? e.log : e.log ?? e.done) ?? e.ref, state };
  });
  return {
    run: { title: d.run.deal?.company.name ?? d.run.subject, href: d.run.href, startedAt: d.run.when, steps },
    status: !run.live ? "Last run" : run.complete ? "Finished" : undefined,
  };
}

/* ---------- canvas ---------- */
export function FlowCanvas({ d, run, frozen, selected, onSelect, rail = true }: { d: AgentFlowData; run: FlowRunView; frozen: boolean; selected: string | null; onSelect: (id: string | null) => void; rail?: boolean }) {
  const { pos, W, H } = useLayout(d);
  const [hs, setHs] = useState<Record<string, number>>({});
  const els = useRef<Record<string, HTMLDivElement | null>>({});
  const measure = (id: string, el: HTMLDivElement | null) => { els.current[id] = el; };
  useLayoutEffect(() => {
    const read = () => setHs((prev) => {
      const next: Record<string, number> = {};
      let changed = false;
      for (const [id, el] of Object.entries(els.current)) if (el) { next[id] = el.offsetHeight; if (prev[id] !== next[id]) changed = true; }
      return changed ? next : prev;
    });
    read();
    const ro = new ResizeObserver(read);
    Object.values(els.current).forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, [d]);
  const box = (id: string): Box => { const n = d.nodes.find((x) => x.id === id)!; return { ...pos[id], h: hs[id] ?? estH(n) }; };

  // rail: Today's live step rail, docked under the first column so it moves and scales with the graph
  const col0 = d.nodes.filter((n) => n.col === 0);
  const railBox: Box | null = rail && col0.length ? (() => {
    const x = Math.min(...col0.map((n) => pos[n.id].x)), w = Math.max(...col0.map((n) => pos[n.id].w));
    return { x, w, y: Math.max(...col0.map((n) => pos[n.id].y + (hs[n.id] ?? estH(n)))) + RAIL_GAP, h: hs[RAIL_ID] ?? 250 };
  })() : null;

  // viewport: fit-to-view by default; with a node selected, fit it and its neighbours
  const vpRef = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState({ w: 1172, h: 700 });
  useLayoutEffect(() => {
    const el = vpRef.current; if (!el) return;
    const read = () => setVp({ w: el.clientWidth, h: el.clientHeight });
    read(); const ro = new ResizeObserver(read); ro.observe(el); return () => ro.disconnect();
  }, []);
  const [userZoom, setUserZoom] = useState<number | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  useEffect(() => { setUserZoom(null); setPan({ x: 0, y: 0 }); }, [selected]);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const M = 24, HUD = 48;
  const ids = selected && pos[selected] ? [selected, ...d.edges.filter((e) => e.from === selected || e.to === selected).map((e) => (e.from === selected ? e.to : e.from))] : d.nodes.map((n) => n.id);
  const boxes = ids.map(box).concat(!selected && railBox ? [railBox] : []);
  const fb = boxes.length ? (() => { const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y)), x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h)); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; })() : { x: 0, y: 0, w: W, h: H };
  const fitZ = Math.max(0.5, Math.min(1, (vp.w - 2 * M) / fb.w, (vp.h - 2 * M - HUD) / fb.h));
  const zoom = userZoom ?? fitZ;
  const offX = vp.w / 2 - (fb.x + fb.w / 2) * zoom, offY = (vp.h - HUD) / 2 - (fb.y + fb.h / 2) * zoom + 6;
  const fit = () => { setUserZoom(null); setPan({ x: 0, y: 0 }); };
  const z = (dz: number) => setUserZoom(Math.round(Math.max(0.5, Math.min(1.5, zoom + dz)) * 10) / 10);
  const runForRail = railRun(d, run);

  const takenTone = (id: string) => d.edges.find((e) => e.from === id && e.tone && (run.edge[e.id] === "done" || run.edge[e.id] === "active"))?.tone;
  const activeEdge = run.live && !run.complete && d.run.events[run.i]?.at === "edge" ? d.run.events[run.i].ref : null;
  const geoms = d.edges.map((e) => ({ e, g: route(box(e.from), box(e.to), e), s: run.edge[e.id] }));
  const kinds = (Object.keys(KIND_LABEL) as FlowKind[]).filter((k) => d.nodes.some((n) => n.kind === k));

  return (
    <div ref={vpRef} className={cx("flow-grid relative h-full w-full overflow-hidden select-none", drag.current ? "cursor-grabbing" : "cursor-grab")}
      onClick={() => onSelect(null)}
      onPointerDown={(e) => { if ((e.target as HTMLElement).closest("[data-node],[data-ui]")) return; drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { const g = drag.current; if (g) setPan({ x: g.px + e.clientX - g.x, y: g.py + e.clientY - g.y }); }}
      onPointerUp={() => { drag.current = null; }}>
      <div className="absolute top-0 left-0 origin-top-left motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[cubic-bezier(.2,.7,.2,1)]" style={{ width: W, height: H, transform: `translate(${offX + pan.x}px, ${offY + pan.y}px) scale(${zoom})` }}>
        <svg className="pointer-events-none absolute inset-0 overflow-visible" width={W} height={H} aria-hidden>
          <defs>
            {(Object.keys(EDGE_STROKE) as FlowEdgeState[]).map((k) => (
              <marker key={k} id={`fa-${k}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                <path d="M2,1.5 L8.5,5 L2,8.5" fill="none" stroke={EDGE_STROKE[k]} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            ))}
            <filter id="fl-glow" x="-2" y="-2" width="5" height="5"><feGaussianBlur stdDeviation="3.2" /></filter>
          </defs>
          {geoms.map(({ e, g, s }) => (
            <path key={e.id} d={g.d} fill="none" stroke={EDGE_STROKE[s]} strokeWidth={s === "active" ? 1.6 : 1.25} strokeDasharray="5 5" strokeLinecap="round" markerEnd={`url(#fa-${s})`} className={cx("transition-[stroke] duration-500", s === "active" && !frozen && "dash-flow")} />
          ))}
        </svg>
        {geoms.filter(({ e }) => e.label).map(({ e, g, s }) => (
          <span key={`l${e.id}`} className={cx("absolute flex h-5 -translate-x-1/2 -translate-y-1/2 items-center rounded-full px-2 text-[10.5px] font-medium whitespace-nowrap ring-1 transition-opacity duration-500",
            TONE_PILL[e.tone ?? "neutral"], s === "skipped" && "opacity-40", (s === "done" || s === "active") && e.tone && "shadow-[0_1px_3px_rgba(9,9,11,.08)]")} style={{ left: g.label.x, top: g.label.y }}>{e.label}</span>
        ))}
        {d.nodes.map((n) => (
          <NodeCard key={n.id} n={n} box={pos[n.id]} s={run.node[n.id]} run={run} selected={selected === n.id} frozen={frozen} onSelect={onSelect} measure={measure} takenTone={n.kind === "decision" ? takenTone(n.id) : undefined} />
        ))}
        {railBox && (
          <div data-ui ref={(el) => measure(RAIL_ID, el)} className="absolute cursor-default" style={{ left: railBox.x, top: railBox.y, width: railBox.w }} onClick={(e) => e.stopPropagation()}>
            <LiveRail run={runForRail.run} status={runForRail.status} boxed tone="sienna" className={CARD} />
          </div>
        )}
        {/* the glowing sienna dot rides above labels and cards */}
        {activeEdge && (() => {
          const ge = geoms.find((x) => x.e.id === activeEdge); if (!ge) return null;
          const p = r2(ge.g.at(ease(run.p))), tail = r2(ge.g.at(ease(Math.max(0, run.p - 0.08))));
          return (
            <svg className="pointer-events-none absolute inset-0 overflow-visible" width={W} height={H} aria-hidden>
              <line x1={tail.x} y1={tail.y} x2={p.x} y2={p.y} stroke="#e3a173" strokeWidth={3} strokeLinecap="round" opacity={0.5} />
              <circle cx={p.x} cy={p.y} r={9} fill="#c2652b" opacity={0.4} filter="url(#fl-glow)" />
              <circle cx={p.x} cy={p.y} r={4.2} fill="#c2652b" stroke="#fff" strokeWidth={1.5} />
            </svg>
          );
        })()}
      </div>

      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#fbfbfa] to-transparent" />
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#fbfbfa] to-transparent" />
      <div data-ui className="absolute bottom-4 left-4 flex cursor-default items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-8 items-center rounded-full border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(9,9,11,.04)]">
          <button type="button" aria-label="Zoom out" onClick={() => z(-0.1)} className="grid h-8 w-8 place-items-center text-zinc-500 hover:text-ink"><Minus className="size-3.5" /></button>
          <span className="w-11 text-center text-[11.5px] text-zinc-600 tnum">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => z(0.1)} className="grid h-8 w-8 place-items-center text-zinc-500 hover:text-ink"><Plus className="size-3.5" /></button>
        </div>
        <button type="button" aria-label="Fit to screen" title="Fit to screen" onClick={fit} className="grid size-8 place-items-center rounded-full border border-zinc-200/70 bg-white text-zinc-500 shadow-[0_1px_2px_rgba(9,9,11,.04)] hover:text-ink"><Maximize2 className="size-3.5" /></button>
      </div>
      <div data-ui className="absolute right-4 bottom-4 flex h-8 cursor-default items-center gap-3.5 rounded-full border border-zinc-200/70 bg-white/95 px-3.5 shadow-[0_1px_2px_rgba(9,9,11,.04)]" onClick={(e) => e.stopPropagation()}>
        {kinds.map((k) => <span key={k} className="flex items-center gap-1.5 text-[11.5px] text-zinc-600"><span className={cx("size-2 rounded-[3px]", KIND_DOT[k])} />{KIND_LABEL[k]}</span>)}
      </div>
    </div>
  );
}

/* ---------- node settings panel (Callora) ---------- */
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <section><div className="mb-2 flex items-baseline gap-2"><h3 className="text-[12.5px] font-medium text-ink">{title}</h3>{hint && <span className="text-[11.5px] text-zinc-400">{hint}</span>}</div>{children}</section>;
}
/** An editable value inside a plain-language rule: click to type, Enter or click away to keep it. */
function Token({ value }: { value: string }) {
  const [v, setV] = useState(value);
  const [edit, setEdit] = useState(false);
  if (edit) return (
    <input autoFocus aria-label="Rule value" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (!v.trim()) setV(value); setEdit(false); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setV(value); setEdit(false); } }}
      style={{ width: `${Math.max(3, v.length) + 2}ch` }} className="mx-0.5 inline-flex h-[22px] rounded-md bg-white px-1.5 align-baseline text-[12.5px] font-medium text-ink ring-2 ring-rust/30 outline-none" />
  );
  return <button type="button" title="Edit" onClick={() => setEdit(true)} className={cx("mx-0.5 inline-flex h-[22px] items-center gap-0.5 rounded-md bg-white px-1.5 align-baseline text-[12.5px] font-medium shadow-[0_1px_1px_rgba(9,9,11,.04)] ring-1 hover:ring-zinc-300", v !== value ? "text-rust ring-rust-100" : "text-ink ring-zinc-200")}>{v}<ChevronDown className="size-3 text-zinc-400" /></button>;
}
function OptionRow({ o }: { o: { id: string; label: string; hint?: string; on: boolean; locked?: boolean } }) {
  const [on, setOn] = useState(o.on);
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1"><div className="text-[13px] text-ink">{o.label}</div>{o.hint && <div className="text-[11.5px] text-zinc-500">{o.hint}</div>}</div>
      {o.locked ? <span className="flex items-center gap-1 text-[11.5px] text-zinc-400"><Lock className="size-3" />Always on</span> : <Toggle on={on} onChange={setOn} label={o.label} />}
    </div>
  );
}
function Threshold({ t }: { t: NonNullable<FlowNode["config"]["thresholds"]>[number] }) {
  const [v, setV] = useState(t.value);
  return (
    <div className="py-1.5">
      <div className="flex items-center text-[13px]"><span className="text-zinc-600">{t.label}</span><span className="ml-auto rounded-md bg-zinc-50 px-1.5 py-0.5 font-medium text-ink ring-1 ring-zinc-200/80 tnum">{t.prefix}{v}{t.unit}</span></div>
      <input type="range" aria-label={t.label} min={t.min} max={t.max} step={t.step ?? 1} value={v} onChange={(e) => setV(Number(e.target.value))} className="mt-2 h-1 w-full cursor-pointer accent-rust" />
    </div>
  );
}

export function NodePanel({ n, onClose }: { n: FlowNode; onClose: () => void }) {
  const c = n.config;
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-zinc-100 px-5">
        {n.kind === "tool" && n.tool ? <ToolTile id={n.tool} /> : <KindChip kind={n.kind} icon={n.icon} />}
        <div className="min-w-0"><div className="flex items-center gap-1.5 text-[14px] font-medium">{n.title}<Pencil className="size-3 text-zinc-400" /></div></div>
        <button type="button" aria-label="Close settings" onClick={onClose} className="ml-auto grid size-7 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-ink"><X className="size-4" /></button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div>
          <div className="text-[11px] font-medium tracking-[.06em] text-zinc-400 uppercase">{KIND_LABEL[n.kind]}</div>
          <p className="mt-1 text-[13px] leading-[19px] text-zinc-600">{c.about}</p>
        </div>
        {c.connection && n.tool && (
          <div className="flex items-center gap-3 rounded-xl bg-zinc-50/80 p-3 ring-1 ring-zinc-200/70">
            <ToolLogo id={n.tool} size={32} />
            <div className="min-w-0 flex-1"><div className="text-[13px] font-medium">{TOOL_NAME[n.tool]}</div><div className="text-[11.5px] leading-4 text-zinc-500">{c.connection.account}</div><div className="text-[11px] leading-4 text-zinc-400">Synced {c.connection.synced}</div></div>
            <span className={cx("inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-[11px] font-medium ring-1", c.connection.status === "connected" ? TONE_PILL.ok : TONE_PILL.warn)}>
              <span className={cx("size-1.5 rounded-full", c.connection.status === "connected" ? "bg-ok" : "bg-warn")} />{c.connection.status === "connected" ? "Connected" : "Reconnect"}
            </span>
          </div>
        )}
        {c.rules && (
          <Section title="Rules" hint="Plain language, top to bottom">
            <div className="space-y-2">
              {c.rules.map((r) => (
                <div key={r.id} className="rounded-xl bg-white px-3 py-2 ring-1 ring-zinc-200/80">
                  <p className="text-[13px] leading-[26px] text-zinc-700">
                    <span className={cx("mr-1.5 inline-flex h-5 items-center rounded-full px-2 align-[1px] text-[10.5px] font-medium ring-1", TONE_PILL[r.tone])}>{r.branch}</span>
                    {r.parts.map((p, k) => typeof p === "string" ? <span key={k}>{(k && !/^[,.;]/.test(p) ? " " : "") + p}{" "}</span> : <Token key={k} value={p.token} />)}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}
        {c.thresholds && <Section title="Thresholds"><div className="divide-y divide-zinc-100">{c.thresholds.map((t) => <Threshold key={t.id} t={t} />)}</div></Section>}
        {(c.reads || c.writes) && (
          <div className="grid grid-cols-2 gap-3">
            {([["Reads", c.reads, ArrowDownToLine], ["Writes", c.writes, ArrowUpFromLine]] as const).map(([label, items, I]) => (
              <div key={label} className="rounded-xl p-3 ring-1 ring-zinc-200/80">
                <div className="flex items-center gap-1.5 text-[12px] font-medium"><I className="size-3.5 text-zinc-400" />{label}</div>
                <ul className="mt-1.5 space-y-1 text-[12px] leading-[17px] text-zinc-600">{items && items.length ? items.map((x) => <li key={x}>{x}</li>) : <li className="text-zinc-400">Nothing. Read only.</li>}</ul>
              </div>
            ))}
          </div>
        )}
        {c.props && (
          <dl className="divide-y divide-zinc-100 rounded-xl px-3 ring-1 ring-zinc-200/80">
            {c.props.map((p) => <div key={p.k} className="flex gap-3 py-2.5 text-[12.5px]"><dt className="w-14 shrink-0 text-zinc-500">{p.k}</dt><dd className="text-ink">{p.v}</dd></div>)}
          </dl>
        )}
        {c.options && <Section title={n.fields ? "Fields" : "Options"}><div className="divide-y divide-zinc-100">{c.options.map((o) => <OptionRow key={o.id} o={o} />)}</div></Section>}
      </div>
      {c.tip && (
        <div className="mx-4 mb-4 flex shrink-0 gap-2.5 rounded-xl bg-zinc-50 px-3 py-2.5 ring-1 ring-zinc-200/60">
          <Lightbulb className="mt-px size-3.5 shrink-0 text-[#c8882a]" />
          <div className="text-[12px] leading-[17px] text-zinc-600">{c.tip}</div>
        </div>
      )}
    </div>
  );
}

/* ---------- guardrails modal (27778536) ---------- */
export function GuardrailsModal({ d, onClose }: { d: AgentFlowData; onClose: () => void }) {
  const g = d.guardrails;
  useEffect(() => { const on = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on); }, [onClose]);
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f4f4f2]/45 backdrop-blur-[7px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div role="dialog" aria-modal="true" aria-labelledby="gr-title" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="w-[640px] rounded-[22px] bg-white p-6 shadow-[0_0_0_1px_rgba(9,9,11,.06),0_2px_4px_rgba(9,9,11,.04),0_40px_80px_-24px_rgba(9,9,11,.32)]">
        <div className="flex items-start gap-3.5 border-b border-zinc-100 pb-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-zinc-600 shadow-[var(--dd-e1)]"><Settings2 className="size-[18px]" strokeWidth={1.75} /></span>
          <div className="min-w-0 flex-1"><h2 id="gr-title" className="text-[17px] font-medium tracking-[-0.01em]">{g.title}</h2><p className="mt-0.5 text-[13px] leading-[19px] text-zinc-500">{g.sub}</p></div>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-ink"><X className="size-4" /></button>
        </div>
        <div className="mt-5 space-y-2.5">
          {g.toggles.map((o) => <GuardRow key={o.id} o={o} />)}
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          {g.limits.map((l) => (
            <div key={l.id} className="flex items-center gap-3 rounded-2xl px-4 py-3.5 ring-1 ring-zinc-200/80">
              <div className="min-w-0 flex-1"><div className="text-[13.5px] font-medium">{l.label}</div><div className="text-[12px] text-zinc-500">{l.hint}</div></div>
              <LimitMenu value={l.value} options={l.options} label={l.label} />
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={onClose}>Save guardrails</Btn>
        </div>
      </motion.div>
    </motion.div>
  );
}
function LimitMenu({ value, options, label }: { value: string; options: string[]; label: string }) {
  const [v, setV] = useState(value);
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${v}`} onClick={() => setOpen((o) => !o)} className="inline-flex h-9 items-center gap-1 rounded-xl border border-zinc-200/70 bg-white px-3 text-[13px] font-medium shadow-[0_1px_2px_rgba(9,9,11,.04)] tnum hover:bg-zinc-50">{v}<ChevronDown className={cx("size-3.5 text-zinc-400 transition-transform", open && "rotate-180")} /></button>
      {open && (
        <ul role="listbox" aria-label={label} className="absolute right-0 bottom-full z-10 mb-1.5 min-w-[150px] rounded-xl border border-zinc-200/70 bg-white p-1 shadow-[0_1px_2px_rgba(9,9,11,.04),0_16px_36px_-12px_rgba(9,9,11,.22)]">
          {options.map((o) => (
            <li key={o}><button type="button" role="option" aria-selected={o === v} onClick={() => { setV(o); setOpen(false); }} className={cx("flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] tnum hover:bg-zinc-50", o === v ? "font-medium text-ink" : "text-zinc-600")}>{o}{o === v && <Check className="ml-auto size-3.5 text-rust" />}</button></li>
          ))}
        </ul>
      )}
    </span>
  );
}
function GuardRow({ o }: { o: { id: string; label: string; hint?: string; on: boolean; locked?: boolean } }) {
  const [on, setOn] = useState(o.on);
  return (
    <div className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5 ring-1 ring-zinc-200/80">
      <div className="min-w-0 flex-1"><div className="text-[13.5px] font-medium">{o.label}</div>{o.hint && <div className="mt-0.5 text-[12.5px] text-zinc-500">{o.hint}</div>}</div>
      {o.locked ? <span className="flex items-center gap-1.5 text-[12px] text-zinc-400"><Lock className="size-3.5" />Always on</span> : <Toggle on={on} onChange={setOn} label={o.label} />}
    </div>
  );
}
