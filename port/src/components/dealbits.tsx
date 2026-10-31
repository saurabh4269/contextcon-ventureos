"use client";
/**
 * v4 · Row parts shared by Today's work list and the Pipeline table, so both speak one language:
 * fit pill (band colours + Crustdata "why" tooltip), stage pill, owner chip, checkbox, inline decision button.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { Check, Plus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Avatar, Src, cx } from "./ui";
import { fitBand, type FitSignal, type PersonRef } from "../types";

export const BAND = { strong: "bg-[#eaf5ee] text-[#1d6b3e]", maybe: "bg-[#fbf3e4] text-[#8a5a12]", weak: "bg-[#fbeee8] text-rust" } as const;
const BAND_DOT = { strong: "bg-[#2f9a5c]", maybe: "bg-[#d39a2c]", weak: "bg-rust" } as const;
const BAND_LABEL = { strong: "Strong fit", maybe: "Possible fit", weak: "Weak fit" } as const;

/** Fit score pill. With `signals`, hover/focus shows the top Crustdata signals behind the score. */
export function FitPill({ score, signals, source = "Crustdata" }: { score: number; signals?: FitSignal[]; source?: string }) {
  // No score yet (NaN): the same pill, neutral, reading "—" (live data never invents a fit).
  if (!Number.isFinite(score)) return <span title="Fit not scored yet"><span className="tnum inline-flex h-6 w-[52px] items-center justify-center rounded-full bg-zinc-100 text-[12px] font-medium text-zinc-500">—</span></span>;
  const b = fitBand(score);
  const pill = <span className={cx("tnum inline-flex h-6 w-[52px] items-center justify-center gap-1.5 rounded-full text-[12px] font-medium", BAND[b])}><span className={cx("size-1.5 rounded-full", BAND_DOT[b])} />{score}</span>;
  if (!signals?.length) return <span title={`Fit ${score} · ${BAND_LABEL[b]}`}>{pill}</span>;
  const top = signals.slice(0, 2);
  return (
    <span tabIndex={0} aria-label={`Fit ${score}. ${top.map((s) => s.label).join(", ")}`} className="group/fit relative inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-rust/30">
      {pill}
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-[236px] -translate-x-1/2 translate-y-1 rounded-[14px] border border-zinc-200/80 bg-white p-3 text-left opacity-0 shadow-[0_1px_2px_rgba(9,9,11,.04),0_16px_36px_-14px_rgba(9,9,11,.25)] transition-all duration-150 group-hover/fit:translate-y-0 group-hover/fit:opacity-100 group-focus-visible/fit:translate-y-0 group-focus-visible/fit:opacity-100">
        <span className="flex items-center gap-2"><span className="tnum text-[13px] font-semibold text-ink">Fit {score}</span><span className="text-[11.5px] text-zinc-500">{BAND_LABEL[b]}</span><Src k="crust" className="ml-auto">{source}</Src></span>
        <span className="mt-2 block space-y-1.5 border-t border-zinc-100 pt-2">
          {top.map((s) => (
            <span key={s.label} className="flex items-center gap-2 text-[12px] whitespace-nowrap text-zinc-700">
              <span className={cx("grid size-[18px] shrink-0 place-items-center rounded-full", s.effect === "up" ? "bg-ok-50 text-ok" : "bg-rust-50 text-rust")}>{s.effect === "up" ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}</span>
              <span className="truncate">{s.label}</span>
            </span>
          ))}
        </span>
        <span aria-hidden className="absolute -bottom-[5px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 border-r border-b border-zinc-200/80 bg-white" />
      </span>
    </span>
  );
}

export type PillTone = "neutral" | "warn" | "rust" | "ink" | "ok";
const TONE: Record<PillTone, { pill: string; dot: string }> = {
  neutral: { pill: "bg-zinc-100/80 text-zinc-600", dot: "bg-zinc-400" },
  warn: { pill: "bg-warn-50 text-warn", dot: "bg-[#d39a2c]" },
  rust: { pill: "bg-rust-50 text-rust", dot: "bg-rust" },
  ink: { pill: "bg-ink text-white", dot: "bg-[#f0b48a]" },
  ok: { pill: "bg-ok-50 text-ok", dot: "bg-[#2f9a5c]" },
};
export function StagePill({ tone = "neutral", children }: { tone?: PillTone; children: ReactNode }) {
  const t = TONE[tone];
  return <span className={cx("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap", t.pill)}><span className={cx("size-1.5 rounded-full", t.dot)} />{children}</span>;
}

export function Checkbox({ on, mixed, label, onChange }: { on: boolean; mixed?: boolean; label: string; onChange: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={mixed ? "mixed" : on} aria-label={label} onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={cx("grid size-[18px] place-items-center rounded-[6px] transition-colors", on || mixed ? "bg-ink text-white" : "bg-white ring-1 ring-zinc-300 hover:ring-zinc-400")}>
      {on ? <Check className="size-3" strokeWidth={3} /> : mixed ? <span className="h-[2px] w-2 rounded bg-white" /> : null}
    </button>
  );
}

/** Owner avatar + first name ("You" for the signed-in user), or a dashed "Unassigned" slot. */
export function OwnerChip({ o, me, unassigned = "Unassigned" }: { o?: PersonRef; me?: { id?: string; name: string }; unassigned?: string }) {
  if (!o) return <span className="inline-flex items-center gap-2 text-[12.5px] whitespace-nowrap text-zinc-400"><span className="grid size-6 place-items-center rounded-full border border-dashed border-zinc-300 bg-white"><Plus className="size-3" /></span>{unassigned}</span>;
  return <span title={o.name} className="inline-flex min-w-0 items-center gap-2 text-[12.5px] text-zinc-700"><Avatar i={o.initials} size={24} tone="sand" /><span className="truncate">{me && (o.id ? o.id === me.id : o.name === me.name) ? "You" : o.name.split(" ")[0]}</span></span>;
}

/** Inline decision. `recommended` = the agent's pick: the one filled button in its row. */
export function DecisionBtn({ label, recommended, href, onClick, className }: { label: string; recommended?: boolean; href?: string; onClick?: () => void; className?: string }) {
  const cls = cx("inline-flex h-8 w-[96px] shrink-0 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-all duration-150 group-hover:-translate-y-px",
    recommended ? "bg-ink text-white shadow-[0_1px_2px_rgba(9,9,11,.2),inset_0_1px_0_rgba(255,255,255,.12)] group-hover:shadow-[0_6px_14px_-6px_rgba(9,9,11,.45),inset_0_1px_0_rgba(255,255,255,.12)] hover:bg-zinc-800"
      : "bg-white text-zinc-700 ring-1 ring-zinc-200 group-hover:shadow-[0_4px_12px_-6px_rgba(9,9,11,.22)] group-hover:ring-zinc-300 hover:text-ink", className);
  const body = <>{recommended && <Sparkles className="size-3 text-[#f0b48a]" strokeWidth={2} />}{label}</>;
  const title = recommended ? "Agent recommends" : undefined;
  if (href) return <Link href={href} title={title} className={cls} onClick={(e) => e.stopPropagation()}>{body}</Link>;
  return <button type="button" title={title} className={cls} onClick={(e) => { e.stopPropagation(); onClick?.(); }}>{body}</button>;
}
