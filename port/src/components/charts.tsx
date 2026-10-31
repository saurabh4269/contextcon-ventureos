"use client";
/**
 * v3.1 chart kit — shadcn/ui charts (Recharts 3 via <ChartContainer>) with a Deal Desk skin.
 * Exports and props are unchanged from v3 (all new props optional). Shared grammar:
 *  - hairline horizontal grid (#ececef), 10.5px tabular ticks (#a1a1aa), no axis boxes
 *  - ink gradient = verified / ours, rust hatch + stroke = worse than claimed, ok = better than firm
 *  - gradient area fills, end-of-series pills, annotated reference lines, rich tooltips (TipCard)
 *  - animated entry (900ms, ease-out); prefers-reduced-motion → static
 * Recharts renders client-side only (SSR returns the empty wrapper div), so render tests stay string-based.
 */
import { useId, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "./motion";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceArea, ReferenceDot, ReferenceLine, XAxis, YAxis, usePlotArea, useXAxisScale, useYAxisScale, ZIndexLayer } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "./ui/chart";
import type { BridgePart, GrowthComparison, Stage, ConversionRow, Valuation } from "../types";

const INK = "#09090b", INK2 = "#3f3f46", RUST = "#9c440f", RUST2 = "#c2652b", GRID = "#ececef", AXIS = "#a1a1aa", MUTED = "#71717a", OK = "#3d6b4f", OK2 = "#5a8f6c";
const F = { fontFamily: "var(--font-sans)", fontFeatureSettings: '"tnum"' } as const;
const uid = () => useId().replace(/[:«»]/g, "");
/** Custom tick props (Recharts passes x/y as number | string). */
type TickP = { x: number | string; y: number | string; payload: { value: string; index: number } };
const TICK = { fontSize: 10.5, fill: AXIS } as const;
/** Entry animation shared by every series. */
function useAnim(delay = 0) {
  const red = useReducedMotion();
  return { isAnimationActive: !red, animationDuration: 900, animationBegin: delay, animationEasing: "ease-out" as const };
}
/** Tooltip card used by every chart (shadcn ChartTooltip content). */
export function TipCard({ title, rows, note }: { title: ReactNode; rows: { c?: string; k: ReactNode; v: ReactNode; strong?: boolean; dash?: boolean }[]; note?: ReactNode }) {
  return (
    <div className="dd-tip">
      <div className="mb-1.5 text-[11px] font-medium text-zinc-500">{title}</div>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            {r.c && <span className="h-2.5 w-[3px] shrink-0 rounded-full" style={r.dash ? { background: `repeating-linear-gradient(180deg, ${r.c} 0 2px, transparent 2px 4px)` } : { background: r.c }} />}
            <span className="text-zinc-600">{r.k}</span>
            <span className={`tnum ml-auto pl-4 ${r.strong ? "font-semibold text-ink" : "font-medium text-zinc-800"}`}>{r.v}</span>
          </div>
        ))}
      </div>
      {note && <div className="mt-2 border-t border-zinc-100 pt-1.5 text-[10.5px] leading-snug text-zinc-500">{note}</div>}
    </div>
  );
}
/** SVG pill used for end-of-series and reference-line labels. */
function Pill({ x, y, text, tone = "ink", anchor = "middle", size = 10.5 }: { x: number; y: number; text: string; tone?: "ink" | "rust" | "rustSoft" | "ok" | "soft"; anchor?: "start" | "middle" | "end"; size?: number }) {
  const w = Math.round(text.length * size * 0.56 + 14), h = size + 7;
  const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  const bg = { ink: INK, rust: RUST, rustSoft: "#fbf3ee", ok: OK, soft: "#fff" }[tone];
  const fg = tone === "rustSoft" ? RUST : tone === "soft" ? INK : "#fff";
  return (
    <g style={F}>
      <rect x={x0} y={y - h / 2} width={w} height={h} rx={h / 2} fill={bg} stroke={tone === "rustSoft" ? "rgba(156,68,15,.3)" : tone === "soft" ? "#e4e4e7" : "none"} filter={tone === "ink" || tone === "rust" ? "drop-shadow(0 1px 1.5px rgba(9,9,11,.18))" : undefined} />
      <text x={x0 + w / 2} y={y + size * 0.36} textAnchor="middle" fontSize={size} fontWeight={600} fill={fg}>{text}</text>
    </g>
  );
}
/** Plot-area helpers for overlays (Recharts 3 renders any child component inside the chart SVG). */
function useBand(n: number, horizontal = true) {
  const p = usePlotArea();
  if (!p) return null;
  const step = (horizontal ? p.width : p.height) / n;
  return { p, step, mid: (i: number) => (horizontal ? p.x : p.y) + step * (i + 0.5) };
}

/** Nice ticks between lo and hi (inclusive), ~n steps. */
export function niceTicks(lo: number, hi: number, n = 4): number[] {
  const span = hi - lo || 1, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 3, 5, 10].map((m) => m * mag).find((s) => span / s <= n) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}
/** Ticks from lo up to the first nice step at or above hi (axis always covers the data). */
export function niceAxis(lo: number, hi: number, n = 4): number[] {
  const t = niceTicks(lo, hi, n), step = t.length > 1 ? t[1] - t[0] : hi - lo || 1;
  while (t[t.length - 1] < hi - 1e-9) t.push(+(t[t.length - 1] + step).toFixed(6));
  return t;
}
const r2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number, d = 1) => (Number.isInteger(v) ? String(v) : v.toFixed(d));

function Hatch({ id, color = RUST, bg = 0.08, gap = 4 }: { id: string; color?: string; bg?: number; gap?: number }) {
  return (
    <pattern id={id} width={gap} height={gap} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width={gap} height={gap} fill={color} fillOpacity={bg} />
      <line x1="0" y1="0" x2="0" y2={gap} stroke={color} strokeOpacity=".55" strokeWidth="1" />
    </pattern>
  );
}
function Grad({ id, from, to, o1 = 1, o2 = 1, x = false }: { id: string; from: string; to: string; o1?: number; o2?: number; x?: boolean }) {
  return <linearGradient id={id} x1="0" y1="0" x2={x ? 1 : 0} y2={x ? 0 : 1}><stop offset="0" stopColor={from} stopOpacity={o1} /><stop offset="1" stopColor={to} stopOpacity={o2} /></linearGradient>;
}

/* ─────────────────────────── ARR bridge (waterfall) ─────────────────────────── */
type BRow = { label: string; kind: BridgePart["kind"]; value: number; range: [number, number]; run: number };
function bridgeRows(parts: BridgePart[], floor: number): BRow[] {
  let run = 0;
  return parts.map((p) => {
    let lo = 0, hi = 0;
    if (p.kind === "start" || p.kind === "end" || p.kind === "ghost") { lo = floor; hi = p.value; if (p.kind !== "ghost") run = p.value; }
    else if (p.kind === "down") { hi = run; lo = run - p.value; run = lo; }
    else { lo = run; hi = run + p.value; run = hi; }
    return { label: p.label, kind: p.kind, value: p.value, range: [lo, hi], run };
  });
}
/**
 * Waterfall on shadcn/Recharts: ranged bars ([lo, hi]) with a shape per kind, dashed level connectors,
 * value labels, a delta bracket (end vs start) and a running-total tooltip.
 */
