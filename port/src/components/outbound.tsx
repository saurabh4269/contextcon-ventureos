"use client";
// Outbound hold queue + toast. Approved sends wait `holdMinutes` (firm setting) before leaving; Undo is one click.
import { useEffect, useState } from "react";
import { Send, Undo2, Check, Lock } from "lucide-react";
import { cx, Undo } from "./ui";
import type { OutboundItem } from "../types";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, "0")}`;

/** Counts down from `secondsLeft`. `tick={false}` freezes it (screenshots/tests). */
export function useCountdown(secondsLeft: number, tick = true) {
  const [s, setS] = useState(secondsLeft);
  useEffect(() => {
    setS(secondsLeft);
    if (!tick) return;
    const t = setInterval(() => setS((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft, tick]);
  return s;
}

export function HoldRing({ left, total, size = 22 }: { left: number; total: number; size?: number }) {
  const r = (size - 3) / 2, c = 2 * Math.PI * r, f = total ? left / total : 0;
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#ececee" strokeWidth={2.5} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#9c440f" strokeWidth={2.5} fill="none" strokeDasharray={`${c * f} ${c}`} strokeLinecap="round" className="motion-safe:transition-[stroke-dasharray] motion-safe:duration-1000 motion-safe:ease-linear" />
    </svg>
  );
}

export function OutboundRow({ o, tick = true, onUndo }: { o: OutboundItem; tick?: boolean; onUndo?: (id: string) => void }) {
  const left = useCountdown(o.secondsLeft, tick && o.status === "holding");
  return (
    <div className={cx("flex h-[44px] items-center gap-3 px-5 text-[12.5px]", o.status === "holding" && "bg-rust-50/40")}>
      {o.status === "holding" ? <HoldRing left={left} total={o.holdSeconds} /> : o.status === "sent" ? <span className="flex size-[22px] items-center justify-center"><Check className="size-4 text-ok" /></span> : <span className="flex size-[22px] items-center justify-center"><Undo2 className="size-3.5 text-zinc-400" /></span>}
      <span className="w-[104px] shrink-0 truncate font-semibold">{o.to}</span>
      <span className={cx("min-w-0 flex-1 truncate", o.status === "undone" ? "text-zinc-400 line-through" : "text-zinc-600")}>{o.subject}</span>
      {o.status === "holding" ? (
        <>
          <span className="tnum text-[11.5px] font-medium text-rust" aria-live="polite">sends in {mmss(left)}</span>
          <button type="button" onClick={() => onUndo?.(o.id)} className="flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 text-[11.5px] font-medium text-ink hover:border-ink">Undo</button>
        </>
      ) : <span className="text-[11px] text-zinc-400">{o.status === "sent" ? "Sent" : "Back in drafts"}</span>}
    </div>
  );
}

export function OutboundQueue({ items, holdMinutes, tick, onUndo }: { items: OutboundItem[]; holdMinutes: number; tick?: boolean; onUndo?: (id: string) => void }) {
  const holding = items.filter((i) => i.status === "holding").length;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3"><span className="flex items-center gap-2 text-[13px] font-medium"><Send className="size-4 text-zinc-500" />Outbound<span className="text-zinc-400">·</span><span className="tnum text-rust">{holding} holding</span></span><span title={`${holdMinutes} min hold before anything leaves`} aria-label={`${holdMinutes} min hold before anything leaves`} className="tnum flex items-center gap-1 text-[11.5px] text-zinc-400"><Lock className="size-3" />{holdMinutes} min</span></div>
      <div className="divide-y divide-zinc-100 border-t border-zinc-100">{items.map((o) => <OutboundRow key={o.id} o={o} tick={tick} onUndo={onUndo} />)}</div>
    </div>
  );
}

/** Bottom toast after you approve a send. */
export function HoldToast({ o, tick = true, onUndo, onSendNow }: { o: OutboundItem; tick?: boolean; onUndo?: (id: string) => void; onSendNow?: (id: string) => void }) {
  const left = useCountdown(o.secondsLeft, tick);
  return (
    <div role="status" className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-ink py-2.5 pr-2.5 pl-4 text-[13px] text-white shadow-[0_20px_50px_-12px_rgba(9,9,11,.55)]">
      <HoldRing left={left} total={o.holdSeconds} size={20} />
      <span>Email to <b>{o.to}</b> sends in <span className="tnum font-semibold">{mmss(left)}</span></span>
      <button type="button" onClick={() => onSendNow?.(o.id)} className="cursor-pointer rounded-lg px-2 py-1 text-[12px] text-zinc-300 hover:bg-white/10">Send now</button>
      <button type="button" onClick={() => onUndo?.(o.id)} className="cursor-pointer rounded-lg bg-white px-3 py-1 text-[12.5px] font-semibold text-ink">Undo</button>
    </div>
  );
}
export { Undo };
