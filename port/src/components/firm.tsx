"use client";
// Firm-level controls shared by onboarding (step 5) and Settings → Workflow.
import { Minus, Plus, Eye, PenLine, Clock, Zap, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { useReducedMotion } from "./motion";
import type { ReactNode } from "react";
import { cx } from "./ui";
import type { Autonomy } from "../types";

export const AUTONOMY: { level: Autonomy; name: string; does: string; icon: typeof Eye }[] = [
  { level: 0, name: "Watch", does: "Reads and flags. Writes nothing.", icon: Eye },
  { level: 1, name: "Draft", does: "Drafts every email and update. You send.", icon: PenLine },
  { level: 2, name: "Send on approve", does: "Sends what you approve, after the hold.", icon: Clock },
  { level: 3, name: "Act", does: "Moves stages and sends routine passes, still held.", icon: Zap },
];

/** L0–L3 segmented control with hold minutes. Never-does list is fixed. */
export function AutonomyControl({ value, holdMinutes, onChange, onHold, compact }: { value: Autonomy; holdMinutes: number; onChange?: (a: Autonomy) => void; onHold?: (m: number) => void; compact?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div>
      <div role="radiogroup" aria-label="Agent autonomy" className="grid grid-cols-4 gap-1 rounded-xl bg-zinc-100 p-1">
        {AUTONOMY.map((a) => {
          const on = a.level === value, I = a.icon;
          return (
            <button key={a.level} type="button" role="radio" aria-checked={on} onClick={() => onChange?.(a.level)} className={cx("relative rounded-lg px-3 text-left", compact ? "py-2" : "py-2.5")}>
              {on && <motion.span layoutId="autonomy-pill" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }} className="absolute inset-0 rounded-lg bg-white shadow-[0_1px_3px_rgba(9,9,11,.12)] ring-1 ring-zinc-200" />}
              <span className="relative flex items-center gap-1.5 text-[12.5px] font-medium"><span className={cx("tnum rounded px-1 text-[10.5px] font-semibold", on ? "bg-ink text-white" : "bg-zinc-200 text-zinc-600")}>L{a.level}</span><I className={cx("size-3.5", on ? "text-ink" : "text-zinc-400")} />{a.name}</span>
              {!compact && <span className={cx("relative mt-1 block text-[11.5px] leading-snug", on ? "text-zinc-600" : "text-zinc-400")}>{a.does}</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3 text-[12.5px]">
        <span className="flex items-center gap-1.5 text-zinc-600"><Clock className="size-3.5" />Hold before anything leaves</span>
        <Stepper value={holdMinutes} unit="min" onChange={onHold} min={0} max={60} step={5} disabled={value < 2} />
        <span className="ml-auto flex items-center gap-1 text-[11.5px] text-zinc-500"><Lock className="size-3" />Never signs, never shares files, never sends to founders via Slack</span>
      </div>
    </div>
  );
}

export function Stepper({ value, unit, onChange, min = 0, max = 99, step = 1, disabled }: { value: number; unit?: string; onChange?: (n: number) => void; min?: number; max?: number; step?: number; disabled?: boolean }) {
  return (
    <span className={cx("inline-flex h-7 items-center rounded-lg border border-zinc-200 bg-white", disabled && "opacity-50")}>
      <button type="button" aria-label="Less" disabled={disabled} onClick={() => onChange?.(Math.max(min, value - step))} className="flex size-7 items-center justify-center text-zinc-500"><Minus className="size-3" /></button>
      <span className="tnum min-w-[52px] border-x border-zinc-200 text-center text-[12.5px] font-semibold">{value} {unit}</span>
      <button type="button" aria-label="More" disabled={disabled} onClick={() => onChange?.(Math.min(max, value + step))} className="flex size-7 items-center justify-center text-zinc-500"><Plus className="size-3" /></button>
    </span>
  );
}

/** Two-option segmented control. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string; sub?: string }[]; onChange?: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid rounded-xl bg-zinc-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => <button key={o.id} type="button" role="radio" aria-checked={o.id === value} onClick={() => onChange?.(o.id)} className={cx("rounded-lg px-3 py-2 text-left", o.id === value ? "bg-white shadow-[0_1px_3px_rgba(9,9,11,.12)] ring-1 ring-zinc-200" : "text-zinc-500")}><span className="block text-[13px] font-medium">{o.label}</span>{o.sub && <span className="block text-[11.5px] text-zinc-500">{o.sub}</span>}</button>)}
    </div>
  );
}

/** Label + read-only-looking input. Real app: swap for your form inputs. */
export function Field({ label, value, hint, prefix, w, onChange, mono }: { label: string; value: string; hint?: ReactNode; prefix?: ReactNode; w?: string; onChange?: (v: string) => void; mono?: boolean }) {
  return (
    <label className={cx("block", w)}>
      <span className="text-[12px] font-medium text-zinc-600">{label}</span>
      <span className="mt-1 flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 shadow-[0_1px_2px_rgba(9,9,11,.04)] focus-within:border-ink">
        {prefix}<input value={value} onChange={(e) => onChange?.(e.target.value)} readOnly={!onChange} className={cx("min-w-0 flex-1 bg-transparent text-[14px] outline-none", mono && "font-mono text-[13px]")} />
      </span>
      {hint && <span className="mt-1 block text-[11.5px] text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Chip({ children, on = true, onClick }: { children: ReactNode; on?: boolean; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className={cx("rounded-full border px-2.5 py-0.5 text-[12px]", on ? "border-ink bg-ink text-white" : "border-zinc-200 bg-white text-zinc-500")}>{children}</button>;
}
