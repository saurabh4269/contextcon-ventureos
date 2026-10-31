"use client";
import { BridgeChart, Gauge, SparkArea } from "./charts";
import clsx from "clsx";
import {
  FileText, FileSpreadsheet, Globe, Users, CalendarDays, Mail, Landmark, Mic, Presentation, BookOpen, Database,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { BridgePart, ConfidenceLevel, FlagLevel, Headline, SourceRef, SrcKind, StepState, Tone, Valuation } from "../types";
import { fmtMoney, fmtRange } from "../lib/format";

export const cx = clsx;
export type { SrcKind, Tone, StepState };

/* ---------- Source chips: every claim carries one ---------- */
export const srcIcon: Record<SrcKind, typeof FileText> = {
  pdf: FileText, xlsx: FileSpreadsheet, crust: Users, web: Globe, cal: CalendarDays, mail: Mail,
  bank: Landmark, call: Mic, deck: Presentation, memo: BookOpen, db: Database,
};
export function Src({ k = "pdf", children, n, tone = "default", className }: { k?: SrcKind; children: ReactNode; n?: number; tone?: "default" | "rust" | "ok"; className?: string }) {
  const I = srcIcon[k];
  return (
    <span
      className={cx(
        "inline-flex max-w-full min-w-0 items-center gap-1 align-[1px] whitespace-nowrap rounded-[5px] border px-1.5 py-[1px] font-mono text-[10.5px] leading-[15px] tracking-[-0.01em]",
        tone === "default" && "border-zinc-200 bg-zinc-50 text-zinc-600",
        tone === "rust" && "border-rust-100 bg-rust-50 text-rust",
        tone === "ok" && "border-ok-100 bg-ok-50 text-ok",
        className,
      )}
    >
      {n !== undefined && <span className="tnum -ml-0.5 rounded-[3px] bg-white px-[3px] text-[9.5px] font-semibold text-zinc-500 ring-1 ring-zinc-200">{n}</span>}
      <I className="size-[11px] shrink-0 opacity-70" strokeWidth={1.75} />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
/** Convenience: a SourceRef as a chip (or as a SrcPop when it carries an excerpt). */
export function Source({ s, pinned, side, align, w }: { s: SourceRef; pinned?: boolean; side?: "below" | "above"; align?: "start" | "end"; w?: number }) {
  if (s.excerpt) return <SrcPop source={s} pinned={pinned} side={side} align={align} w={w} />;
  return <Src k={s.kind} n={s.n}>{s.label}</Src>;
}

/* ---------- Status pills ---------- */
export function Pill({ tone = "neutral", children, dot = true, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-[1px] text-[11px] font-medium leading-[17px]",
        tone === "ok" && "border-ok-100 bg-ok-50 text-ok",
        tone === "warn" && "border-warn-100 bg-warn-50 text-warn",
        tone === "rust" && "border-rust-100 bg-rust-50 text-rust",
        tone === "neutral" && "border-zinc-200 bg-zinc-50 text-zinc-600",
        tone === "ink" && "border-ink bg-ink text-white",
        className,
      )}
    >
      {dot && (
        <span
          className={cx(
            "size-1.5 rounded-full",
            tone === "ok" && "bg-[#5a8f6c]",
            tone === "warn" && "bg-[#c58a26]",
            tone === "rust" && "bg-rust",
            tone === "neutral" && "bg-zinc-400",
            tone === "ink" && "bg-white",
          )}
        />
      )}
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-zinc-200 bg-white px-1 font-mono text-[10px] text-zinc-500 shadow-[0_1px_0_#e4e4e7]">{children}</kbd>;
}

export function Btn({ children, variant = "ghost", className, icon, onClick, disabled, type = "button" }: { children?: ReactNode; variant?: "primary" | "ghost" | "subtle"; className?: string; icon?: ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[12.5px] font-medium motion-safe:transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        variant === "primary" && "bg-ink text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_1px_2px_rgba(0,0,0,.2)] hover:bg-zinc-800",
        variant === "ghost" && "border border-zinc-200 bg-white text-zinc-800 shadow-[0_1px_1px_rgba(9,9,11,.04)] hover:bg-zinc-50",
        variant === "subtle" && "text-zinc-600 hover:bg-zinc-100",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function Undo({ className, onClick, label = "Undo" }: { className?: string; onClick?: () => void; label?: string }) {
  return <button type="button" onClick={onClick} className={cx("cursor-pointer text-[11.5px] font-medium text-zinc-500 underline decoration-zinc-300 underline-offset-[3px] hover:text-ink", className)}>{label}</button>;
}

export function Avatar({ i, size = 20, tone = "zinc", src, alt = "" }: { i: string; size?: number; tone?: "zinc" | "ink" | "sand"; /** v5 · photo; falls back to the initials if it fails to load. */ src?: string; alt?: string }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img src={src} alt={alt} width={size} height={size} onError={() => setBroken(true)} style={{ width: size, height: size }} className="inline-block shrink-0 rounded-full object-cover ring-2 ring-white" />;
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(8, size * 0.4) }}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-white",
        tone === "zinc" && "bg-zinc-200 text-zinc-700",
        tone === "ink" && "bg-ink text-white",
        tone === "sand" && "bg-[#ece7df] text-[#5b5245]",
      )}
    >
      {i}
    </span>
  );
}

