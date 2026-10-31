"use client";
/** v3.1 · Firm brain visuals on shadcn/Recharts: memory growth, composition partition bar, pass reasons, outcome scoreboard. */
import { useId } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "./motion";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis, useXAxisScale, useYAxisScale, ZIndexLayer } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "./ui/chart";
import { TipCard } from "./charts";
import type { BrainData, Outcome } from "../types";

const INK = "#09090b", AXIS = "#a1a1aa", GRID = "#ececef", OK = "#3d6b4f", RUST = "#9c440f", WARN = "#8a5b12";
const F = { fontFamily: "var(--font-sans)", fontFeatureSettings: '"tnum"' } as const;
const useAnim = () => { const red = useReducedMotion(); return { isAnimationActive: !red, animationDuration: 900, animationEasing: "ease-out" as const }; };
const nf = (n: number) => n.toLocaleString("en-US");

/** Memory growth area: gradient fill, monthly ticks, end pill with this week's delta. */
export function MemoryGrowth({ trend, labels, weekDelta, h = 96 }: { trend: number[]; labels?: string[]; weekDelta: number; h?: number }) {
  const id = useId().replace(/[:«»]/g, ""), anim = useAnim();
  const data = trend.map((v, i) => ({ m: labels?.[i] ?? `${i + 1}`, v, add: i ? v - trend[i - 1] : 0 }));
  const mn = Math.min(...trend), mx = Math.max(...trend), lo = Math.max(0, mn - (mx - mn) * 0.35), hi = mx + (mx - mn) * 0.08;
  const config: ChartConfig = { v: { label: "Memories", color: INK } };
  function End() {
    const xs = useXAxisScale(), ys = useYAxisScale(); if (!xs || !ys) return null;
    const x = xs(data[data.length - 1].m) ?? 0, y = ys(trend[trend.length - 1]) ?? 0, t = `+${weekDelta} this week`, w = t.length * 5.9 + 14;
    return <g className="dd-fade" style={{ ...F, animationDelay: ".9s" }}><rect x={x - w + 8} y={y - 27} width={w} height={17} rx={8.5} fill={OK} /><text x={x - w / 2 + 8} y={y - 15} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#fff">{t}</text></g>;
  }
  return (
    <ChartContainer config={config} className="dd-chart aspect-auto w-full" style={{ height: h }} initialDimension={{ width: 520, height: h }}>
      <AreaChart data={data} margin={{ top: 30, right: 10, bottom: 0, left: 0 }}>
        <defs><linearGradient id={`mg${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={INK} stopOpacity=".2" /><stop offset="1" stopColor={INK} stopOpacity="0" /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="m" tickLine={false} axisLine={{ stroke: "#d4d4d8" }} interval={0} height={18} tick={{ fontSize: 10, fill: AXIS }} />
        <YAxis hide domain={[lo, hi]} />
        <ChartTooltip cursor={{ stroke: "#a1a1aa", strokeDasharray: "3 3" }} content={({ active, payload }) => {
          const r = active && payload?.[0]?.payload as typeof data[number] | undefined; if (!r) return null;
          return <TipCard title={r.m} rows={[{ c: INK, k: "Memories", v: nf(r.v), strong: true }, { c: OK, k: "Added", v: `+${r.add}` }]} />;
        }} />
        <Area dataKey="v" type="monotone" stroke={INK} strokeWidth={2} fill={`url(#mg${id})`} activeDot={{ r: 4, fill: INK, stroke: "#fff", strokeWidth: 2 }}
          dot={(d: { cx?: number; cy?: number; index?: number }) => d.index === data.length - 1 ? <g key="e"><circle cx={d.cx} cy={d.cy} r={7} fill={INK} fillOpacity=".12" /><circle cx={d.cx} cy={d.cy} r={3.5} fill={INK} stroke="#fff" strokeWidth={1.5} /></g> : <g key={`d${d.index}`} />} {...anim} />
        <ZIndexLayer zIndex={900}><End /></ZIndexLayer>
      </AreaChart>
    </ChartContainer>
  );
}

/** Partition bar (21st.dev partition-bar pattern): what the firm brain is made of; segments sum to the total. */
export function Composition({ kinds, total }: { kinds: BrainData["kinds"]; total: number }) {
  const red = useReducedMotion();
  const parts = kinds.filter((k) => k.id !== "all").map((k) => ({ label: k.label, n: Number(k.count.replace(/,/g, "")) || 0 }));
  const rest = Math.max(0, total - parts.reduce((s, p) => s + p.n, 0));
  const segs = [{ label: "Deal files & IC notes", n: rest }, ...parts.sort((a, b) => b.n - a.n)].filter((s) => s.n > 0);
  const tones = ["#18181b", "#52525b", "#71717a", "#a1a1aa", "#c4c4c8", "#d9d9de", "#e7e7ea"];
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={segs.map((s) => `${s.label} ${s.n}`).join(", ")}>
        {segs.map((s, i) => <motion.span key={s.label} title={`${s.label} · ${nf(s.n)}`} className="h-full first:rounded-l-full last:rounded-r-full" style={{ background: i === 0 ? "linear-gradient(90deg,#09090b,#3f3f46)" : tones[Math.min(i, tones.length - 1)] }} initial={red ? false : { width: 0 }} animate={{ width: `${(s.n / total) * 100}%` }} transition={{ duration: 0.9, delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }} />)}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px]">
        {segs.map((s, i) => <span key={s.label} className="flex items-center gap-1.5"><span className="size-2 rounded-[2px]" style={{ background: tones[Math.min(i, tones.length - 1)] }} /><span className="text-zinc-600">{s.label}</span><span className="tnum font-medium">{nf(s.n)}</span><span className="tnum text-zinc-400">{((s.n / total) * 100).toFixed(s.n / total < 0.01 ? 1 : 0)}%</span></span>)}
      </div>
    </div>
  );
}

