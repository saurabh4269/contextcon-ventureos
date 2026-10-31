"use client";
import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Ring, Severity, CapRange, IconMenu, DetailRows, CompanyLogo, Avatar, cx } from "./ui";
import { FitPill } from "./dealbits";
import { RangeMini } from "./charts";
import { WallBadge } from "./wall";
import { WhyChip } from "./why";
import { fmtMoney } from "../lib/format";
import type { DealHeader } from "../types";

// Compact deal header shared by deal page and data room.
// v3.2: title + one quiet meta line. Stage, IC date, data-room progress, red flags and the range move into one Details popover.
// v4: the same fit pill and owner as Today's work list next to the title, and a quiet metric row under it (S2_B / Activity-tab header):
// 12px labels over Geist values, hairline dividers, status in rust.
export function DealHead({ h, primary, walled }: { h: DealHeader; primary: ReactNode; walled?: boolean }) {
  const v = h.valuation;
  return (
    <div className="border-b border-zinc-200/70 bg-white px-8 pt-5 pb-4">
      <div className="flex items-center gap-3.5">
        <CompanyLogo c={h.company} size={40} />
        <div className="min-w-0">
          <div className="flex items-center gap-2.5"><h1 className="serif truncate text-[28px] leading-none">{h.company.name}</h1>{h.fit && <FitPill score={h.fit.score} signals={h.fit.signals} />}{walled && <WallBadge inside />}</div>
          <div className="mt-1.5 flex min-w-0 items-center gap-2 text-[12.5px] text-zinc-500">
            <span className="truncate">{h.metrics ? h.subtitle : `${h.stageLabel} · ${h.icLabel}`}</span>
            {h.owner && <><span className="text-zinc-300">·</span><span title={`Lead: ${h.owner.name}`} className="inline-flex shrink-0 items-center gap-1.5 text-zinc-600"><Avatar i={h.owner.initials} size={18} tone="sand" />{h.owner.name}</span></>}
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <IconMenu icon={<Info />} label="Deal details" w={320} title={h.subtitle}>
            <DetailRows rows={[
              { k: "Stage", v: h.stageLabel },
              { k: "Next", v: h.icLabel },
              { k: "Data room", v: h.files.total > 0 ? <span className="inline-flex items-center gap-2"><Ring v={h.files.reviewed / h.files.total} size={18} stroke={2.5} /><span className="tnum">{h.files.reviewed}/{h.files.total} reviewed</span></span> : <span className="text-zinc-500">No data room yet</span> },
              { k: "Red flags", v: <span className="inline-flex items-center gap-2"><Severity levels={h.flags} size={10} /><span className="tnum">{h.flags.length}</span></span> },
              ...(v ? [{ k: "Range", v: <span className="tnum"><CapRange v={v} />{v.ask !== undefined && <span className="ml-1.5 font-medium text-rust">· Ask {fmtMoney(v.ask, v.unit)}</span>}</span> }] : []),
            ]} />
            {v && <span className="mt-3 block"><RangeMini v={v} w={290} /></span>}
          </IconMenu>
          {primary}
        </div>
      </div>
      {h.metrics && (
        <dl className="mt-4 ml-[54px] flex min-w-0 items-stretch overflow-hidden">
          {h.metrics.map((m, i) => (
            <div key={m.id} title={m.hint ?? (m.sub ? `${m.label}: ${m.value} · ${m.sub}` : undefined)} className={cx("min-w-0 shrink-0", i > 0 && "ml-5 border-l border-zinc-200/80 pl-5 @max-[1040px]/main:ml-4 @max-[1040px]/main:pl-4")}>
              <dt className="text-[12px] text-zinc-500">{m.label}</dt>
              <dd className={cx("tnum mt-0.5 flex items-center gap-1.5 text-[13.5px] font-medium whitespace-nowrap", m.tone === "rust" ? "text-rust" : m.tone === "ok" ? "text-ok" : "text-ink")}>
                {m.tone === "rust" && <span className="size-1.5 rounded-full bg-rust" />}
                <span data-metric={m.id}>{m.value}</span>{m.sub && i === 0 && <span className="font-normal text-zinc-500">{m.sub}</span>}<WhyChip why={m.why} label={m.label} value={m.value} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