export function BridgeChart({ parts, h = 120, floor = 12, top = 19.5, unit = "M", barW = 44, delta }: { parts: BridgePart[]; h?: number; floor?: number; top?: number; unit?: string; barW?: number; delta?: boolean }) {
  const id = uid(), anim = useAnim();
  const rows = bridgeRows(parts, floor);
  const ticks = niceTicks(floor, top, h > 120 ? 4 : 3);
  const showDelta = delta ?? h >= 120;
  const gap = Math.round(barW * 0.5), padR = showDelta ? 92 : 8;
  const W = 44 + parts.length * (barW + gap) + padR, H = h + 26 + 24;
  const money = (v: number) => `$${v.toFixed(1)}${unit}`;
  const label = (r: BRow) => (r.kind === "down" ? `−${r.value.toFixed(1)}` : r.kind === "up" ? `+${r.value.toFixed(1)}` : money(r.value));
  const start = rows.find((r) => r.kind === "start"), end = rows.find((r) => r.kind === "end");
  const config: ChartConfig = { range: { label: "ARR", color: INK } };
  function Shape(props: { x?: number; y?: number; width?: number; height?: number; payload?: BRow; index?: number }) {
    const { x = 0, y = 0, width = 0, height = 0, payload } = props;
    const k = payload?.kind, hh = Math.max(height, 1.5);
    if (k === "down") return <g><rect x={x} y={y} width={width} height={hh} rx={3} fill="#fff" /><rect x={x} y={y} width={width} height={hh} rx={3} fill={`url(#bh${id})`} stroke={RUST} strokeWidth={1} /></g>;
    if (k === "up") return <rect x={x} y={y} width={width} height={hh} rx={3} fill={`url(#bu${id})`} stroke={OK} strokeWidth={1} />;
    if (k === "ghost") return <rect x={x + 0.5} y={y + 0.5} width={width - 1} height={hh - 1} rx={4} fill="#fafafa" stroke="#c4c4c8" strokeDasharray="3 3" />;
    if (k === "end") return <g filter={`url(#bs${id})`}><rect x={x} y={y} width={width} height={hh} rx={4} fill={`url(#be${id})`} /><rect x={x + 1} y={y + 1} width={width - 2} height={1} rx={0.5} fill="#fff" fillOpacity=".18" /></g>;
    return <rect x={x} y={y} width={width} height={hh} rx={4} fill={`url(#bt${id})`} />;
  }
  function Overlay() {
    const b = useBand(rows.length), ys = useYAxisScale();
    if (!b || !ys) return null;
    const Y = (v: number) => ys(v) ?? 0, half = barW / 2;
    const lastX = b.mid(rows.length - 1) + half;
    return (
      <g style={F} pointerEvents="none">
        {rows.map((r, i) => {
          const nx = rows[i + 1];
          const lvl = r.kind === "down" ? r.range[0] : r.range[1];
          return (
            <g key={i}>
              {nx && nx.kind !== "ghost" && r.kind !== "ghost" && nx.kind !== "start" && <line x1={b.mid(i) + half} x2={b.mid(i + 1) - half} y1={Y(lvl)} y2={Y(lvl)} stroke="#a1a1aa" strokeDasharray="2 2" />}
              <motion.text initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.06 }} x={b.mid(i)} y={Y(r.range[1]) - 7} textAnchor="middle" fontSize={r.kind === "end" ? 11.5 : 10.5} fontWeight={r.kind === "end" || r.kind === "start" ? 650 : 550} fill={r.kind === "down" ? RUST : r.kind === "up" ? OK : r.kind === "ghost" ? AXIS : INK}>{label(r)}</motion.text>
            </g>
          );
        })}
        {showDelta && start && end && (() => {
          const bx = lastX + 12, y1 = Y(start.value), y2 = Y(end.value), d = end.value - start.value, pc = (d / start.value) * 100;
          return (
            <motion.g initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9 }}>
              <line x1={b.mid(0) + half} x2={bx} y1={y1} y2={y1} stroke={RUST} strokeOpacity=".35" strokeDasharray="2 3" />
              <path d={`M${bx},${y1} h5 V${y2} h-5`} fill="none" stroke={RUST} strokeWidth="1.25" />
              <Pill x={bx + 11} y={(y1 + y2) / 2 - 6} anchor="start" tone="rust" text={`${d < 0 ? "−" : "+"}$${Math.abs(d).toFixed(1)}${unit}`} size={11} />
              <text x={bx + 12} y={(y1 + y2) / 2 + 14} fontSize="10.5" fill={RUST} fillOpacity=".85">{pc.toFixed(0)}% vs deck</text>
            </motion.g>
          );
        })()}
      </g>
    );
  }
  return (
    <ChartContainer config={config} className="dd-chart aspect-auto w-full" style={{ height: H, maxWidth: W }} role="img" aria-label={parts.map((p) => `${p.label} ${p.kind === "down" ? "minus " : ""}${p.value}`).join(", ")} initialDimension={{ width: W, height: H }}>
      <BarChart data={rows} margin={{ top: 22, right: padR, bottom: 0, left: 0 }} barCategoryGap={0}>
        <defs>
          <linearGradient id={`bt${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#e4e4e7" /><stop offset="1" stopColor="#d4d4d8" /></linearGradient>
          <linearGradient id={`be${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3f3f46" /><stop offset="1" stopColor={INK} /></linearGradient>
          <linearGradient id={`bu${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={OK} stopOpacity=".28" /><stop offset="1" stopColor={OK} stopOpacity=".12" /></linearGradient>
          <Hatch id={`bh${id}`} bg={0.1} />
          <filter id={`bs${id}`} x="-30%" y="-20%" width="160%" height="150%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#09090b" floodOpacity=".22" /></filter>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <YAxis domain={[floor, top]} ticks={ticks} allowDataOverflow width={44} tickLine={false} axisLine={false} tick={TICK} tickFormatter={(t: number) => `$${fmt(t)}${unit}`} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#d4d4d8" }} interval={0} height={24}
          tick={(t: TickP) => { const r = rows[t.payload.index]; return <text x={Number(t.x)} y={Number(t.y) + 12} textAnchor="middle" fontSize={10.5} fill={r?.kind === "end" ? INK : MUTED} fontWeight={r?.kind === "end" ? 600 : 400} style={F}>{t.payload.value}</text>; }} />
        <ChartTooltip cursor={{ fill: "rgba(9,9,11,.035)" }} content={({ active, payload }) => {
          const r = active && payload?.[0]?.payload as BRow | undefined; if (!r) return null;
          const chg = r.kind === "down" ? -r.value : r.kind === "up" ? r.value : null;
          return <TipCard title={r.label} rows={[
            ...(chg !== null ? [{ c: chg < 0 ? RUST : OK, k: "Change", v: `${chg < 0 ? "−" : "+"}$${Math.abs(chg).toFixed(1)}${unit}`, strong: true }] : [{ c: r.kind === "end" ? INK : "#d4d4d8", k: r.kind === "ghost" ? "Not counted" : "ARR", v: money(r.value), strong: true }]),
            { k: "Running total", v: money(r.kind === "ghost" ? r.value : r.run) },
            ...(start && r.kind === "end" ? [{ c: RUST, k: "vs deck", v: `${((r.value / start.value - 1) * 100).toFixed(0)}%` }] : []),
          ]} />;
        }} />
        <Bar dataKey="range" barSize={barW} shape={Shape as never} {...anim} />
        <ZIndexLayer zIndex={900}><Overlay /></ZIndexLayer>
      </BarChart>
    </ChartContainer>
  );
}

/* ─────────────────────────── Valuation range / football field ─────────────────────────── */
type RRow = { label: string; range: [number, number]; ours: boolean; mid: number };
/**
 * Football field on shadcn/Recharts (vertical layout): pill range bars per method, our band shaded across rows,
 * hatched overpay zone up to the ask, cap + ask reference lines with pill labels, rich tooltip vs cap/ask.
 */
export function RangeChart({ v, w = 640, rowH = 30, labelW = 128, showMethods = true, ourLabel = "Our range", footnote, stacked = false }: { v: Valuation; w?: number; rowH?: number; labelW?: number; showMethods?: boolean; ourLabel?: string; footnote?: string; /** Narrow layout: label and values sit above each bar. */ stacked?: boolean }) {
  const id = uid(), anim = useAnim();
  if (stacked) { labelW = 0; rowH = Math.max(rowH, 40); }
  const rows: RRow[] = [...(showMethods ? v.methods ?? [] : []).map((m) => ({ label: m.label, range: [m.low, m.high] as [number, number], ours: false, mid: (m.low + m.high) / 2 })), { label: ourLabel, range: [v.low, v.high], ours: true, mid: (v.low + v.high) / 2 }];
  const ticks = niceTicks(v.axis.min, v.axis.max, 5);
  const u = v.unit, money = (n: number) => `$${fmt(n)}${u}`;
  const padT = 34, axisH = 22, H = padT + rows.length * rowH + axisH + (footnote ? 18 : 0);
  const config: ChartConfig = { range: { label: "Range", color: INK } };
  const over = v.ask !== undefined && v.ask > v.high;
  const capped = Number.isFinite(v.cap); // no cap (NaN) in live data: no cap marker or line
  function Shape(props: { x?: number; y?: number; width?: number; height?: number; payload?: RRow }) {
    const { x = 0, y = 0, width = 0, height = 0, payload } = props;
    const bh = payload?.ours ? 12 : 9, cy = y + height / 2 + (stacked ? 8 : 0);
    return <rect x={x} y={cy - bh / 2} width={Math.max(width, bh)} height={bh} rx={bh / 2} fill={payload?.ours ? `url(#ro${id})` : `url(#rm${id})`} filter={payload?.ours ? `url(#rs${id})` : undefined} />;
  }
  function Overlay() {
    const b = useBand(rows.length, false), xs = useXAxisScale();
    if (!b || !xs) return null;
    const X = (n: number) => xs(n) ?? 0, { p } = b;
    return (
      <g style={F} pointerEvents="none">
        {rows.map((r, i) => {
          const cy = b.mid(i);
          return stacked ? (
            <g key={r.label}>
              <text x={p.x} y={cy - 5} fontSize="11.5" fill={r.ours ? INK : MUTED} fontWeight={r.ours ? 600 : 400}>{r.label}</text>
              <text x={p.x + p.width} y={cy - 5} textAnchor="end" fontSize="10.5" fill={r.ours ? INK : AXIS} fontWeight={r.ours ? 600 : 400}>{money(r.range[0])}–{money(r.range[1])}</text>
            </g>
          ) : (
            <motion.g key={r.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.05 }}>
              <text x={X(r.range[0]) - 7} y={cy + 3.5} textAnchor="end" fontSize="10.5" stroke="#fff" strokeWidth={3.5} strokeLinejoin="round" paintOrder="stroke" fill={r.ours ? INK : MUTED} fontWeight={r.ours ? 600 : 400}>{money(r.range[0])}</text>
              <text x={X(r.range[1]) + 7} y={cy + 3.5} fontSize="10.5" stroke="#fff" strokeWidth={3.5} strokeLinejoin="round" paintOrder="stroke" fill={r.ours ? INK : MUTED} fontWeight={r.ours ? 600 : 400}>{money(r.range[1])}</text>
            </motion.g>
          );
        })}
        {/* cap marker on our row + pills */}
        {capped && <>
          <circle cx={X(v.cap)} cy={b.mid(rows.length - 1) + (stacked ? 8 : 0)} r="4.5" fill="#fff" stroke={INK} strokeWidth="1.75" />
          <Pill x={X(v.cap)} y={p.y - 14} text={`cap ${money(v.cap)}`} tone="ink" />
        </>}
        {v.ask !== undefined && (() => { const t = `Ask ${money(v.ask)}`, pw = Math.round(t.length * 10.5 * 0.56 + 14), ax = Math.min(X(v.ask), p.x + p.width + 40 - pw / 2); return <>
          <Pill x={ax} y={p.y - 14} text={t} tone="rustSoft" />
          {over && !stacked && X(v.ask) - X(v.cap) > 150 && <text x={ax - pw / 2 - 7} y={p.y - 10.5} textAnchor="end" fontSize="10" fontWeight="600" fill={RUST}>+{money(v.ask - v.high)} above our high</text>}
        </>; })()}
        {footnote && <text x={labelW} y={p.y + p.height + axisH + 14} fontSize="10.5" fill={AXIS}>{footnote}</text>}
      </g>
    );
  }
  return (
    <ChartContainer config={config} className="dd-chart aspect-auto w-full" style={{ height: H }} initialDimension={{ width: w, height: H }} role="img" aria-label={`${ourLabel} ${money(v.low)} to ${money(v.high)}${capped ? `, cap ${money(v.cap)}` : ""}${v.ask !== undefined ? `, ask ${money(v.ask)}` : ""}`}>
      <BarChart data={rows} layout="vertical" margin={{ top: padT, right: stacked ? 2 : 48, bottom: footnote ? 18 : 0, left: 0 }} barCategoryGap={0}>
        <defs>
          <linearGradient id={`rm${id}`} x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#d4d4d8" /><stop offset="1" stopColor="#e4e4e7" /></linearGradient>
          <linearGradient id={`ro${id}`} x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#18181b" /><stop offset="1" stopColor="#52525b" /></linearGradient>
          <filter id={`rs${id}`} x="-10%" y="-80%" width="120%" height="260%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#09090b" floodOpacity=".2" /></filter>
          <Hatch id={`rh${id}`} bg={0.05} gap={5} />
        </defs>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" domain={[v.axis.min, v.axis.max]} ticks={ticks} allowDataOverflow tickLine={false} axisLine={false} tick={TICK} tickFormatter={money} height={axisH} />
        <YAxis type="category" dataKey="label" width={labelW} hide={stacked} interval={0} tickLine={false} axisLine={false}
          tick={(t: TickP) => { const r = rows[t.payload.index]; return <text x={0} y={Number(t.y) + 4} fontSize={12} fill={r?.ours ? INK : MUTED} fontWeight={r?.ours ? 600 : 400} style={F}>{t.payload.value}</text>; }} />
        <ReferenceArea x1={v.low} x2={v.high} fill={INK} fillOpacity={0.04} ifOverflow="hidden" />
        {over && <ReferenceArea x1={v.high} x2={v.ask} fill={`url(#rh${id})`} fillOpacity={1} ifOverflow="hidden" />}
        {capped && <ReferenceLine x={v.cap} stroke={INK} strokeWidth={1.25} />}
        {v.ask !== undefined && <ReferenceLine x={v.ask} stroke={RUST} strokeWidth={1.25} strokeDasharray="3 2.5" />}
        <ChartTooltip cursor={{ fill: "rgba(9,9,11,.03)" }} content={({ active, payload }) => {
          const r = active && payload?.[0]?.payload as RRow | undefined; if (!r) return null;
          return <TipCard title={r.label} rows={[
            { c: r.ours ? INK : "#d4d4d8", k: "Range", v: `${money(r.range[0])}–${money(r.range[1])}`, strong: true },
            { k: "Midpoint", v: money(r.mid) },
            ...(capped ? [{ c: INK, k: "vs cap", v: `${r.mid - v.cap >= 0 ? "+" : "−"}${money(Math.abs(r.mid - v.cap))}` }] : []),
            ...(v.ask !== undefined ? [{ c: RUST, k: "vs ask", v: `${r.range[1] - v.ask >= 0 ? "+" : "−"}${money(Math.abs(r.range[1] - v.ask))} at high`, dash: true }] : []),
          ]} note={r.ours ? v.capRationale : undefined} />;
        }} />
        <Bar dataKey="range" shape={Shape as never} {...anim} />
        <ZIndexLayer zIndex={900}><Overlay /></ZIndexLayer>
      </BarChart>
    </ChartContainer>
  );
}

/** Compact one-line range used in the deal header (never clips: fixed viewBox, scales down). */
export function RangeMini({ v, w = 300 }: { v: Valuation; w?: number }) {
  const id = uid(), H = 34, pad = 4;
  const X = (n: number) => pad + ((n - v.axis.min) / (v.axis.max - v.axis.min)) * (w - pad * 2);
  const askX = v.ask !== undefined ? X(v.ask) : undefined;
  return (
    <svg viewBox={`0 0 ${w} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label={`Range $${v.low}–${v.high}${v.unit}, cap $${v.cap}${v.unit}`} style={F}>
      <defs><Grad id={`o${id}`} from="#18181b" to="#3f3f46" x /><Hatch id={`h${id}`} bg={0.06} gap={4} /></defs>
      <rect x={pad} y={13} width={w - pad * 2} height={6} rx={3} fill="#f0f0f1" />
      {askX !== undefined && askX > X(v.high) && <rect x={X(v.high)} y={13} width={askX - X(v.high)} height={6} fill={`url(#h${id})`} />}
      <rect x={X(v.low)} y={12} width={X(v.high) - X(v.low)} height={8} rx={4} fill={`url(#o${id})`} />
      <line x1={X(v.cap)} x2={X(v.cap)} y1={7} y2={25} stroke={INK} strokeWidth="1.5" /><circle cx={X(v.cap)} cy={16} r="3.2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      {askX !== undefined && <line x1={askX} x2={askX} y1={7} y2={25} stroke={RUST} strokeWidth="1.5" />}
      <text x={X(v.low)} y={33} fontSize="10" fill={AXIS} textAnchor="start">${v.low}</text>
      <text x={X(v.high)} y={33} fontSize="10" fill={AXIS} textAnchor="end">${v.high}</text>
    </svg>
  );
}


/* ─────────────────────────── Runway ─────────────────────────── */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const nextMonth = (m: string, k = 1) => { const i = MONTHS.indexOf(m); return i < 0 ? "+" + k : MONTHS[(i + k) % 12]; };
type RunRow = { month: string; months?: number; proj?: number; projected?: boolean };
/**
 * Runway history + projection on shadcn/Recharts. Axis starts at 0 (honest); hatched danger zone under the alert line,
 * gradient area, dashed projection, end pill. Works for 2–12 points.
 */
export function RunwayChart({ history, projection, alert, w = 340, h = 132, label }: { history: { month: string; months: number }[]; projection?: number; alert: number; w?: number; h?: number; label?: string }) {
  const id = uid(), anim = useAnim();
  const vals = [...history.map((p) => p.months), projection ?? 0, alert];
  const ticks = niceAxis(0, Math.max(...vals) * 1.12, 3), max = ticks[ticks.length - 1];
  const last = history[history.length - 1], low = last.months < alert, C = low ? RUST : INK;
  const data: RunRow[] = history.map((p, i) => ({ month: p.month, months: p.months, proj: projection !== undefined && i === history.length - 1 ? p.months : undefined }));
  if (projection !== undefined) data.push({ month: nextMonth(last.month), proj: projection, projected: true });
  const config: ChartConfig = { months: { label: "Runway", color: C }, proj: { label: "Projected", color: C } };
  function Overlay() {
    const xs = useXAxisScale(), ys = useYAxisScale(), p = usePlotArea();
    if (!xs || !ys || !p) return null;
    const lx = xs(last.month) ?? 0, ly = ys(last.months) ?? 0;
    return (
      <g style={F} pointerEvents="none">
        <Pill x={p.x + p.width + 6} y={(ys(alert) ?? 0)} anchor="start" tone="rustSoft" text={`${alert} mo`} size={10} />
        <g className="dd-fade" style={{ animationDelay: ".8s" }}><Pill x={lx} y={ly - 15} tone={low ? "rust" : "ink"} text={`${fmt(last.months)} mo`} size={10} /></g>
        {projection !== undefined && <text x={(xs(data[data.length - 1].month) ?? 0) + 8} y={(ys(projection) ?? 0) + 3.5} fontSize="10" fill={MUTED}>{fmt(projection)}</text>}
      </g>
    );
  }
  return (
    <ChartContainer config={config} className="dd-chart aspect-auto w-full" style={{ height: h }} initialDimension={{ width: w, height: h }} role="img" aria-label={label ?? `Runway ${last.months} months; alert at ${alert}`}>
      <ComposedChart data={data} margin={{ top: 22, right: 44, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`ra${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={C} stopOpacity=".2" /><stop offset=".85" stopColor={C} stopOpacity="0" /></linearGradient>
          <Hatch id={`rh${id}`} bg={0.035} gap={5} />
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <ReferenceArea y1={0} y2={alert} fill={`url(#rh${id})`} fillOpacity={1} />
        <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: "#d4d4d8" }} interval={0} height={20} padding={{ left: 10, right: 10 }}
          tick={(t: TickP) => { const r = data[t.payload.index]; const isLast = r?.month === last.month && !r?.projected; return <text x={Number(t.x)} y={Number(t.y) + 11} textAnchor="middle" fontSize={10} fill={isLast ? INK : AXIS} fontWeight={isLast ? 600 : 400} fontStyle={r?.projected ? "italic" : undefined} style={F}>{t.payload.value}</text>; }} />
        <YAxis domain={[0, max]} ticks={ticks} width={26} tickLine={false} axisLine={false} tick={{ ...TICK, fontSize: 10 }} />
        <ReferenceLine y={alert} stroke={RUST} strokeDasharray="4 3" />
        <ChartTooltip cursor={{ stroke: "#d4d4d8", strokeDasharray: "3 3" }} content={({ active, payload }) => {
          const r = active && payload?.[0]?.payload as RunRow | undefined; if (!r) return null;
          const v = r.projected ? r.proj! : r.months!;
          return <TipCard title={r.projected ? `${r.month} · projected` : r.month} rows={[{ c: C, k: "Runway", v: `${fmt(v)} mo`, strong: true, dash: r.projected }, { c: RUST, k: "vs alert", v: `${v - alert >= 0 ? "+" : "−"}${fmt(Math.abs(v - alert))} mo`, dash: true }]} />;
        }} />
        <Area dataKey="months" type="monotone" stroke={C} strokeWidth={1.75} fill={`url(#ra${id})`} connectNulls={false}
          dot={(d: { cx?: number; cy?: number; index?: number }) => d.cx === undefined || d.cy === undefined || d.index === undefined || d.index >= history.length ? <g key={`d${d.index}`} /> : <circle key={`d${d.index}`} cx={d.cx} cy={d.cy} r={d.index === history.length - 1 ? 4.5 : 2.4} fill={d.index === history.length - 1 ? C : "#fff"} stroke={d.index === history.length - 1 ? "#fff" : C} strokeWidth={d.index === history.length - 1 ? 2 : 1.25} />}
          activeDot={{ r: 4, fill: C, stroke: "#fff", strokeWidth: 2 }} {...anim} />
        {projection !== undefined && <Line dataKey="proj" type="linear" stroke={C} strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="3 3" connectNulls dot={(d: { cx?: number; cy?: number; index?: number }) => d.index === data.length - 1 && d.cx !== undefined ? <circle key="pd" cx={d.cx} cy={d.cy} r={3.2} fill="#fff" stroke={C} strokeOpacity={0.7} strokeWidth={1.25} /> : <g key={`pd${d.index}`} />} activeDot={false} {...anim} animationBegin={700} />}
        <ZIndexLayer zIndex={900}><Overlay /></ZIndexLayer>
      </ComposedChart>
    </ChartContainer>
  );
}

/* ─────────────────────────── Growth: deck claim vs verified (seed hero) ─────────────────────────── */
type GRow = { m: string; verified: number; claimed: number; gap: [number, number]; mom?: number };
/**
 * Act 2 hero on shadcn/Recharts. Verified revenue (ink gradient area + dots) vs the trajectory the deck's claimed
 * rate implies from the same first month (dashed rust); the gap is a hatched range area with a bracket + end pills.
 * Below: month-on-month growth bars against the claimed and average reference lines. Hover shows all three numbers.
 */
export function GrowthCompare({ g, w = 720, h = 250, strip = true }: { g: GrowthComparison; w?: number; h?: number; strip?: boolean }) {
  const id = uid(), anim = useAnim(), anim2 = useAnim(350);
  const n = g.verified.length, base = g.verified[0];
  const rows: GRow[] = g.verified.map((v, i) => { const c = Math.round(base * Math.pow(1 + g.claimedRate, i) * 1e4) / 1e4; return { m: g.months[i], verified: v, claimed: c, gap: [v, c], mom: i ? v / g.verified[i - 1] - 1 : undefined }; });
  const max = Math.max(...rows.map((r) => r.claimed), ...g.verified), ticks = niceAxis(0, max * 1.06, 4), top = ticks[ticks.length - 1];
  const u = g.unit, money = (v: number) => `$${v >= 100 ? v.toFixed(0) : v.toFixed(v >= 10 ? 0 : 1)}${u}`;
  const pc = (r: number) => `${Math.round(r * 100)}%`;
  const endC = rows[n - 1].claimed, endV = g.verified[n - 1];
  const moms = rows.slice(1).map((r) => ({ m: r.m, mom: r.mom! }));
  const sTop = Math.max(g.claimedRate, ...moms.map((r) => r.mom)) * 1.25;
  const padR = 158, stripH = 104;
  const config: ChartConfig = { verified: { label: `Verified · ${g.verifiedSource.label}`, color: INK }, claimed: { label: `Deck implies · ${pc(g.claimedRate)}/mo`, color: RUST } };
  function Overlay() {
    const xs = useXAxisScale(), ys = useYAxisScale();
    if (!xs || !ys) return null;
    const ex = xs(rows[n - 1].m) ?? 0, yC = ys(endC) ?? 0, yV = ys(endV) ?? 0, bx = ex + 14;
    return (
      <g className="dd-fade" style={{ ...F, animationDelay: ".95s" }} pointerEvents="none">
        <path d={`M${bx},${yC} h5 V${yV} h-5`} fill="none" stroke={RUST} strokeWidth="1.25" />
        <Pill x={bx + 12} y={(yC + yV) / 2 - 7} anchor="start" tone="rust" size={12} text={`−${money(endC - endV)}`} />
        <text x={bx + 13} y={(yC + yV) / 2 + 15} fontSize="10.5" fill={RUST} fillOpacity=".85">{g.metric} the deck implies</text>
        <g transform={`translate(${bx + 12},${yC - 20})`}><text fontSize="11" fill={RUST} fontWeight="650">Deck {pc(g.claimedRate)}/mo</text><text y={13} fontSize="10.5" fill={RUST} fillOpacity=".8">{money(endC)} by {rows[n - 1].m}</text></g>
        <g transform={`translate(${bx + 12},${yV + 18})`}><text fontSize="11" fill={INK} fontWeight="650">Verified {pc(g.verifiedRate)}/mo</text><text y={13} fontSize="10.5" fill={MUTED}>{money(endV)} by {rows[n - 1].m}</text></g>
      </g>
    );
  }
  function StripLabels() {
    const ys = useYAxisScale(), p = usePlotArea();
    if (!ys || !p) return null;
    return (
      <g style={F} pointerEvents="none">
        <Pill x={p.x + p.width + 10} y={ys(g.claimedRate) ?? 0} anchor="start" tone="rustSoft" size={10} text={`claimed ${pc(g.claimedRate)}`} />
        <Pill x={p.x + p.width + 10} y={ys(g.verifiedRate) ?? 0} anchor="start" tone="soft" size={10} text={`avg ${pc(g.verifiedRate)}`} />
      </g>
    );
  }
  const tick = (last: string) => (t: TickP) => <text x={Number(t.x)} y={Number(t.y) + 12} textAnchor="middle" fontSize={10.5} fill={t.payload.value === last ? INK : AXIS} fontWeight={t.payload.value === last ? 600 : 400} style={F}>{t.payload.value}</text>;
  return (
    <div className="w-full" role="img" aria-label={`${g.metric}: deck implies ${pc(g.claimedRate)} a month, verified ${pc(g.verifiedRate)} a month`}>
      <ChartContainer config={config} className="dd-chart aspect-auto w-full" style={{ height: h }} initialDimension={{ width: w, height: h }}>
        <ComposedChart data={rows} margin={{ top: 30, right: padR, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`ga${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={INK} stopOpacity=".22" /><stop offset=".9" stopColor={INK} stopOpacity="0.01" /></linearGradient>
            <Hatch id={`gh${id}`} bg={0.07} gap={5} />
            <filter id={`gs${id}`} x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1" stdDeviation="1.6" floodColor="#09090b" floodOpacity=".25" /></filter>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="m" tickLine={false} axisLine={{ stroke: "#d4d4d8" }} interval={0} height={22} padding={{ left: 14, right: 4 }} tick={tick(rows[n - 1].m)} />
          <YAxis domain={[0, top]} ticks={ticks} width={46} tickLine={false} axisLine={false} tick={TICK} tickFormatter={(t: number) => (t === 0 ? "0" : money(t))} />
          <ChartTooltip cursor={{ stroke: "#a1a1aa", strokeDasharray: "3 3" }} content={({ active, payload }) => {
            const r = active && payload?.[0]?.payload as GRow | undefined; if (!r) return null;
            return <TipCard title={`${g.metric} · ${r.m}`} rows={[
              { c: INK, k: "Verified", v: money(r.verified), strong: true },
              { c: RUST, k: "Deck implies", v: money(r.claimed), dash: true },
              { c: RUST, k: "Gap", v: r.claimed - r.verified > 0.05 ? `−${money(r.claimed - r.verified)}` : "—" },
              ...(r.mom !== undefined ? [{ k: "Month-on-month", v: pc(r.mom) }] : []),
            ]} note={<>Verified from {g.verifiedSource.label}</>} />;
          }} />
          <Area dataKey="gap" type="monotone" stroke="none" fill={`url(#gh${id})`} fillOpacity={1} activeDot={false} {...anim2} />
          <Area dataKey="verified" type="monotone" stroke={INK} strokeWidth={2.25} fill={`url(#ga${id})`}
            dot={(d: { cx?: number; cy?: number; index?: number }) => <circle key={`v${d.index}`} cx={d.cx} cy={d.cy} r={d.index === n - 1 ? 5 : 3} fill={d.index === n - 1 ? INK : "#fff"} stroke={d.index === n - 1 ? "#fff" : INK} strokeWidth={d.index === n - 1 ? 2 : 1.5} filter={d.index === n - 1 ? `url(#gs${id})` : undefined} />}
            activeDot={{ r: 5, fill: INK, stroke: "#fff", strokeWidth: 2 }} {...anim} />
          <Line dataKey="claimed" type="monotone" stroke={RUST} strokeWidth={1.75} strokeDasharray="5 4"
            dot={(d: { cx?: number; cy?: number; index?: number }) => d.index === n - 1 ? <circle key="ce" cx={d.cx} cy={d.cy} r={4.5} fill="#fff" stroke={RUST} strokeWidth={1.75} /> : <g key={`c${d.index}`} />}
            activeDot={{ r: 4, fill: "#fff", stroke: RUST, strokeWidth: 1.75 }} {...anim2} />
          <ZIndexLayer zIndex={900}><Overlay /></ZIndexLayer>
        </ComposedChart>
      </ChartContainer>
      {strip && <>
      <div className="mt-3 flex items-center gap-2 pl-[46px]"><span className="eyebrow">Month-on-month</span><span className="h-px flex-1 bg-zinc-100" style={{ marginRight: padR }} /></div>
      <ChartContainer config={{ mom: { label: "MoM", color: INK } }} className="dd-chart aspect-auto w-full" style={{ height: stripH }} initialDimension={{ width: w, height: stripH }}>
        <BarChart data={moms} margin={{ top: 18, right: padR, bottom: 0, left: 0 }} barCategoryGap="38%">
          <defs>
            <linearGradient id={`gb${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={INK2} /><stop offset="1" stopColor={INK} /></linearGradient>
            <linearGradient id={`gl${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#d4d4d8" /><stop offset="1" stopColor="#c4c4c8" /></linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="m" tickLine={false} axisLine={{ stroke: "#d4d4d8" }} interval={0} height={20} tick={tick("")} />
          <YAxis domain={[0, sTop]} width={46} tickLine={false} axisLine={false} ticks={[0, g.verifiedRate, g.claimedRate]} tick={TICK} tickFormatter={(t: number) => (t ? pc(t) : "0")} />
          <ReferenceLine y={g.claimedRate} stroke={RUST} strokeDasharray="5 4" strokeWidth={1.25} />
          <ReferenceLine y={g.verifiedRate} stroke={INK} strokeOpacity={0.35} strokeDasharray="2 3" />
          <ChartTooltip cursor={{ fill: "rgba(9,9,11,.035)" }} content={({ active, payload }) => {
            const r = active && payload?.[0]?.payload as { m: string; mom: number } | undefined; if (!r) return null;
            return <TipCard title={`${r.m} vs prior month`} rows={[{ c: INK, k: "Verified growth", v: pc(r.mom), strong: true }, { c: RUST, k: "Deck claims", v: pc(g.claimedRate), dash: true }, { k: "Shortfall", v: `${Math.round((g.claimedRate - r.mom) * 100)} pts` }]} />;
          }} />
          <Bar dataKey="mom" radius={[4, 4, 1, 1]} barSize={28} {...anim2}>
            {moms.map((r, i) => <Cell key={i} fill={r.mom >= g.verifiedRate ? `url(#gb${id})` : `url(#gl${id})`} />)}
            <LabelList dataKey="mom" position="top" offset={6} formatter={(v: unknown) => pc(Number(v))} style={{ ...F, fontSize: 10.5, fontWeight: 600, fill: INK }} />
          </Bar>
          <ZIndexLayer zIndex={900}><StripLabels /></ZIndexLayer>
        </BarChart>
      </ChartContainer>
      </>}
    </div>
  );
}

/* ─────────────────────────── Pipeline funnel ─────────────────────────── */
type FRow = { label: string; count: number; drop: number; prev?: number; conv?: ConversionRow; ofTop: number };
const first = (s: string) => s.trim().toLowerCase().split(/[\s→]+/)[0];
/** Conversion row that starts at a stage ("Partner mtg → Due diligence" matches "Partner meeting"). */
export function conversionFrom(stage: Stage, conversion?: ConversionRow[]) {
  return conversion?.find((c) => first(c.label) === first(stage.label));
}
/**
 * Stage funnel (PostHog/Amplitude style) on shadcn/Recharts: each column = count bar (ink ramp) + hatched drop-off
 * stacked up to the previous stage. Conversion chips sit between columns vs the firm average; the biggest
 * drop vs firm is flagged. Tooltip: count, conversion, firm average, share of sourced.
 */
export function Funnel({ stages, conversion, w = 1100, h = 128 }: { stages: Stage[]; conversion?: ConversionRow[]; w?: number; h?: number }) {
  const id = uid(), anim = useAnim();
  const H = Math.max(h, 224), top = Math.max(...stages.map((s) => s.count));
  const rows: FRow[] = stages.map((s, i) => ({ label: s.label, count: s.count, drop: i ? Math.max(0, stages[i - 1].count - s.count) : 0, prev: i ? stages[i - 1].count : undefined, conv: conversionFrom(s, conversion), ofTop: s.count / (stages[0].count || 1) }));
  const worst = rows.reduce((wi, r, i) => (r.conv && (wi < 0 || r.conv.rate - r.conv.firmAvg < rows[wi].conv!.rate - rows[wi].conv!.firmAvg) ? i : wi), -1);
  const ramp = ["#d4d4d8", "#a1a1aa", "#71717a", "#52525b", "#27272a", INK];
  const config: ChartConfig = { count: { label: "Deals", color: INK }, drop: { label: "Dropped", color: "#d4d4d8" } };
  function Overlay() {
    const b = useBand(rows.length), ys = useYAxisScale();
    if (!b || !ys) return null;
    return (
      <g style={F} pointerEvents="none">
        {rows.map((r, i) => {
          const cx = b.mid(i), yTop = ys(r.prev ?? r.count) ?? 0;
          return (
            <motion.g key={r.label} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 + i * 0.06 }}>
              <text x={cx} y={yTop - 9} textAnchor="middle" fontSize="20" fill={INK} style={{ fontFamily: "var(--font-serif)" }}>{r.count}</text>
            </motion.g>
          );
        })}
        {rows.map((r, i) => {
          if (!r.conv || i === rows.length - 1) return null;
          const x = b.p.x + b.step * (i + 1), y = b.p.y + 18, good = r.conv.rate >= r.conv.firmAvg, bad = i === worst;
          const txt = `${Math.round(r.conv.rate * 100)}%`, cw = 46;
          return (
            <motion.g key={`c${i}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.06 }}>
              <rect x={x - cw / 2} y={y - 11} width={cw} height={22} rx={11} fill={bad ? RUST : "#fff"} stroke={bad ? "none" : good ? "rgba(61,107,79,.35)" : "rgba(156,68,15,.35)"} filter="drop-shadow(0 1px 2px rgba(9,9,11,.10))" />
              <text x={x - 4} y={y + 4} textAnchor="middle" fontSize="11.5" fontWeight="650" fill={bad ? "#fff" : good ? OK : RUST}>{txt}</text>
              <path d={`M${x + 12},${y - 3} l4,3 l-4,3`} fill="none" stroke={bad ? "#fff" : good ? OK : RUST} strokeWidth="1.3" strokeLinecap="round" />
              {/* v3.2: firm average lives in the tooltip; only the outlier keeps a caption. */}{bad && <text x={x} y={y + 25} textAnchor="middle" fontSize="9.5" fill={RUST} fontWeight={600}>below firm {Math.round(r.conv.firmAvg * 100)}%</text>}
            </motion.g>
          );
        })}
      </g>
    );
  }
  return (
    <ChartContainer config={config} className="dd-chart aspect-auto w-full" style={{ height: H }} initialDimension={{ width: w, height: H }} role="img" aria-label={stages.map((s) => `${s.label} ${s.count}`).join(", ")}>
      <BarChart data={rows} margin={{ top: 40, right: 0, bottom: 0, left: 0 }} barCategoryGap="32%">
        <defs>
          {ramp.map((c, i) => <linearGradient key={i} id={`fr${id}${i}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={c} /><stop offset="1" stopColor={ramp[Math.min(i + 1, ramp.length - 1)]} /></linearGradient>)}
          <Hatch id={`fd${id}`} color="#71717a" bg={0.04} gap={5} />
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <YAxis hide domain={[0, top]} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#d4d4d8" }} interval={0} height={26}
          tick={(t: TickP) => { return <g style={F}><text x={Number(t.x)} y={Number(t.y) + 12} textAnchor="middle" fontSize={12} fill={INK} fontWeight={500}>{t.payload.value}</text></g>; }} />
        <ChartTooltip cursor={{ fill: "rgba(9,9,11,.035)" }} content={({ active, payload }) => {
          const r = active && payload?.[0]?.payload as FRow | undefined; if (!r) return null;
          const i = rows.indexOf(r), into = i > 0 ? rows[i - 1].conv : undefined;
          return <TipCard title={r.label} rows={[
            { c: INK, k: "Deals", v: r.count, strong: true },
            ...(r.prev !== undefined ? [{ c: "#a1a1aa", k: "Dropped here", v: r.drop, dash: true }] : []),
            ...(into ? [{ k: "Converted in", v: `${Math.round(into.rate * 100)}%` }, { k: "Firm average", v: `${Math.round(into.firmAvg * 100)}%` }] : []),
            { k: "Of sourced", v: `${Math.round(r.ofTop * 100)}%` },
          ]} />;
        }} />
        <Bar dataKey="count" stackId="f" radius={[0, 0, 3, 3]} {...anim}>
          {rows.map((r, i) => <Cell key={i} fill={`url(#fr${id}${Math.min(i, ramp.length - 1)})`} radius={(r.drop ? [0, 0, 3, 3] : [5, 5, 3, 3]) as unknown as number} />)}
        </Bar>
        <Bar dataKey="drop" stackId="f" radius={[5, 5, 0, 0]} fill={`url(#fd${id})`} stroke="#d4d4d8" strokeDasharray="3 2" {...anim} />
        <ZIndexLayer zIndex={900}><Overlay /></ZIndexLayer>
      </BarChart>
    </ChartContainer>
  );
}

/* ─────────────────────────── Ring gauge (v3) ─────────────────────────── */
/** Ring with tick track and gradient stroke (IC countdown, data room). */
export function Gauge({ v, size = 64, stroke = 5, tone = "ink", ticks = 24, children }: { v: number; size?: number; stroke?: number; tone?: "ink" | "rust" | "ok"; ticks?: number; children?: React.ReactNode }) {
  const id = uid(), r = (size - stroke) / 2 - 3, c = r2(2 * Math.PI * r), cx = size / 2;
  const col = tone === "rust" ? [RUST, "#c2652b"] : tone === "ok" ? [OK, "#5a8f6c"] : [INK, "#52525b"];
  const red = useReducedMotion();
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <defs><Grad id={`g${id}`} from={col[1]} to={col[0]} x /></defs>
        {Array.from({ length: ticks }).map((_, i) => { const a = (i / ticks) * 2 * Math.PI - Math.PI / 2, r1 = size / 2 - 0.5, r0 = r1 - 2; return <line key={i} x1={r2(cx + Math.cos(a) * r0)} y1={r2(cx + Math.sin(a) * r0)} x2={r2(cx + Math.cos(a) * r1)} y2={r2(cx + Math.sin(a) * r1)} stroke="#e4e4e7" strokeWidth="1" />; })}
        <circle cx={cx} cy={cx} r={r} stroke="#f1f1f2" strokeWidth={stroke} fill="none" />
        <motion.circle cx={cx} cy={cx} r={r} stroke={`url(#g${id})`} strokeWidth={stroke} fill="none" strokeLinecap="round" transform={`rotate(-90 ${cx} ${cx})`} strokeDasharray={c} initial={red ? false : { strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v) }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">{children}</span>
    </span>
  );
}


/** Small bars (headcount, KPI history) — Recharts BarChart at a fixed size. */
export function MiniBars({ d, w = 120, h = 34, hl = -1, tone = "ink" }: { d: number[]; w?: number; h?: number; hl?: number; tone?: "ink" | "rust" }) {
  const id = uid(), anim = useAnim(), last = hl < 0 ? d.length - 1 : hl;
  const data = d.map((v, i) => ({ i, v }));
  return (
    <span className="dd-chart inline-block shrink-0" style={{ width: w, height: h }} aria-hidden>
      <BarChart width={w} height={h} data={data} margin={{ top: 1, right: 0, bottom: 0, left: 0 }} barCategoryGap={w / d.length > 9 ? "22%" : "14%"}>
        <defs>
          <linearGradient id={`mb${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={tone === "rust" ? RUST2 : INK2} /><stop offset="1" stopColor={tone === "rust" ? RUST : INK} /></linearGradient>
          <linearGradient id={`mz${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#e4e4e7" /><stop offset="1" stopColor="#ececef" /></linearGradient>
        </defs>
        <YAxis hide domain={[0, "dataMax"]} />
        <XAxis hide dataKey="i" />
        <Bar dataKey="v" radius={[2, 2, 0, 0]} {...anim} animationDuration={700}>{data.map((x) => <Cell key={x.i} fill={x.i === last ? `url(#mb${id})` : `url(#mz${id})`} />)}</Bar>
      </BarChart>
    </span>
  );
}

/** Sparkline (shadcn/Recharts AreaChart at a fixed size): gradient fill, monotone stroke, haloed end dot. */
export function SparkArea({ d, w = 96, h = 24, color = INK, fill = true, last = true, strokeW = 1.5 }: { d: number[]; w?: number; h?: number; color?: string; fill?: boolean; last?: boolean; strokeW?: number }) {
  const id = uid(), anim = useAnim();
  if (d.length < 2) return <svg width={w} height={h} aria-hidden />;
  const data = d.map((v, i) => ({ i, v }));
  return (
    <span className="dd-chart inline-block shrink-0" style={{ width: w, height: h }} aria-hidden>
      <AreaChart width={w} height={h} data={data} margin={{ top: 4, right: 4, bottom: 2, left: 2 }}>
        <defs><linearGradient id={`sa${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <XAxis hide dataKey="i" />
        <Area dataKey="v" type="monotone" stroke={color} strokeWidth={strokeW} fill={fill ? `url(#sa${id})` : "none"} activeDot={false}
          dot={(p: { cx?: number; cy?: number; index?: number }) => last && p.index === d.length - 1 ? <g key="e"><circle cx={p.cx} cy={p.cy} r={4.5} fill={color} fillOpacity=".15" /><circle cx={p.cx} cy={p.cy} r={2.4} fill={color} stroke="#fff" strokeWidth={1} /></g> : <g key={`s${p.index}`} />} {...anim} animationDuration={800} />
      </AreaChart>
    </span>
  );
}

/* ─────────────────────────── v3.2 · Deal flow (calm Today) ─────────────────────────── */
type FlowRow = { w: string; read: number; worth: number };
/** Inbound read per week (soft bars) with what was worth a look (ink line, end pill). One chart, no legend: the card header carries a two-swatch key. */
export function DealFlowChart({ weeks, read, worth, h = 220, mono = false }: { weeks: string[]; read: number[]; worth: number[]; h?: number; mono?: boolean }) {
  const anim = useAnim();
  const data: FlowRow[] = weeks.map((w, i) => ({ w, read: read[i], worth: worth[i] }));
  const ticks = niceAxis(0, Math.max(...read) * 1.1, 3), max = ticks[ticks.length - 1];
  const wmax = Math.max(...worth) * 1.25, n = data.length - 1;
  const config: ChartConfig = { read: { label: "Read", color: "#d4d4d8" }, worth: { label: "Worth a look", color: INK } };
  const LC = INK; void mono;
  return (
    <ChartContainer config={config} className="dd-chart aspect-auto w-full" style={{ height: h }} initialDimension={{ width: 560, height: h }} role="img" aria-label={`Deal flow: ${read[n]} read and ${worth[n]} worth a look in the week of ${weeks[n]}`}>
      <ComposedChart data={data} margin={{ top: 18, right: 30, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="w" tickLine={false} axisLine={false} interval={0} height={22} tick={(t: TickP) => <text x={Number(t.x)} y={Number(t.y) + 12} textAnchor="middle" fontSize={10.5} fill={t.payload.index === n ? INK : AXIS} fontWeight={t.payload.index === n ? 600 : 400} style={F}>{t.payload.value}</text>} />
        <YAxis yAxisId="l" domain={[0, max]} ticks={ticks} width={28} tickLine={false} axisLine={false} tick={TICK} />
        <YAxis yAxisId="r" orientation="right" domain={[0, wmax]} hide />
        <ChartTooltip cursor={{ fill: "rgba(9,9,11,.035)" }} content={({ active, payload }) => {
          const r = active && payload?.[0]?.payload as FlowRow | undefined; if (!r) return null;
          return <TipCard title={`Week of ${r.w}`} rows={[{ c: "#a1a1aa", k: "Read", v: r.read }, { c: LC, k: "Worth a look", v: r.worth, strong: true }]} note={`${Math.round((r.worth / r.read) * 100)}% made the cut`} />;
        }} />
        <Bar yAxisId="l" dataKey="read" radius={[4, 4, 0, 0]} maxBarSize={30} {...anim}>
          {data.map((_, i) => <Cell key={i} fill={i === n ? "#c8c8ce" : "#e7e7ea"} />)}
        </Bar>
        <Line yAxisId="r" dataKey="worth" type="monotone" stroke={LC} strokeWidth={1.75}
          dot={(d: { cx?: number; cy?: number; index?: number }) => d.cx === undefined || d.cy === undefined ? <g key={`w${d.index}`} /> : d.index === n ? <g key="wl"><circle cx={d.cx} cy={d.cy} r={4.5} fill={LC} stroke="#fff" strokeWidth={2} /><rect x={d.cx - 11} y={d.cy - 25} width={22} height={16} rx={8} fill={LC} /><text x={d.cx} y={d.cy - 14} textAnchor="middle" fontSize={10} fontWeight={600} fill="#fff" style={F}>{worth[n]}</text></g> : <circle key={`w${d.index}`} cx={d.cx} cy={d.cy} r={2.2} fill="#fff" stroke={LC} strokeWidth={1.25} />}
          activeDot={{ r: 4, fill: LC, stroke: "#fff", strokeWidth: 2 }} {...anim} animationBegin={300} />
      </ComposedChart>
    </ChartContainer>
  );
}

/* ─────────────────────────── Inbound per day (Today metric card, P6) ─────────────────────────── */
/** Small area chart: day ticks on x, 3 nice ticks on y, rust line with the latest point ringed, tooltip per day. */
export function InboundChart({ days, series, unit, h = 128 }: { days: string[]; series: number[]; unit: string; h?: number }) {
  const anim = useAnim(), id = uid();
  const data = days.map((d, i) => ({ d, v: series[i] }));
  const ticks = niceAxis(0, Math.max(...series), 3), max = ticks[ticks.length - 1], n = data.length - 1;
  const config: ChartConfig = { v: { label: unit, color: RUST } };
  return (
    <ChartContainer config={config} className="dd-chart aspect-auto w-full" style={{ height: h }} initialDimension={{ width: 280, height: h }} role="img" aria-label={`${series[n]} ${unit} on ${days[n]}, ${series.reduce((a, b) => a + b, 0)} over ${days.length} days`}>
      <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -6 }}>
        <defs><Grad id={`ib${id}`} from={RUST2} to={RUST2} o1={0.22} o2={0} /></defs>
        <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 4" />
        <XAxis dataKey="d" tickLine={false} axisLine={false} interval={0} height={20} padding={{ left: 4, right: 4 }} tick={(t: TickP) => <text x={Number(t.x)} y={Number(t.y) + 11} textAnchor="middle" fontSize={10.5} fill={t.payload.index === n ? INK : AXIS} fontWeight={t.payload.index === n ? 600 : 400} style={F}>{t.payload.value}</text>} />
        <YAxis domain={[0, max]} ticks={ticks} width={24} tickLine={false} axisLine={false} tick={TICK} />
        <ChartTooltip cursor={{ stroke: "#d4d4d8", strokeDasharray: "3 3" }} content={({ active, payload }) => {
          const r = active && payload?.[0]?.payload as { d: string; v: number } | undefined; if (!r) return null;
          return <TipCard title={r.d} rows={[{ c: RUST, k: unit, v: r.v, strong: true }]} />;
        }} />
        <Area dataKey="v" type="monotone" stroke={RUST} strokeWidth={1.75} fill={`url(#ib${id})`}
          dot={(d: { cx?: number; cy?: number; index?: number }) => d.index === n && d.cx !== undefined && d.cy !== undefined ? <g key="last"><circle cx={d.cx} cy={d.cy} r={7} fill={RUST} fillOpacity={0.14} /><circle cx={d.cx} cy={d.cy} r={3.5} fill={RUST} stroke="#fff" strokeWidth={1.5} /></g> : <g key={`p${d.index}`} />}
          activeDot={{ r: 4, fill: RUST, stroke: "#fff", strokeWidth: 2 }} {...anim} />
      </AreaChart>
    </ChartContainer>
  );
}