export function Logo({ l, size = 28, dark }: { l: string; size?: number; dark?: boolean }) {
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-[7px] font-semibold",
        dark ? "bg-ink text-white" : "border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 text-zinc-700 shadow-[0_1px_1px_rgba(9,9,11,.05)]",
      )}
    >
      {l}
    </span>
  );
}

/** Headline with the highlighted fragment in rust. */
export function HL({ h, tone = "text-rust" }: { h: Headline; tone?: string }) {
  return <>{h.pre}{h.hl && <span className={tone}>{h.hl}</span>}{h.post}</>;
}

export function SectionTitle({ children, right, sub }: { children: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="serif text-[22px] leading-7 text-ink">{children}</h2>
        {sub && <p className="mt-0.5 text-[12.5px] text-zinc-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/* ---------- Tiny charts ---------- */
/** v3.1: shadcn/Recharts sparkline (props unchanged). */
export function Spark({ d, w = 96, h = 24, color = "#09090b", fill = true, last = true, strokeW = 1.5 }: { d: number[]; w?: number; h?: number; color?: string; fill?: boolean; last?: boolean; strokeW?: number }) {
  return <SparkArea d={d} w={w} h={h} color={color} fill={fill} last={last} strokeW={strokeW} />;
}

export function Meter({ v, w = 72, tone = "ink" }: { v: number; w?: number; tone?: "ink" | "ok" | "warn" | "rust" }) {
  const c = { ink: "#18181b", ok: "#5a8f6c", warn: "#c58a26", rust: "#9c440f" }[tone];
  return (
    <span className="inline-block h-[5px] overflow-hidden rounded-full bg-zinc-100" style={{ width: w }} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <span className="block h-full rounded-full" style={{ width: `${v * 100}%`, background: c }} />
    </span>
  );
}

export function Strength({ n, of = 5 }: { n: number; of?: number }) {
  return (
    <span className="inline-flex items-end gap-[2px]" aria-label={`Relationship strength ${n} of ${of}`}>
      {Array.from({ length: of }).map((_, i) => (
        <span key={i} className={cx("w-[3px] rounded-[1px]", i < n ? "bg-ink" : "bg-zinc-200")} style={{ height: 4 + i * 2 }} />
      ))}
    </span>
  );
}

/** v3: tick-track gauge with gradient stroke. Props unchanged (color maps to tone). */
export function Ring({ v, size = 64, stroke = 6, color = "#09090b", children }: { v: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const tone = color === "#9c440f" || color.includes("rust") ? "rust" : color === "#3d6b4f" || color === "#5a8f6c" ? "ok" : "ink";
  return <Gauge v={v} size={size} stroke={Math.max(3, stroke - 1)} tone={tone} ticks={size >= 56 ? 32 : 0}>{children}</Gauge>;
}

/* ---------- Source pop-up: closed by default, opens on hover / focus / click (granola-03 pattern) ----------
 * - hover or keyboard focus → opens; leaving closes
 * - click → toggles a sticky open state (click again or Esc to close)
 * - `pinned` forces it open (screenshots: pass from `?pin=1`)
 * - side/align choose where the card sits so it never covers neighbouring chips
 */
export function SrcPop({ source, pinned = false, side = "below", align = "start", w = 300, className }: { source: SourceRef; pinned?: boolean; side?: "below" | "above"; align?: "start" | "end"; w?: number; className?: string }) {
  const [hover, setHover] = useState(false);
  const [sticky, setSticky] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const pid = useId();
  const open = pinned || hover || sticky;
  const ex = source.excerpt;
  useEffect(() => {
    if (!sticky) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setSticky(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [sticky]);
  // no excerpt: a plain chip, clickable when the source has somewhere to go (never a dead "#" link)
  if (!ex) return source.href ? <a href={source.href} target={/^https?:/.test(source.href) ? "_blank" : undefined} rel="noreferrer" className="inline-flex max-w-full min-w-0"><Src k={source.kind} n={source.n} className="hover:border-zinc-300">{source.label}</Src></a> : <Src k={source.kind} n={source.n}>{source.label}</Src>;
  const [a, b] = ex.quote.split(ex.highlight);
  return (
    <span
      ref={ref}
      className={cx("relative inline-block max-w-full min-w-0", className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onKeyDown={(e) => { if (e.key === "Escape") { setHover(false); setSticky(false); } }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={pid}
        onClick={() => setSticky((s) => !s)}
        onFocus={() => setHover(true)}
        onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget as Node)) setHover(false); }}
        className="inline-flex max-w-full min-w-0 cursor-pointer rounded-[5px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
      >
        <Src k={source.kind} n={source.n} className={cx(open ? "!border-ink/30 !bg-white !text-ink ring-2 ring-ink/10" : "hover:border-zinc-300")}>{source.label}</Src>
      </button>
      {open && (
        <span
          id={pid}
          role="dialog"
          aria-label={`Source: ${ex.where}`}
          style={{ width: w }}
          className={cx("absolute z-30 block", align === "start" ? "left-0" : "right-0", side === "below" ? "top-full pt-1.5" : "bottom-full pb-1.5")}
        >
          <span className="block rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-[0_12px_32px_-8px_rgba(9,9,11,.22),0_2px_6px_rgba(9,9,11,.06)]">
            <span className="flex items-center gap-1.5 text-[10.5px] text-zinc-500"><span className="font-mono">{ex.where}</span><span className="ml-auto text-zinc-400">Exact text</span></span>
            <span className="mt-1.5 block border-l-2 border-zinc-200 pl-2.5 text-[12px] leading-[18px] font-normal text-zinc-700">“{a}<mark className="rounded-[3px] bg-[#fdf0c4] px-0.5 text-ink">{ex.highlight}</mark>{b}”</span>
            {(ex.href ?? source.href) && <span className="mt-2 flex items-center justify-between text-[11px]"><a href={ex.href ?? source.href} className="font-medium text-ink hover:underline">Open page ↗</a><span className="text-zinc-400"><Kbd>⌘</Kbd> click</span></span>}
          </span>
        </span>
      )}
    </span>
  );
}

export function Confidence({ level }: { level: ConfidenceLevel }) {
  const t = level === "High" ? "ok" : level === "Medium" ? "warn" : "rust";
  return <Pill tone={t}>{level} confidence</Pill>;
}

// ARR gap as a waterfall: start bar, red step-downs, end bar. Axis is cut at `floor` so the parts are visible.
/** v3: delegates to the chart-kit BridgeChart (axis, gridlines, hatched reductions, delta bracket). Props unchanged. */
export function Waterfall(p: { parts: BridgePart[]; h?: number; floor?: number; top?: number; unit?: string; barW?: number; delta?: boolean }) {
  return <BridgeChart {...p} />;
}

// Severity strip: one square per flag, colour says how bad.
export function Severity({ levels, size = 14 }: { levels: FlagLevel[]; size?: number }) {
  return (
    <span className="inline-flex gap-[3px]" aria-label={`${levels.length} red flags`}>
      {levels.map((l, i) => <span key={i} style={{ width: size, height: size }} className={cx("rounded-[3px]", l === "high" && "bg-rust", l === "mid" && "bg-[#d9a54a]", l === "low" && "bg-zinc-300")} />)}
    </span>
  );
}

export function Toggle({ on = true, onChange, label }: { on?: boolean; onChange?: (next: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange?.(!on)} className={cx("inline-flex h-[18px] w-[30px] shrink-0 cursor-pointer items-center rounded-full p-[2px] motion-safe:transition-colors", on ? "bg-ink" : "bg-zinc-200")}>
      <span className={cx("size-[14px] rounded-full bg-white shadow-sm motion-safe:transition-transform", on && "translate-x-[12px]")} />
    </button>
  );
}

export function StepDot({ s, size = 18 }: { s: StepState; size?: number }) {
  if (s === "done") return <span style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-ink text-white"><svg viewBox="0 0 12 12" className="size-[60%]" aria-hidden><path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>;
  if (s === "running") return <span style={{ width: size, height: size }} className="relative flex shrink-0 items-center justify-center"><svg viewBox="0 0 20 20" className="absolute inset-0 motion-safe:animate-spin [animation-duration:2.4s]" aria-hidden><circle cx="10" cy="10" r="8" fill="none" stroke="#e4e4e7" strokeWidth="2.2" /><path d="M10 2a8 8 0 0 1 8 8" fill="none" stroke="#5a8f6c" strokeWidth="2.2" strokeLinecap="round" /></svg></span>;
  if (s === "warn") return <span style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-[#d9a54a] text-[10px] font-bold text-white">!</span>;
  return <span style={{ width: size, height: size }} className="shrink-0 rounded-full border-[1.5px] border-dashed border-zinc-300" />;
}

// Before → after for any change.
export function Delta({ a, b, tone = "rust" }: { a: string; b: string; tone?: "rust" | "ok" | "neutral" }) {
  return <span className="tnum inline-flex items-center gap-1 whitespace-nowrap text-[12px]"><span className="text-zinc-400 line-through decoration-zinc-300">{a}</span><span className="text-zinc-300">→</span><span className={cx("font-semibold", tone === "rust" ? "text-rust" : tone === "ok" ? "text-ok" : "text-ink")}>{b}</span></span>;
}

/* Valuation label used everywhere: "Our range $117–149M · cap $133M". Hover/focus explains the cap. */
export function CapRange({ v, className, open = false, short = false }: { v: Valuation; className?: string; open?: boolean; short?: boolean }) {
  const capped = Number.isFinite(v.cap); // live data may have no cap (NaN): "cap —", the tooltip gives the reason
  return (
    <span className={cx("group relative inline-flex cursor-help items-baseline gap-1 whitespace-nowrap", className)} tabIndex={0}>
      <span>{short ? "" : "Our range "}{fmtRange(v)}</span><span className="text-zinc-400">·</span><span className="border-b border-dotted border-zinc-400">cap {capped ? fmtMoney(v.cap, v.unit) : "—"}</span>
      <span role="tooltip" className={cx("pointer-events-none absolute top-full left-0 z-30 mt-2 w-[290px] whitespace-normal rounded-xl border border-zinc-200 bg-white p-3 text-left text-[12px] leading-snug font-normal text-zinc-700 shadow-[0_12px_32px_-12px_rgba(9,9,11,.3)]", open ? "block" : "hidden group-hover:block group-focus:block")}>
        <span className="block font-medium text-ink">{capped ? `Why cap at ${fmtMoney(v.cap, v.unit)}?` : "No cap"}</span>
        <span className="mt-1 block">{v.capRationale}</span>
        <span className="mt-2 flex items-center gap-1.5 whitespace-nowrap text-[11px] text-zinc-500"><span className="rounded border border-zinc-200 px-1 font-mono">{v.source.label}</span>{v.ask !== undefined && <span className="ml-auto text-rust">Ask {fmtMoney(v.ask, v.unit)}</span>}</span>
      </span>
    </span>
  );
}

/* ---------- v3.2 declutter kit: one icon per action, details on click ---------- */
/** Square icon button with a hover tooltip. */
export function IconBtn({ icon, label, onClick, active, className, tone = "ghost", size = "md", href, ...rest }: { icon: ReactNode; label: string; onClick?: () => void; active?: boolean; className?: string; tone?: "ghost" | "primary" | "bare"; size?: "sm" | "md"; href?: string; "aria-expanded"?: boolean; "aria-haspopup"?: "menu" | "dialog" }) {
  const cls = cx("inline-flex items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink", size === "sm" ? "size-7 [&_svg]:size-[14px]" : "size-8 [&_svg]:size-[15px]",
    tone === "primary" ? "bg-ink text-white hover:bg-zinc-800" : active ? "bg-zinc-100 text-ink ring-1 ring-zinc-200" : tone === "bare" ? "text-zinc-400 hover:bg-zinc-100 hover:text-ink" : "text-zinc-500 ring-1 ring-zinc-200/80 hover:bg-zinc-50 hover:text-ink", className);
  return (
    <span className="group/ib relative inline-flex">
      {href ? <a href={href} aria-label={label} onClick={onClick} className={cls}>{icon}</a> : <button type="button" aria-label={label} onClick={onClick} {...rest} className={cls}>{icon}</button>}
      {!active && <span role="tooltip" className="pointer-events-none absolute top-full left-1/2 z-40 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity delay-150 group-hover/ib:opacity-100">{label}</span>}
    </span>
  );
}
export interface MenuItem { id: string; label: ReactNode; hint?: ReactNode; icon?: ReactNode; onSelect?: () => void }
/** Icon that opens a popover: a menu of items and/or free content (details, sources, formats). */
export function IconMenu({ icon, label, items, children, title, align = "end", w = 260, tone, defaultOpen = false }: { icon: ReactNode; label: string; items?: MenuItem[]; children?: ReactNode; title?: ReactNode; align?: "start" | "end"; w?: number; tone?: "ghost" | "primary" | "bare"; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex">
      <IconBtn icon={icon} label={label} active={open} tone={tone} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup={items ? "menu" : "dialog"} />
      {open && (
        <span role={items ? "menu" : "dialog"} aria-label={label} style={{ width: w }} className={cx("absolute top-full z-40 mt-1.5 block rounded-xl border border-zinc-200 bg-white p-1.5 text-left shadow-[0_12px_32px_-8px_rgba(9,9,11,.22),0_2px_6px_rgba(9,9,11,.06)]", align === "end" ? "right-0" : "left-0")}>
          {title && <span className="block px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-zinc-500">{title}</span>}
          {children && <span className="block px-2.5 py-1.5">{children}</span>}
          {items?.map((it) => (
            <button key={it.id} type="button" role="menuitem" onClick={() => { it.onSelect?.(); setOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-zinc-50 [&_svg]:size-3.5 [&_svg]:text-zinc-400">
              {it.icon}<span className="flex-1">{it.label}</span>{it.hint && <span className="text-[11px] text-zinc-400">{it.hint}</span>}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
/** Label/value rows for a details popover. */
export function DetailRows({ rows }: { rows: { k: ReactNode; v: ReactNode }[] }) {
  return <span className="block space-y-2 text-[12px]">{rows.map((r, i) => <span key={i} className="flex items-start justify-between gap-4"><span className="shrink-0 text-zinc-500">{r.k}</span><span className="text-right">{r.v}</span></span>)}</span>;
}

/** v3.2 · hashed monogram palette: calm, distinct, no purple. */
const MONO = [["#e0f2fe", "#075985"], ["#dcfce7", "#166534"], ["#fef3c7", "#92400e"], ["#ffe4e6", "#9f1239"], ["#e2e8f0", "#1e293b"], ["#ccfbf1", "#115e59"], ["#ffedd5", "#9a3412"], ["#f5f5f4", "#44403c"]];
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
const initialsOf = (name: string) => name.replace(/^Project\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/** v3.2 · A company's mark: `logoUrl` if the record has one, else a monogram tile coloured from a hash of the domain (or name). */
export function CompanyLogo({ c, size = 28, className }: { c: { name: string; initial?: string; dark?: boolean; logoUrl?: string; domain?: string }; size?: number; className?: string }) {
  const r = Math.round(size * 0.26);
  if (c.logoUrl) return <img src={c.logoUrl} alt="" aria-hidden width={size} height={size} style={{ width: size, height: size, borderRadius: r }} className={cx("inline-block shrink-0 shadow-[0_1px_1px_rgba(9,9,11,.06)]", className)} />;
  const [bg, fg] = MONO[hash((c.domain ?? c.name).toLowerCase()) % MONO.length];
  const t = initialsOf(c.name) || c.initial || "?";
  return <span aria-hidden style={{ width: size, height: size, borderRadius: r, background: bg, color: fg, fontSize: size * (t.length > 1 ? 0.36 : 0.44) }} className={cx("inline-flex shrink-0 items-center justify-center font-semibold tracking-tight", className)}>{t}</span>;
}

/** v4 · Today's card chrome (house style): 20px radius, hairline border, soft layered shadow. */
export const CARD = "rounded-[20px] border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(9,9,11,.03),0_12px_32px_-18px_rgba(9,9,11,.10)]";
