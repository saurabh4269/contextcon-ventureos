"use client";
/** v3.2 · Live activity rail (Gemini P1): the running step glows and shimmers, a dot travels down into it, finished steps carry a check. */
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useReducedMotion } from "./motion";
import { Pulse } from "./motion";
import { cx } from "./ui";
import type { LiveRun } from "../types";

const ROW = 30;
export function LiveRail({ run, mono, boxed, className, tone = "warm", status }: { run: LiveRun; mono?: boolean; /** v3.4 · header word when the run is not live (e.g. "Last run"); the pulse goes quiet */ status?: string; /** "sienna" = rust live dot + sienna shimmer (Today) */ tone?: "warm" | "sienna"; /** card style, for page columns rather than the dock */ boxed?: boolean; /** replaces the boxed card chrome (border, radius, bg) */ className?: string }) {
  const r = useReducedMotion();
  const cur = Math.max(0, run.steps.findIndex((s) => s.state === "running"));
  const sienna = tone === "sienna" && !mono, total = run.steps.length, done = run.steps.filter((s) => s.state === "done").length;
  const at = run.steps.some((s) => s.state === "running") ? cur + 1 : done;
  return (
    <div className={cx(boxed ? cx(className ?? "rounded-xl border border-zinc-200/80 bg-white", "flex flex-col px-4 pt-3.5 pb-3") : "border-b border-zinc-100 px-4 pt-3.5 pb-3", mono ? "glow-mono" : sienna ? "glow-sienna" : "glow-warm")}>
      <div className="flex items-center gap-2 text-[12px]">
        {status ? <span className="size-1.5 shrink-0 rounded-full bg-zinc-300" /> : <Pulse className={mono ? "bg-ink" : sienna ? "bg-[#c2652b]" : "bg-[#5a8f6c]"} />}
        <span className="font-medium whitespace-nowrap text-ink">{status ?? "Live"}</span>
        <span className="truncate text-zinc-500">{run.title}</span>
        {run.href && (boxed
          ? <Link href={run.href} className="ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-zinc-600 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 hover:text-ink">Open<ArrowUpRight className="size-3.5" /></Link>
          : <Link href={run.href} className="ml-auto shrink-0 text-[11.5px] text-zinc-400 hover:text-ink">Open</Link>)}
      </div>
      <ol className="relative mt-2.5" aria-label={`${run.title} progress`}>
        <span className="absolute left-[7px] w-px bg-zinc-200" style={{ top: ROW / 2, height: (run.steps.length - 1) * ROW }} />
        <span className="absolute left-[7px] w-px bg-[var(--ink-edge)]" style={{ top: ROW / 2, height: cur * ROW }} />
        {!r && cur > 0 && <span className="live-dot absolute left-[4.5px] size-1.5 rounded-full bg-[var(--glow)] shadow-[0_0_0_3px_var(--glow-soft),0_0_8px_var(--glow-halo)]" style={{ top: ROW / 2 + (cur - 1) * ROW - 3, ["--live-d" as string]: `${ROW}px` }} />}
        {run.steps.map((s, i) => (
          <li key={s.id} className="relative flex items-center gap-3" style={{ height: ROW }}>
            <span className="relative z-10 grid size-[15px] shrink-0 place-items-center">
              {s.state === "done" && <motion.span initial={r ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 420, damping: 22, delay: 0.15 + i * 0.12 }} className="grid size-[15px] place-items-center rounded-full bg-ink text-white"><Check className="size-2.5" strokeWidth={3} /></motion.span>}
              {s.state === "running" && <span className="relative grid size-[15px] place-items-center"><span className="absolute inset-0 rounded-full bg-[var(--glow-soft)] motion-safe:animate-ping" /><span className="size-[9px] rounded-full bg-[var(--glow)] shadow-[0_0_10px_var(--glow-halo)]" /></span>}
              {s.state === "queued" && <span className="size-[7px] rounded-full border border-zinc-300 bg-white" />}
            </span>
            <span className={cx("truncate text-[12.5px]", s.state === "running" ? cx("shimmer font-medium", sienna ? "shimmer-sienna" : "shimmer-ink") : s.state === "done" ? "text-zinc-600" : "text-zinc-400")}>{s.label}{s.state === "running" ? "…" : ""}</span>
          </li>
        ))}
      </ol>
      {boxed && run.startedAt && (
        <div className="mt-auto pt-3">
          <div className="h-[3px] overflow-hidden rounded-full bg-zinc-100"><motion.div initial={r ? false : { width: 0 }} animate={{ width: `${((done + (at > done ? 0.5 : 0)) / total) * 100}%` }} transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }} className="h-full rounded-full bg-[var(--glow)]" /></div>
          <div className="tnum mt-2 flex justify-between text-[11.5px] text-zinc-500"><span>{at} of {total} steps</span><span>started {run.startedAt}</span></div>
        </div>
      )}
    </div>
  );
}
