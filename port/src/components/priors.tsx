"use client";
// Valuation priors: where our cap and the ask sit against the firm's own past multiples (Firm brain → outcomes).
import { motion } from "framer-motion";
import { Src, cx } from "./ui";
import type { ValuationPriors } from "../types";

export function PriorsStrip({ p, cap, ask, unit = "M" }: { p: ValuationPriors; cap: number; ask?: number; unit?: string }) {
  const x = (m: number) => Math.max(0, Math.min(100, ((m - p.axis.min) / (p.axis.max - p.axis.min)) * 100));
  const capX = cap / p.arr, askX = ask !== undefined ? ask / p.arr : undefined;
  const ticks = Array.from({ length: p.axis.max - p.axis.min + 1 }, (_, i) => p.axis.min + i);
  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <div className="flex items-baseline gap-2"><span className="eyebrow">Firm priors · {p.basisLabel}</span><span className="ml-auto text-[11.5px] text-zinc-500">{p.comparable.length} past deals · median <b className="tnum text-ink">{p.median.toFixed(1)}×</b></span></div>
      <div className="relative mt-7 mb-1 h-8">
        <div className="absolute inset-x-0 top-1/2 h-px bg-zinc-200" />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute top-1/2 h-3 -translate-y-1/2 rounded bg-zinc-200/80" style={{ left: `${x(p.band.low)}%`, width: `${x(p.band.high) - x(p.band.low)}%` }} />
        <div className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-zinc-500" style={{ left: `${x(p.median)}%` }} />
        {p.comparable.map((c) => (
          <span key={c.company} title={`${c.company} · ${c.multiple}× · ${c.outcome}`} className={cx("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white", c.tone === "ok" ? "bg-ok" : c.tone === "rust" ? "bg-rust/70" : "bg-zinc-400")} style={{ left: `${x(c.multiple)}%` }} />
        ))}
        <span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold" style={{ left: `${x(capX)}%` }}>cap {capX.toFixed(1)}×</span>
        <span className="absolute -top-1 h-10 w-[2px] -translate-x-1/2 bg-ink" style={{ left: `${x(capX)}%` }} />
        {askX !== undefined && <><span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-rust" style={{ left: `${x(askX)}%` }}>ask {askX.toFixed(1)}×</span><span className="absolute -top-1 h-10 w-[2px] -translate-x-1/2 bg-rust" style={{ left: `${x(askX)}%` }} /></>}
      </div>
      <div className="relative h-4 text-[10.5px] text-zinc-400">{ticks.filter((t) => t % 2 === 0).map((t) => <span key={t} className="tnum absolute -translate-x-1/2" style={{ left: `${x(t)}%` }}>{t}×</span>)}</div>
      <div className="mt-3 grid grid-cols-5 gap-1.5 text-[11px]">
        {p.comparable.map((c) => <div key={c.company} className="rounded-lg bg-zinc-50 px-2 py-1.5"><div className="flex items-baseline justify-between gap-1"><span className="truncate font-medium" title={c.company}>{c.company.split(" ")[0]}</span><span className="tnum shrink-0 text-zinc-500">{c.multiple}×</span></div><div className={cx("truncate", c.tone === "ok" ? "text-ok" : c.tone === "rust" ? "text-rust" : "text-zinc-500")}>{c.outcome}</div></div>)}
      </div>
      <div className="mt-3 flex items-start gap-2 text-[12.5px] leading-snug text-zinc-700"><span className="flex-1">{p.note}</span><Src k={p.source.kind}>{p.source.label}</Src></div>
      <div className="mt-1 text-[11px] text-zinc-400">Implied by priors: <span className="tnum">${p.implied.low}–{p.implied.high}{unit}</span> on ${p.arr}{unit} verified ARR</div>
    </div>
  );
}
