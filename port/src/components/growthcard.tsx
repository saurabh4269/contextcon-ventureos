"use client";
import { GrowthCompare } from "./charts";
import { Src } from "./ui";
import type { GrowthComparison } from "../types";

const pc = (r: number) => `${Math.round(r * 100)}%`;
/** v3.2 · Seed hero: one chart, the gap number front and centre (Gemini P2). Line labels replace the legend; the MoM strip moves out of the hero. */
export function GrowthCard({ g, w = 600, compact }: { g: GrowthComparison; w?: number; compact?: boolean }) {
  const n = g.verified.length, end = g.verified[n - 1], claimedEnd = Math.round(g.verified[0] * Math.pow(1 + g.claimedRate, n - 1) * 1e4) / 1e4;
  const money = (v: number) => `$${v >= 100 ? v.toFixed(0) : v.toFixed(v >= 10 ? 0 : 1)}${g.unit}`;
  return (
    <div>
      {!compact && (
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 @max-[1040px]/main:flex-col @max-[1040px]/main:items-start @max-[1040px]/main:gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="numeral text-[44px] leading-none whitespace-nowrap text-rust">−{money(claimedEnd - end)}</span><span className="text-[13px] text-zinc-500">{g.metric} in {g.months[n - 1]} vs what the deck implies</span></div>
            <div className="mt-2 text-[12.5px] text-zinc-500"><span className="tnum">{money(end)}</span> verified · <span className="tnum">{money(claimedEnd)}</span> at {pc(g.claimedRate)}/mo</div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5 @max-[1040px]/main:flex-row @max-[1040px]/main:flex-wrap">
            {g.claimedSource && <Src k={g.claimedSource.kind} tone="rust">{g.claimedSource.label}</Src>}
            <Src k={g.verifiedSource.kind}>{g.verifiedSource.label}</Src>
          </div>
        </div>
      )}
      <div className={compact ? "" : "mt-6"}><GrowthCompare g={g} w={w} h={compact ? 200 : 270} strip={!!compact} /></div>
    </div>
  );
}