/** Pass reasons as horizontal gradient bars with count + share labels. */
export function PassReasons({ reasons, total }: { reasons: { label: string; n: number }[]; total: number }) {
  const id = useId().replace(/[:«»]/g, ""), anim = useAnim();
  const data = reasons.map((r, i) => ({ ...r, share: r.n / (total || 1), top: i === 0 }));
  const maxN = Math.max(1, ...data.map((d) => d.n));
  const h = data.length * 30 + 6;
  return (
    <ChartContainer config={{ n: { label: "Passes", color: INK } }} className="dd-chart aspect-auto w-full" style={{ height: h }} initialDimension={{ width: 360, height: h }}>
      <BarChart data={data} layout="vertical" margin={{ top: 2, right: 72, bottom: 2, left: 0 }} barCategoryGap="34%">
        <defs>
          <linearGradient id={`pr${id}`} x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#18181b" /><stop offset="1" stopColor="#52525b" /></linearGradient>
          <linearGradient id={`pz${id}`} x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#a1a1aa" /><stop offset="1" stopColor="#d4d4d8" /></linearGradient>
        </defs>
        <XAxis type="number" hide domain={[0, maxN]} />
        <YAxis type="category" dataKey="label" width={118} tickLine={false} axisLine={false} tick={((t: { y: number | string; payload: { value: string; index: number } }) => <text x={0} y={Number(t.y) + 4} fontSize={12} fill={t.payload.index === 0 ? INK : "#52525b"} fontWeight={t.payload.index === 0 ? 500 : 400} style={F}>{t.payload.value}</text>) as never} />
        <ChartTooltip cursor={{ fill: "rgba(9,9,11,.03)" }} content={({ active, payload }) => {
          const r = active && payload?.[0]?.payload as typeof data[number] | undefined; if (!r) return null;
          return <TipCard title={r.label} rows={[{ c: INK, k: "Passes", v: r.n, strong: true }, { k: "Share of passes", v: `${Math.round(r.share * 100)}%` }]} />;
        }} />
        <Bar dataKey="n" radius={[3, 6, 6, 3]} background={{ fill: "#f4f4f5", radius: 6 } as never} fill={`url(#pz${id})`} shape={((p: { x: number; y: number; width: number; height: number; index: number }) => <rect x={p.x} y={p.y} width={p.width} height={p.height} rx={p.height / 2} fill={p.index === 0 ? `url(#pr${id})` : `url(#pz${id})`} />) as never} {...anim}>
          <LabelList dataKey="n" position="right" offset={10} content={((p: { x: number; y: number; width: number; height: number; index: number; value: number }) => <text x={Number(p.x) + Number(p.width) * (maxN / Math.max(1, Number(p.value))) + 12} y={Number(p.y) + Number(p.height) / 2 + 4} fontSize={11.5} style={F}><tspan fontWeight={600} fill={INK}>{p.value}</tspan><tspan dx={6} fill={AXIS}>{Math.round(data[p.index].share * 100)}%</tspan></text>) as never} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Decision scoreboard: invested vs passed, each split by how the outcome turned out. */
export function OutcomeScore({ outcomes }: { outcomes: Outcome[] }) {
  const red = useReducedMotion();
  const tone = (t: Outcome["tone"]) => (t === "ok" ? OK : t === "rust" ? RUST : t === "warn" ? WARN : "#a1a1aa");
  const row = (dec: Outcome["decision"], label: string) => {
    const xs = outcomes.filter((o) => o.decision === dec);
    const good = xs.filter((o) => (dec === "invested" ? o.tone === "ok" : o.tone !== "rust")).length;
    return (
      <div className="grid grid-cols-[64px_1fr_auto] items-center gap-3 text-[11.5px]">
        <span className="text-zinc-500">{label}</span>
        <span className="flex h-2.5 gap-[2px]">{xs.map((o, i) => <motion.span key={o.id} title={`${o.company} · ${o.result}`} className="h-full flex-1 first:rounded-l-full last:rounded-r-full" style={{ background: tone(o.tone), opacity: o.tone === "rust" && dec === "passed" ? 0.85 : 1 }} initial={red ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.15 + i * 0.08, duration: 0.5 }} />)}</span>
        {xs.length > 0 && xs.every((o) => o.tone === "neutral")
          ? <span className="tnum font-medium">{xs.length} <span className="font-normal text-zinc-400">no outcome yet</span></span>
          : <span className="tnum font-medium">{good}/{xs.length} <span className="font-normal text-zinc-400">{dec === "invested" ? "on plan" : "right call"}</span></span>}
      </div>
    );
  };
  return <div className="space-y-2">{row("invested", "Invested")}{row("passed", "Passed")}</div>;
}

/** Tiny visual for a prior: "48%" → meter, "4 of 9" → dots, "8.9×" → none. */
export function PriorViz({ value }: { value: string }) {
  const pct = /^(\d+)%$/.exec(value), of = /^(\d+) of (\d+)$/.exec(value);
  if (pct) return <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-zinc-100"><motion.span className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#09090b,#52525b)]" initial={{ width: 0 }} animate={{ width: `${pct[1]}%` }} transition={{ duration: 0.8 }} /></span>;
  if (of) return <span className="flex gap-[3px]">{Array.from({ length: +of[2] }).map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < +of[1] ? "bg-rust" : "bg-zinc-200"}`} />)}</span>;
  return null;
}
