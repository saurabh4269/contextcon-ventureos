"use client";
/**
 * v4 · Deal page sections behind the left rail (Overview, Team, Customers, Market, Cap table, Valuation), all from
 * `DealData.sections`. Same language as Today and the Growth section: eyebrow + Newsreader headline, 20px cards with a
 * hairline border and soft shadow, 12px labels over Geist tabular numbers, Creliq-like tables, soft bar charts.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Check, Sparkles, X } from "lucide-react";
import { CompanyLogo, Avatar, HL, Src, cx } from "./ui";
import { SparkArea, RangeChart } from "./charts";
import { StagePill } from "./dealbits";
import { motion } from "framer-motion";
import { Rise, Grow, GrowUp, useReducedMotion } from "./motion";
import type { DealSection, DealEvent, CapRow } from "../types";

export const CARD = "rounded-[20px] border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(9,9,11,.03),0_12px_32px_-18px_rgba(9,9,11,.10)]";
const TH = "h-10 border-b border-zinc-100 text-[12px] font-normal text-zinc-500";
const pct = (n: number, d = 0) => `${n.toFixed(d)}%`;

function Card({ title, right, children, className, i = 1 }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; i?: number }) {
  return (
    <Rise i={i} className={cx(CARD, "mt-4 p-5", className)}>
      {title && <div className="mb-4 flex items-center gap-2"><span className="text-[14px] font-medium">{title}</span>{right && <span className="ml-auto flex items-center gap-2">{right}</span>}</div>}
      {children}
    </Rise>
  );
}
function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "rust" }) {
  return <div className="min-w-0"><div className="text-[12px] text-zinc-500">{label}</div><div className={cx("numeral mt-1 text-[28px] leading-none", tone === "rust" && "text-rust")}>{value}</div>{sub && <div className="mt-1.5 truncate text-[12px] text-zinc-500">{sub}</div>}</div>;
}
function StatRow({ stats }: { stats: { id: string; label: string; value: string; sub?: string }[] }) {
  return (
    <Card i={1}>
      <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0,1fr))` }}>
        {stats.map((s, i) => <div key={s.id} className={cx(i > 0 && "border-l border-zinc-100 pl-5")}><Stat label={s.label} value={s.value} sub={s.sub} /></div>)}
      </div>
    </Card>
  );
}
/** Soft vertical bars with month labels and the last bar in ink (Callora / Today's chart language). */
function Bars({ labels, values, h = 120, fmt = String }: { labels: string[]; values: number[]; h?: number; fmt?: (v: number) => string }) {
  const max = Math.max(...values);
  return (
    <div className="flex items-end gap-3" style={{ height: h + 40 }}>
      {values.map((v, i) => {
        const last = i === values.length - 1;
        return (
          <div key={labels[i]} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className={cx("tnum text-[11.5px]", last ? "font-semibold text-ink" : "text-zinc-500")}>{fmt(v)}</span>
            <GrowUp h={(v / max) * h} delay={0.1 + i * 0.06} className={cx("w-full max-w-[44px] rounded-[8px]", last ? "bg-ink" : "bg-[linear-gradient(180deg,#e7e5e4,#f1f0ef)]")} />
            <span className={cx("text-[11px]", last ? "font-medium text-ink" : "text-zinc-400")}>{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function SectionHead({ eyebrow, headline, source }: { eyebrow: string; headline: DealSection["headline"]; source?: DealSection["source"] }) {
  return (
    <Rise>
      <div className="flex items-center gap-2"><span className="eyebrow">{eyebrow}</span>{source && <span className="ml-auto"><Src k={source.kind}>{source.label}</Src></span>}</div>
      <h2 className="serif mt-2 text-[34px] leading-tight text-pretty @max-[1180px]/main:text-[30px]"><HL h={headline} /></h2>
    </Rise>
  );
}

function Timeline({ events }: { events: DealEvent[] }) {
  return (
    <ol className="relative">
      {events.map((e, i) => (
        <li key={e.id} className="relative grid grid-cols-[28px_minmax(0,1fr)_auto] gap-x-3 pb-4 last:pb-0">
          {i < events.length - 1 && <span aria-hidden className="absolute top-7 bottom-0 left-[13.5px] w-px bg-zinc-200" />}
          <span className={cx("relative grid size-7 place-items-center rounded-full ring-4 ring-white", e.tone === "rust" ? "bg-rust-50 text-rust" : e.by === "agent" ? "bg-[#fbf3ea] text-[#b2591f]" : "bg-zinc-100 text-zinc-600")}>
            {e.by === "agent" ? <Sparkles className="size-3.5" strokeWidth={1.75} /> : e.tone === "ok" ? <Check className="size-3.5" strokeWidth={2} /> : <span className="text-[9.5px] font-semibold">{e.who}</span>}
          </span>
          <div className="min-w-0 pt-1">
            <div className="flex flex-wrap items-center gap-2 text-[13px]"><span className={cx("font-medium", e.tone === "rust" && "text-rust")}>{e.label}</span>{e.by === "agent" && <span className="rounded-full bg-[#fbf3ea] px-2 py-px text-[11px] text-[#9c440f]">{e.who}</span>}</div>
            {e.detail && <div className="mt-0.5 text-[12px] text-zinc-500">{e.detail}</div>}
          </div>
          <span className="tnum pt-1 text-[12px] whitespace-nowrap text-zinc-400">{e.at}</span>
        </li>
      ))}
    </ol>
  );
}

const CAP_TONE: Record<CapRow["kind"], string> = { founder: "bg-ink", angel: "bg-[#c9a27e]", esop: "bg-[#e3cfb9]", safe: "bg-zinc-300", new: "bg-[#dfa47c]" };
const capTone = (r: CapRow) => (r.us ? "bg-rust" : CAP_TONE[r.kind]);

export function DealSectionView({ s }: { s: DealSection }) {
  const r = useReducedMotion();
  const head = <SectionHead eyebrow={s.eyebrow} headline={s.headline} source={s.source} />;
  switch (s.kind) {
    case "overview": return (
      <>
        {head}
        <Rise i={1} className="mt-5 grid grid-cols-4 gap-3 @max-[1040px]/main:grid-cols-2">
          {s.kpis.map((k) => (
            <div key={k.id} className={cx(CARD, "p-4")}>
              <div className="flex items-center gap-1.5 text-[12px] text-zinc-500"><span className="truncate">{k.label}</span>{k.verified && <span title="Verified against source" className="ml-auto grid size-4 shrink-0 place-items-center rounded-full bg-ok-50 text-ok"><Check className="size-2.5" strokeWidth={3} /></span>}</div>
              <div className="numeral mt-2 text-[30px] leading-none">{k.value}</div>
              <div className="mt-1.5 truncate text-[12px] text-zinc-500">{k.sub}</div>
              {k.trend && <div className="mt-3"><SparkArea d={k.trend} w={120} h={28} color="#9c440f" /></div>}
            </div>
          ))}
        </Rise>
        <div className="grid grid-cols-2 gap-4 @max-[1040px]/main:grid-cols-1">
          <Card title="Thesis fit" right={<span className="tnum text-[12px] text-zinc-500">{s.thesis.filter((t) => t.ok).length} of {s.thesis.length}</span>} i={2}>
            <div className="flex flex-wrap gap-2">
              {s.thesis.map((t) => (
                <span key={t.id} className={cx("inline-flex h-7 items-center gap-1.5 rounded-full pr-3 pl-1.5 text-[12.5px]", t.ok ? "bg-zinc-50 text-zinc-700 ring-1 ring-zinc-200/80" : "bg-rust-50 text-rust ring-1 ring-rust/15")}>
                  <span className={cx("grid size-[18px] place-items-center rounded-full", t.ok ? "bg-ok-50 text-ok" : "bg-white text-rust")}>{t.ok ? <Check className="size-3" strokeWidth={2.5} /> : <X className="size-3" strokeWidth={2.5} />}</span>{t.label}
                </span>
              ))}
            </div>
          </Card>
          <Card title="Company" i={2}>
            <dl className="-my-1.5 divide-y divide-zinc-100">
              {s.facts.map((f) => <div key={f.k} className="flex items-center justify-between gap-4 py-[7px] text-[13px]"><dt className="shrink-0 text-zinc-500">{f.k}</dt><dd className="min-w-0 truncate text-right font-medium">{f.v}</dd></div>)}
            </dl>
          </Card>
        </div>
        <Card title="Deal so far" right={<span className="text-[12px] text-zinc-500">{s.timeline.length} events</span>} i={3}><Timeline events={s.timeline} /></Card>
      </>
    );
    case "team": {
      const months = s.hiring.months, totals = months.map((_, i) => s.hiring.series.reduce((a, x) => a + x.values[i], 0)), max = Math.max(...totals);
      const shade = ["bg-ink", "bg-[#c9a27e]", "bg-[#e7e0d8]"];
      return (
        <>
          {head}
          <StatRow stats={s.stats} />
          <Card title="Key people" right={<span className="text-[12px] text-zinc-500">{s.people.filter((p) => p.check.ok).length} of {s.people.length} verified</span>} i={2} className="p-0 pt-5">
            <div className="px-5"><div className={cx("grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_164px] items-center gap-x-4", TH)}><span>Name</span><span>Before</span><span>Check</span></div></div>
            {s.people.map((p) => {
              const name = <><Avatar i={p.initials} size={32} tone={p.founder ? "ink" : "sand"} /><span className="min-w-0"><span className="flex items-center gap-1 truncate font-medium">{p.name}{p.href && <ArrowUpRight className="size-3.5 shrink-0 text-zinc-300 transition-colors group-hover/p:text-ink" />}</span><span className="block truncate text-[12px] text-zinc-500">{p.role}</span></span></>;
              return (
                <div key={p.id} className="row-hover grid h-[60px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)_164px] items-center gap-x-4 border-t border-zinc-100 px-5 text-[13px] first-of-type:border-0">
                  {p.href ? <Link href={p.href} title={`Open ${p.name}`} className="group/p flex min-w-0 items-center gap-3">{name}</Link> : <span className="flex min-w-0 items-center gap-3">{name}</span>}
                  <span className="min-w-0"><span className="block truncate text-zinc-700">{p.prev}</span><span className="tnum block truncate text-[12px] text-zinc-500">{p.tenure}</span></span>
                  <span><StagePill tone={p.check.ok ? "ok" : "warn"}>{p.check.label}</StagePill></span>
                </div>
              );
            })}
          </Card>
          <Card title="Headcount by function" right={<>{s.hiring.series.map((x, i) => <span key={x.id} className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500"><span className={cx("size-2 rounded-[3px]", shade[i])} />{x.label}</span>)}</>} i={3}>
            <div className="flex items-end gap-4" style={{ height: 172 }}>
              {months.map((m, i) => (
                <div key={m} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                  <span className={cx("tnum text-[11.5px]", i === months.length - 1 ? "font-semibold" : "text-zinc-500")}>{totals[i]}</span>
                  <motion.div initial={r ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.7, delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }} style={{ height: (totals[i] / max) * 120, transformOrigin: "bottom" }} title={s.hiring.series.map((x) => `${x.label} ${x.values[i]}`).join(" · ")} className="flex w-full max-w-[48px] flex-col-reverse gap-[2px] overflow-hidden rounded-[8px]">
                    {s.hiring.series.map((x, j) => <span key={x.id} className={cx("block w-full", shade[j])} style={{ flexGrow: x.values[i] }} />)}
                  </motion.div>
                  <span className={cx("text-[11px]", i === months.length - 1 ? "font-medium text-ink" : "text-zinc-400")}>{m}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      );
    }
    case "customers": return (
      <>
        {head}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-4 @max-[1040px]/main:grid-cols-1">
          <Card i={1}>
            <div className="grid gap-4">{s.stats.map((x) => <Stat key={x.id} label={x.label} value={x.value} />)}</div>
          </Card>
          <Card title="Paying plants" right={<span className="text-[12px] text-zinc-500">by month</span>} i={1}><Bars labels={s.plants.months} values={s.plants.values} h={128} /></Card>
        </div>
        <Card title="Top plants by revenue" right={<span className="text-[12px] text-zinc-500">{s.note}</span>} i={2} className="p-0 pt-5">
          <div className="px-5"><div className={cx("grid grid-cols-[minmax(0,1fr)_60px_100px_96px] items-center gap-x-4", TH)}><span>Customer</span><span className="text-right">MRR</span><span>Share</span><span>Status</span></div></div>
          {s.rows.map((r) => (
            <div key={r.id} title={r.source.label} className="row-hover grid h-[60px] grid-cols-[minmax(0,1fr)_60px_100px_96px] items-center gap-x-4 border-t border-zinc-100 px-5 text-[13px] first-of-type:border-0">
              <span className="flex min-w-0 items-center gap-3"><CompanyLogo c={r.company} size={30} /><span className="min-w-0"><span className="block truncate font-medium">{r.company.name}</span><span className="block truncate text-[12px] text-zinc-500">{r.plant} · since {r.since}</span></span></span>
              <span className="tnum text-right font-medium">${r.mrr.toFixed(1)}{s.unit}</span>
              <span className="flex items-center gap-2"><span className="h-1.5 flex-1 rounded-full bg-zinc-100"><Grow w={`${(r.share / s.rows[0].share) * 100}%`} className="h-full rounded-full bg-ink" /></span><span className="tnum w-8 text-right text-[12px] text-zinc-500">{pct(r.share * 100)}</span></span>
              <span><StagePill tone={r.status.tone}>{r.status.label}</StagePill></span>
            </div>
          ))}
        </Card>
      </>
    );
    case "market": {
      const max = Math.sqrt(Math.max(...s.sizes.map((x) => x.value)));
      return (
        <>
          {head}
          <Card title="Market size" i={1}>
            <div className="space-y-3.5">
              {s.sizes.map((x, i) => (
                <div key={x.id} className="grid grid-cols-[44px_minmax(0,1fr)_64px] items-center gap-3">
                  <span className="text-[12px] font-medium text-zinc-500">{x.label}</span>
                  <div className="min-w-0">
                    <div className="h-8 rounded-full bg-zinc-50 ring-1 ring-zinc-100"><Grow delay={0.1 + i * 0.1} w={`${Math.max(6, (Math.sqrt(x.value) / max) * 100)}%`} className={cx("h-full rounded-full", i === s.sizes.length - 1 ? "bg-rust" : i === 1 ? "bg-[#c9a27e]" : "bg-[#ece4da]")} /></div>
                    <div className="mt-1 truncate text-[12px] text-zinc-500">{x.note}</div>
                  </div>
                  <span className="numeral text-right text-[20px]">{x.display}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Comparables" right={<span className="text-[12px] text-zinc-500">Run-rate multiple at last round</span>} i={2} className="p-0 pt-5">
            <div className="px-5"><div className={cx("grid grid-cols-[minmax(0,1.6fr)_92px_88px_64px] items-center gap-x-3", TH)}><span>Company</span><span>Stage</span><span className="text-right">Raised</span><span className="text-right">Multiple</span></div></div>
            {s.comps.map((c) => (
              <div key={c.id} className={cx("row-hover grid h-[60px] grid-cols-[minmax(0,1.6fr)_92px_88px_64px] items-center gap-x-3 border-t border-zinc-100 px-5 text-[13px] first-of-type:border-0", c.us && "bg-[#fdf8f3]")}>
                <span className="flex min-w-0 items-center gap-3"><CompanyLogo c={c.company} size={30} /><span className="min-w-0"><span className="block truncate font-medium">{c.company.name}{c.us && <span className="ml-2 rounded-full bg-rust-50 px-1.5 py-px text-[11px] font-medium text-rust">This deal</span>}</span><span className="block truncate text-[12px] text-zinc-500">{c.note}</span></span></span>
                <span className="text-zinc-600">{c.stage}</span>
                <span className="tnum text-right text-zinc-600">{c.raised}</span>
                <span className={cx("tnum text-right font-semibold", c.us && "text-rust")}>{c.multiple}</span>
              </div>
            ))}
          </Card>
        </>
      );
    }
    case "cap": return (
      <>
        {head}
        <Card i={1}>
          <div className="grid grid-cols-4 gap-5 @max-[1040px]/main:grid-cols-2">{s.round.map((x, i) => <div key={x.label} className={cx("min-w-0", i > 0 && "border-l border-zinc-100 pl-5 @max-[1040px]/main:border-0 @max-[1040px]/main:pl-0")}><div className="text-[12px] text-zinc-500">{x.label}</div><div className="tnum mt-1 truncate text-[15px] font-medium">{x.value}</div></div>)}</div>
          {(["pre", "post"] as const).map((k, j) => (
            <div key={k} className={cx("grid grid-cols-[56px_minmax(0,1fr)] items-center gap-3", j === 0 ? "mt-6" : "mt-3")}>
              <span className="text-[12px] text-zinc-500">{k === "pre" ? "Before" : "After"}</span>
              <div className="flex h-7 gap-[3px] overflow-hidden rounded-full">
                {s.rows.filter((r) => r[k] > 0).map((r, i) => <Grow key={r.id} delay={0.15 + j * 0.25 + i * 0.05} w={`${r[k]}%`} className={cx("h-full first:rounded-l-full last:rounded-r-full", capTone(r))} />)}
              </div>
            </div>
          ))}
        </Card>
        <Card title="Holders" right={<span className="text-[12px] text-zinc-500">Fully diluted</span>} i={2} className="p-0 pt-5">
          <div className="px-5"><div className={cx("grid grid-cols-[minmax(0,1.6fr)_80px_80px] items-center gap-x-3", TH)}><span>Holder</span><span className="text-right">Before</span><span className="text-right">After</span></div></div>
          {s.rows.map((r) => (
            <div key={r.id} className={cx("row-hover grid h-[52px] grid-cols-[minmax(0,1.6fr)_80px_80px] items-center gap-x-3 border-t border-zinc-100 px-5 text-[13px] first-of-type:border-0", r.us && "bg-[#fdf8f3]")}>
              <span className="flex min-w-0 items-center gap-2.5"><span className={cx("size-2.5 shrink-0 rounded-[3px]", capTone(r))} /><span className="truncate font-medium">{r.holder}</span>{r.us && <span className="rounded-full bg-rust-50 px-1.5 py-px text-[11px] font-medium text-rust">Us</span>}{r.note && <span className="truncate text-[12px] text-warn">{r.note}</span>}</span>
              <span className="tnum text-right text-zinc-500">{r.pre ? pct(r.pre, 1) : "—"}</span>
              <span className="tnum text-right font-semibold">{pct(r.post, 1)}</span>
            </div>
          ))}
        </Card>
        {s.note && <Rise i={3} className="mt-4 flex items-start gap-2.5 rounded-[16px] bg-warn-50/70 px-4 py-3 text-[13px] text-warn ring-1 ring-[#ecd9b4]"><Sparkles className="mt-0.5 size-3.5 shrink-0" />{s.note}</Rise>}
      </>
    );
    case "valuation": return (
      <>
        {head}
        <StatRow stats={s.stats} />
        <Card title="Football field" right={<span className="text-[12px] text-zinc-500">Pre-money, {s.valuation.currency} {s.valuation.unit}</span>} i={2}>
          <RangeChart v={s.valuation} w={540} />
        </Card>
        {s.note && <Rise i={3} className="mt-4 flex items-start gap-3 rounded-[16px] bg-[#fbf6f0] px-4 py-3.5 text-[13px] leading-relaxed text-zinc-700 ring-1 ring-[#f1e2d2]"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#d27a3e,#9c440f_70%)] text-white"><Sparkles className="size-3" /></span><span><b className="font-medium text-ink">Why the cap. </b>{s.note}</span></Rise>}
      </>
    );
  }
}
