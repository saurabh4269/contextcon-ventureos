"use client";
/**
 * v4 · Landing page (/landing). Orbid's warm orb seen through ribbed glass, a condensed serif headline with one italic
 * accent, a floating white pill nav; Lowker's live assistant card rising out of the glow, question chips left and result
 * chips right, joined by curved lines with a travelling dot. Below: four product fragments built from the app's own parts
 * (fit pill, stage pill, company logos, Crustdata chips, the live step rail language), then one closing band.
 * Every word, chip and number comes from `LandingData`. `still` freezes every loop for screenshots; reduced motion too.
 */
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUp, ArrowUpRight, Check, FileText, Lock, Maximize2, Play, Plus, Sparkles, Video, X } from "lucide-react";
import { Avatar, CompanyLogo, Src, cx } from "../components/ui";
import { FitPill, StagePill } from "../components/dealbits";
import { DeskMark, ToolLogo, TOOL_NAME } from "../components/tools";
import { Pulse, useReducedMotion } from "../components/motion";
import { Skeleton, ErrorState, EmptyState } from "../components/states";
import { fitBand, type AccentLine, type LandingData, type LandingFeature, type LandingQuestion, type LandingRow, type ScreenStatus, type SourceRef } from "../types";

export interface LandingScreenProps extends ScreenStatus {
  data: LandingData;
  /** freeze glow drift, travelling dots, entrance and auto-cycling (screenshots, the film's opening frame) */
  still?: boolean;
  /** which hero question is open (id); defaults to the first */
  question?: string;
  /** open the "Watch the demo" frame */
  demoOpen?: boolean;
  /** show the closing band's "request sent" state with this email */
  requested?: string;
  onRequestAccess?: (email: string) => void | Promise<void>;
}

const ease = [0.22, 1, 0.36, 1] as const;
const CARD = "rounded-[20px] border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(9,9,11,.03),0_12px_32px_-18px_rgba(9,9,11,.10)]";
/** Vertical streak noise: turbulence stretched along y reads as fluted glass. */
const RIBS_NOISE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600'%3E%3Cfilter id='r'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.55 .0035' numOctaves='2' seed='7'/%3E%3CfeColorMatrix values='0 0 0 0 1  0 0 0 0 .97  0 0 0 0 .93  0 0 0 1.2 -.35'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23r)'/%3E%3C/svg%3E\")";
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
const KEYFRAMES = `
@keyframes ld-drift-a{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(5%,4%,0) scale(1.08)}}
@keyframes ld-drift-b{0%,100%{transform:translate3d(0,0,0) scale(1.04)}50%{transform:translate3d(-6%,3%,0) scale(.96)}}
@keyframes ld-breathe{0%,100%{opacity:.88;transform:translate3d(0,0,0) scale(1)}50%{opacity:1;transform:translate3d(-2%,-2%,0) scale(1.06)}}
@media (prefers-reduced-motion: reduce){.ld-move{animation:none!important}}
`;

/** One loop clock for every travelling dot: returns seconds, or null when frozen. */
function useClock(on: boolean) {
  const [t, setT] = useState<number | null>(null);
  useEffect(() => {
    if (!on) { setT(null); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (now: number) => { setT((now - t0) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return t;
}

type P = [number, number];
type Bez = [P, P, P, P];
const at = ([a, b, c, d]: Bez, t: number): P => {
  const u = 1 - t;
  return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]];
};
const dOf = ([a, b, c, d]: Bez) => `M${a[0]},${a[1]} C${b[0]},${b[1]} ${c[0]},${c[1]} ${d[0]},${d[1]}`;
/** S-curve between two points with horizontal tangents. */
const s = (a: P, d: P, k = 0.5): Bez => [a, [a[0] + (d[0] - a[0]) * k, a[1]], [d[0] - (d[0] - a[0]) * k, d[1]], d];

function Accent({ l, className }: { l: AccentLine; className?: string }) {
  return <>{l.before}{l.accent && <em className={cx("pr-[.06em] italic", className)}>{l.accent}</em>}{l.after}</>;
}

/* ───────────── glow: warm orb through ribbed glass ───────────── */
function Glow({ moving, band }: { moving: boolean; band?: boolean }) {
  const a = (name: string, dur: number) => (moving ? { animation: `${name} ${dur}s ease-in-out infinite` } : undefined);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#eccab0_0%,#f3dcc6_40%,#f8eadc_72%,#fcf6ef_100%)]" />
      {/* deep sienna down the left edge, amber down the right */}
      <div className="ld-move absolute -top-[30%] -left-[22%] h-[120%] w-[52%] rounded-full bg-[radial-gradient(closest-side,rgba(160,64,14,.8),rgba(188,88,30,.5)_45%,rgba(214,128,62,0)_100%)] blur-[40px]" style={a("ld-drift-a", 19)} />
      <div className="ld-move absolute -top-[34%] -right-[20%] h-[120%] w-[52%] rounded-full bg-[radial-gradient(closest-side,rgba(194,92,30,.78),rgba(228,146,74,.48)_50%,rgba(240,180,110,0)_100%)] blur-[40px]" style={a("ld-drift-b", 23)} />
      <div className="absolute -top-[36%] left-[10%] h-[62%] w-[80%] rounded-full bg-[radial-gradient(closest-side,rgba(196,98,38,.48),transparent)] blur-[48px]" />
      {/* the bright cream orb */}
      <div className="ld-move absolute top-[6%] left-1/2 aspect-square w-[58%] -translate-x-[42%] rounded-full bg-[radial-gradient(closest-side,#fffdfa_0%,#fff9f1_54%,rgba(255,242,228,.96)_76%,rgba(250,220,192,.5)_90%,rgba(246,210,180,0)_100%)] blur-[2px]" style={a("ld-breathe", 11)} />
      {/* blush low-left, honey low-right */}
      <div className="ld-move absolute top-[48%] -left-[6%] h-[64%] w-[34%] rounded-full bg-[radial-gradient(closest-side,rgba(222,132,100,.4),transparent)] blur-[24px]" style={a("ld-drift-b", 27)} />
      <div className="ld-move absolute top-[44%] -right-[6%] h-[64%] w-[32%] rounded-full bg-[radial-gradient(closest-side,rgba(236,164,84,.4),transparent)] blur-[24px]" style={a("ld-drift-a", 25)} />
      {/* ribbed glass: fine flutes with a lit edge and a shadowed edge, a slower ridge, faint streaks, then grain */}
      <div className="absolute inset-0 opacity-[.3] mix-blend-soft-light" style={{ backgroundImage: "repeating-linear-gradient(90deg,rgba(255,255,255,0) 0,rgba(255,255,255,.6) 1px,rgba(255,255,255,0) 2.5px,rgba(90,30,0,.12) 4px,rgba(255,255,255,0) 5px)" }} />
      <div className="absolute inset-0 opacity-[.1] mix-blend-overlay" style={{ backgroundImage: "repeating-linear-gradient(90deg,rgba(255,255,255,0) 0,rgba(255,255,255,.55) 10px,rgba(255,255,255,0) 20px,rgba(120,40,0,.14) 28px,rgba(255,255,255,0) 32px)" }} />
      <div className="absolute inset-0 opacity-[.07] mix-blend-soft-light" style={{ backgroundImage: RIBS_NOISE, backgroundSize: "600px 100%" }} />
      <div className="absolute inset-0 opacity-[.06] mix-blend-multiply" style={{ backgroundImage: GRAIN }} />
      {/* settle into the page at the bottom */}
      {!band && <div className="absolute inset-x-0 bottom-0 h-[34%] bg-[linear-gradient(180deg,rgba(252,248,243,0),rgba(252,248,243,.92))]" />}
    </div>
  );
}

/* ───────────── nav ───────────── */
function Nav({ d, onAccess }: { d: LandingData; onAccess: () => void }) {
  const pill = "bg-white/90 shadow-[0_1px_2px_rgba(60,20,0,.06),0_8px_24px_-12px_rgba(60,20,0,.18)] ring-1 ring-black/[.04] backdrop-blur-md";
  return (
    <nav className="absolute inset-x-0 top-5 z-20 flex items-center justify-between gap-2 px-6 max-sm:top-3 max-sm:px-3">
      <Link href="/landing" className={cx(pill, "flex h-11 items-center gap-2 rounded-full pr-4 pl-1.5")}><DeskMark size={32} /><span className="serif text-[18px] tracking-[-0.02em]">{d.brand}</span></Link>
      <div className={cx(pill, "absolute left-1/2 flex h-11 -translate-x-1/2 items-center gap-1 rounded-full px-1.5 max-lg:hidden")}>
        {d.nav.map((n) => <a key={n.id} href={n.href} className="rounded-full px-4 py-2 text-[13.5px] font-medium text-zinc-700 transition-colors hover:bg-[#f6ede4] hover:text-ink">{n.label}</a>)}
      </div>
      <div className="flex items-center gap-2">
        <Link href={d.signIn.href} className={cx(pill, "flex h-11 items-center rounded-full px-5 text-[13.5px] font-medium text-zinc-800 hover:text-ink")}>{d.signIn.label}</Link>
        <button type="button" onClick={onAccess} className="flex h-11 items-center gap-2 rounded-full bg-ink pr-4 pl-5 max-sm:hidden text-[13.5px] font-medium text-white shadow-[0_8px_20px_-10px_rgba(9,9,11,.6),inset_0_1px_0_rgba(255,255,255,.12)] transition-colors hover:bg-zinc-800">{d.hero.access}<ArrowUpRight className="size-4 text-[#f0b48a]" /></button>
      </div>
    </nav>
  );
}

/* ───────────── hero assistant card ───────────── */
function Cites({ text, lit, setLit }: { text: string; lit: number | null; setLit: (n: number | null) => void }) {
  return <>{text.split(/(\[\d+\])/g).map((p, i) => {
    const m = /^\[(\d+)\]$/.exec(p);
    if (!m) return <span key={i}>{p}</span>;
    const n = Number(m[1]);
    return <button key={i} type="button" aria-label={`Source ${n}`} onMouseEnter={() => setLit(n)} onMouseLeave={() => setLit(null)} onFocus={() => setLit(n)} onBlur={() => setLit(null)}
      className={cx("tnum relative -top-[0.45em] ml-[2px] inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-[3px] align-baseline text-[9.5px] leading-none font-semibold transition-colors", lit === n ? "bg-rust text-white" : "bg-rust-50 text-rust ring-1 ring-rust-100")}>{n}</button>;
  })}</>;
}

function SourceChip({ s, n, lit }: { s: SourceRef; n: number; lit: boolean }) {
  return (
    <Src k={s.kind} n={n} tone={lit ? "rust" : "default"} className="transition-colors">
      {s.label}{s.provider && <span className="ml-1 inline-flex items-center gap-1 border-l border-current/20 pl-1.5 font-sans font-medium"><ToolLogo id={s.provider} bare size={11} />{TOOL_NAME[s.provider]}</span>}
    </Src>
  );
}

function RowMark({ r, size = 28 }: { r: LandingRow; size?: number }) {
  if (r.company) return <CompanyLogo c={r.company} size={size} />;
  if (r.tool) return <ToolLogo id={r.tool} size={size} />;
  return null;
}
function RowEnd({ r }: { r: LandingRow }) {
  if (r.fit !== undefined) return <FitPill score={r.fit} signals={r.fitSignals} />;
  if (r.pill) return <StagePill tone={r.pill.tone}>{r.pill.label}</StagePill>;
  return null;
}

/** Tweens its height to its content's, so swapping answers of different lengths never jumps. */
function Measured({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null), [h, setH] = useState<number | "auto">("auto");
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setH(el.offsetHeight)); ro.observe(el); return () => ro.disconnect();
  }, []);
  return <motion.div initial={false} animate={{ height: h }} transition={{ duration: 0.35, ease }} className="overflow-hidden"><div ref={ref}>{children}</div></motion.div>;
}

const AssistantCard = memo(function AssistantCard({ d, q, expand, placeholder }: { d: LandingData["assistant"]; q: LandingQuestion; expand: string; placeholder: string }) {
  const [lit, setLit] = useState<number | null>(null);
  return (
    <div className="relative flex flex-col overflow-hidden rounded-[24px] border border-white/70 bg-white/95 shadow-[0_1px_2px_rgba(60,20,0,.05),0_24px_48px_-20px_rgba(120,48,10,.28),0_60px_120px_-40px_rgba(120,48,10,.30)] backdrop-blur-xl">
      <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4 py-3">
        <span className="grid size-8 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#d27a3e,#9c440f_70%)] text-white shadow-[0_6px_14px_-6px_rgba(156,68,15,.7),inset_0_1px_0_rgba(255,255,255,.3)]"><Sparkles className="size-3.5" strokeWidth={1.75} /></span>
        <span className="min-w-0 leading-tight"><span className="block text-[13.5px] font-medium">{d.title}</span><span className="block truncate text-[11.5px] text-zinc-500">{d.sub}</span></span>
        <Link href={expand} aria-label="Open the full assistant" className="ml-auto grid size-8 place-items-center rounded-full text-zinc-500 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 hover:text-ink"><Maximize2 className="size-3.5" /></Link>
      </div>
      <Measured>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={q.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.28, ease }} className="flex flex-col px-4 pt-3.5">
          <div className="ml-auto max-w-[82%] rounded-[16px] rounded-br-[6px] bg-ink px-3.5 py-2 text-[13px] text-white shadow-[0_6px_14px_-8px_rgba(9,9,11,.5)]">{q.label}</div>
          <p className="mt-3 text-[13.5px] leading-[1.55] text-zinc-700"><Cites text={q.answer} lit={lit} setLit={setLit} /></p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">{q.sources.map((src, i) => <SourceChip key={i} s={src} n={i + 1} lit={lit === i + 1} />)}</div>
          <ul className="mt-3 divide-y divide-zinc-100 rounded-[14px] border border-zinc-200/70 bg-white">
            {q.rows.map((r) => (
              <li key={r.id} className="flex h-[46px] items-center gap-2.5 px-3">
                <RowMark r={r} size={26} />
                <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-[13px] font-medium">{r.title}</span><span className="block truncate text-[11.5px] text-zinc-500">{r.sub}</span></span>
                <RowEnd r={r} />
              </li>
            ))}
          </ul>
        </motion.div>
      </AnimatePresence>
      </Measured>
      <form action={expand} method="get" className="flex items-center gap-2 px-4 pt-3 pb-4">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-zinc-50 px-3.5 ring-1 ring-zinc-200/80 focus-within:ring-rust/30"><Plus className="size-4 text-zinc-400" /><input name="q" aria-label={d.title} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-zinc-400" /></label>
        <button type="submit" aria-label="Ask" className="grid size-10 shrink-0 place-items-center rounded-full bg-rust text-white shadow-[0_8px_18px_-8px_rgba(156,68,15,.8),inset_0_1px_0_rgba(255,255,255,.22)] transition-transform hover:scale-[1.04] active:scale-95"><ArrowUp className="size-4" strokeWidth={2.2} /></button>
      </form>
    </div>
  );
});

/* ───────────── hero stage: chips ↔ card, curved lines, travelling dots ───────────── */
const W = 1280, H = 452, CX0 = 390, CX1 = 890;
/** chip centres (left; right mirrors) and where each line meets the card edge */
const SLOTS: { x: number; y: number; ay: number }[] = [{ x: 186, y: 88, ay: 166 }, { x: 214, y: 226, ay: 226 }, { x: 172, y: 364, ay: 290 }];

function Stage({ d, q, setQ, moving, show }: { d: LandingData; q: string; setQ: (id: string, manual: boolean) => void; moving: boolean; show: boolean }) {
  const t = useClock(moving);
  const qs = d.assistant.questions;
  const cur = qs.find((x) => x.id === q) ?? qs[0];
  const geo = qs.map((_, i) => {
    const sl = SLOTS[i % SLOTS.length], fan = (sl.y - H / 2) * 0.9;
    const L: P = [sl.x, sl.y], R: P = [W - sl.x, sl.y];
    return {
      sl,
      inL: s(L, [CX0, sl.ay], 0.55), tailL: s([-340, sl.y + fan], L, 0.5),
      inR: s([CX1, sl.ay], R, 0.45), tailR: s(R, [W + 340, sl.y + fan], 0.5),
    };
  });
  const DUR = 2.6;
  // dots start once the lines have drawn (≈2.1s) and fade in over half a second
  const dotIn = t === null ? 1 : Math.min(1, Math.max(0, (t - 2.1) / 0.5));
  const dot = (b: Bez, i: number, off: number): P => at(b, t === null ? 0.58 : ((t / DUR + i * 0.33 + off) % 1));
  const line = (i: number, delay: number, b: Bez, stroke: string, w = 1.25) => (
    <motion.path d={dOf(b)} fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" initial={show ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 1, delay, ease }} />
  );
  return (
    <div className="relative mx-auto" style={{ width: W, height: H }}>
      <svg aria-hidden width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 overflow-visible">
        <defs>
          <linearGradient id="ld-tl" gradientUnits="userSpaceOnUse" x1={-340} x2={120} y1={0} y2={0}><stop offset="0" stopColor="#9c440f" stopOpacity="0" /><stop offset="1" stopColor="#9c440f" stopOpacity=".26" /></linearGradient>
          <linearGradient id="ld-tr" gradientUnits="userSpaceOnUse" x1={W - 120} x2={W + 340} y1={0} y2={0}><stop offset="0" stopColor="#2f9a5c" stopOpacity=".26" /><stop offset="1" stopColor="#2f9a5c" stopOpacity="0" /></linearGradient>
          <filter id="ld-glow" x="-2" y="-2" width="5" height="5"><feGaussianBlur stdDeviation="3" /></filter>
        </defs>
        {geo.map((g, i) => {
          const on = qs[i].id === cur.id;
          const mL = at(g.inL, 0.5), mR = at(g.inR, 0.5), tl = at(g.tailL, 0.42), tr = at(g.tailR, 0.58);
          return (
            <g key={qs[i].id}>
              {line(i, 0.7 + i * 0.12, g.tailL, "url(#ld-tl)")}
              {line(i, 0.8 + i * 0.12, g.inL, on ? "rgba(156,68,15,.62)" : "rgba(156,68,15,.24)", on ? 1.5 : 1.25)}
              {line(i, 1.0 + i * 0.12, g.inR, on ? "rgba(47,154,92,.6)" : "rgba(47,154,92,.24)", on ? 1.5 : 1.25)}
              {line(i, 1.1 + i * 0.12, g.tailR, "url(#ld-tr)")}
              {[[mL, "#e8c7b0"], [tl, "#efd9c8"], [mR, "#bfe0cb"], [tr, "#d3eadb"]].map(([p, c], k) => <circle key={k} cx={(p as P)[0]} cy={(p as P)[1]} r={4.5} fill="#fff" stroke={c as string} strokeWidth={1.5} />)}
            </g>
          );
        })}
        {/* travelling dots: questions flow into the card, results flow out of it */}
        {(moving || !show) && geo.map((g, i) => {
          const on = qs[i].id === cur.id;
          const a = dot(g.inL, i, 0), b = dot(g.inR, i, 0.5);
          return (
            <g key={`d${i}`} opacity={(on ? 1 : 0.55) * dotIn}>
              <circle cx={a[0]} cy={a[1]} r={on ? 7 : 5} fill="#e07a3a" opacity={0.55} filter="url(#ld-glow)" />
              <circle cx={a[0]} cy={a[1]} r={on ? 3.2 : 2.4} fill="#c2652b" />
              <circle cx={b[0]} cy={b[1]} r={on ? 7 : 5} fill="#4fb57a" opacity={0.5} filter="url(#ld-glow)" />
              <circle cx={b[0]} cy={b[1]} r={on ? 3.2 : 2.4} fill="#2f9a5c" />
            </g>
          );
        })}
      </svg>
      {qs.map((x, i) => {
        const g = geo[i], on = x.id === cur.id;
        return (
          <motion.div key={x.id} className="absolute" style={{ left: g.sl.x, top: g.sl.y, x: "-50%", y: "-50%" }} initial={show ? { opacity: 0, scale: 0.92 } : false} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, delay: 1.1 + i * 0.1, ease }}>
            <button type="button" aria-pressed={on} onClick={() => setQ(x.id, true)} className={cx("flex h-10 items-center gap-2 rounded-full pr-4 pl-1.5 text-[13.5px] whitespace-nowrap backdrop-blur-md transition-all", on ? "bg-white text-ink shadow-[0_10px_24px_-10px_rgba(156,68,15,.45)] ring-1 ring-rust/25" : "bg-white/80 text-zinc-700 shadow-[0_6px_16px_-10px_rgba(60,20,0,.3)] ring-1 ring-black/[.05] hover:bg-white hover:text-ink")}>
              <span className={cx("grid size-7 place-items-center rounded-full text-[12px] font-semibold transition-colors", on ? "bg-rust text-white" : "bg-rust-50 text-rust")}>?</span>{x.label}
            </button>
          </motion.div>
        );
      })}
      {qs.map((x, i) => {
        const g = geo[i], on = x.id === cur.id;
        return (
          <motion.div key={`r${x.id}`} className="absolute" style={{ left: W - g.sl.x, top: g.sl.y, x: "-50%", y: "-50%" }} initial={show ? { opacity: 0, scale: 0.92 } : false} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, delay: 1.4 + i * 0.1, ease }}>
            <button type="button" aria-pressed={on} onClick={() => setQ(x.id, true)} className={cx("flex h-10 items-center gap-2 rounded-full pr-4 pl-1.5 text-[13.5px] font-medium whitespace-nowrap backdrop-blur-md transition-all", on ? "bg-white text-ink shadow-[0_10px_24px_-10px_rgba(47,154,92,.45)] ring-1 ring-[#2f9a5c]/30" : "bg-white/80 text-zinc-700 shadow-[0_6px_16px_-10px_rgba(60,20,0,.3)] ring-1 ring-black/[.05] hover:bg-white hover:text-ink")}>
              <span className={cx("grid size-7 place-items-center rounded-full transition-colors", on ? "bg-[#2f9a5c] text-white" : "bg-[#eaf5ee] text-[#2f9a5c]")}><Check className="size-3.5" strokeWidth={2.6} /></span><span className="tnum">{x.result}</span>
            </button>
          </motion.div>
        );
      })}
      <motion.div className="absolute top-0" style={{ left: CX0, width: CX1 - CX0 }} initial={show ? { opacity: 0, y: 48 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.35, ease }}>
        <AssistantCard d={d.assistant} q={cur} expand={d.assistant.expand} placeholder={d.assistant.placeholder} />
      </motion.div>
    </div>
  );
}

/* ───────────── feature fragments ───────────── */
type Feat<K extends LandingFeature["kind"]> = Extract<LandingFeature, { kind: K }>;
const FRAME = "relative h-[340px] overflow-hidden rounded-[18px] border border-zinc-200/60 bg-[#faf7f3]";

function TriageFragment({ f }: { f: Feat<"triage"> }) {
  return (
    <div className={cx(FRAME, "dot-grid")}>
      <div className="absolute inset-x-6 top-6 overflow-hidden rounded-[16px] border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(9,9,11,.04),0_18px_40px_-22px_rgba(9,9,11,.22)]">
        <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4 py-3">
          <DeskMark size={26} />
          <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-600">{f.head}</span>
          {f.counts.map((c) => <StagePill key={c.label} tone={c.tone}>{c.label}</StagePill>)}
        </div>
        <ul className="divide-y divide-zinc-100">
          {f.rows.map((r, i) => (
            <li key={r.id} className={cx("flex h-[60px] items-center gap-3 px-4", i === f.rows.length - 1 && "opacity-60")}>
              <RowMark r={r} size={30} />
              <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-[13.5px] font-medium">{r.title}</span><span className="block truncate text-[12px] text-zinc-500">{r.sub}</span></span>
              {r.fit !== undefined && <FitPill score={r.fit} />}
              {r.pill && <span className="flex w-[96px] justify-end"><StagePill tone={r.pill.tone}>{r.pill.label}</StagePill></span>}
            </li>
          ))}
        </ul>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,rgba(250,247,243,0),#faf7f3)]" />
    </div>
  );
}

/** Mini signal graph: the company in a glass hub, Crustdata signals around it, lilac dots travelling out (Crustdata purple stays inside this panel). */
const SIG_POS: P[] = [[72, 84], [64, 168], [72, 252], [300, 84], [308, 168], [300, 252]];
function DiligenceFragment({ f, moving }: { f: Feat<"diligence">; moving: boolean }) {
  const t = useClock(moving);
  const hub: P = [186, 168];
  const band = fitBand(f.fit);
  return (
    <div className={cx(FRAME, "flex gap-3 border-0 bg-[#f4efe9] p-3")}>
      <div className="relative w-[372px] shrink-0 overflow-hidden rounded-[14px]" style={{ background: "radial-gradient(40% 46% at 50% 50%, rgba(86,68,237,.2), transparent 70%), radial-gradient(80% 60% at 90% -10%, rgba(255,255,255,.07), transparent 60%), #070708", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)" }}>
        <div className="absolute inset-x-3.5 top-3 flex items-center justify-between text-[10.5px]">
          <span className="font-mono text-[#8c8c8c]">{f.calls}</span>
          <span className="flex items-center gap-1.5 text-[#a3a3a3]">Powered by<ToolLogo id={f.provider} bare size={12} /><b className="font-semibold text-white">{TOOL_NAME[f.provider]}</b></span>
        </div>
        <svg aria-hidden className="absolute inset-0" width="372" height="316" viewBox="0 0 372 316">
          {SIG_POS.map((p, i) => {
            const b = s(hub, p, 0.55), q = at(b, t === null ? 0.62 : (t / 2.2 + i * 0.17) % 1);
            return <g key={i}><path d={dOf(b)} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={1} /><circle cx={q[0]} cy={q[1]} r={5} fill="#5644ED" opacity={0.5} style={{ filter: "blur(3px)" }} /><circle cx={q[0]} cy={q[1]} r={2} fill="#c9c6ff" /></g>;
          })}
        </svg>
        <div className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5" style={{ left: hub[0], top: hub[1], background: "linear-gradient(180deg,#2a2a2c,#18181a)", boxShadow: "inset 0 0 0 1px rgba(134,129,247,.45), 0 0 28px -6px rgba(86,68,237,.7)" }}>
          <CompanyLogo c={f.company} size={26} />
          <span title={f.domain} className="text-[12.5px] font-medium whitespace-nowrap text-white">{f.company.name}</span>
        </div>
        {f.signals.slice(0, SIG_POS.length).map((g, i) => (
          <span key={g.id} title={g.field} className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full px-2 py-1 text-[10.5px] whitespace-nowrap" style={{ left: SIG_POS[i][0], top: SIG_POS[i][1], background: "linear-gradient(180deg,#2c2c2e,#1c1c1e)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14), 0 8px 18px -8px rgba(0,0,0,.8)" }}>
            <span className="text-[#a3a3a3]">{g.label}</span><b className={cx("tnum font-semibold", g.effect === "up" ? "text-[#86e0a6]" : g.effect === "down" ? "text-[#f0a37a]" : "text-[#d4d4d4]")}>{g.value}</b>
          </span>
        ))}
        <div className="absolute inset-x-3.5 bottom-3 flex items-center gap-1.5 font-mono text-[10px] text-[#8c8c8c]"><span className="size-1.5 rounded-full bg-[#86e0a6]" />{f.asOf}</div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col rounded-[14px] bg-white px-3.5 pt-3.5 pb-3 shadow-[0_1px_2px_rgba(9,9,11,.04),0_10px_24px_-16px_rgba(9,9,11,.2)] ring-1 ring-zinc-200/70">
        <div className="flex items-center justify-between"><span className="text-[10.5px] font-medium tracking-[.08em] whitespace-nowrap text-zinc-500 uppercase">Fit score</span><StagePill tone={band === "strong" ? "ok" : band === "maybe" ? "warn" : "rust"}>{f.fitLabel}</StagePill></div>
        <div className="mt-2 flex items-baseline gap-1"><span className="numeral text-[44px] leading-none">{f.fit}</span><span className="text-[12px] text-zinc-400">/ 100</span></div>
        <ul className="mt-2.5 space-y-1.5 border-t border-zinc-100 pt-2.5">
          {f.weights.map((g) => (
            <li key={g.id} className="flex items-start gap-2 text-[11.5px] leading-[1.3] text-zinc-600">
              <span className={cx("mt-[5px] size-1.5 shrink-0 rounded-full", g.weight > 0 ? "bg-[#2f9a5c]" : "bg-rust")} /><span className="line-clamp-2 min-w-0 flex-1">{g.label}</span>
              <span className={cx("tnum inline-flex h-5 min-w-[32px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-medium", g.weight > 0 ? "bg-[#eaf5ee] text-[#1d6b3e]" : "bg-rust-50 text-rust")}>{g.weight > 0 ? "+" : "−"}{Math.abs(g.weight)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-center gap-1.5 rounded-[10px] bg-rust-50 px-2.5 py-1.5 text-[12px] font-medium text-rust ring-1 ring-rust-100"><Sparkles className="size-3.5 shrink-0" />{f.recommendation}</div>
      </div>
    </div>
  );
}

function MeetingsFragment({ f }: { f: Feat<"meetings"> }) {
  const [slot, setSlot] = useState(f.slot), [dur, setDur] = useState(f.duration), [sent, setSent] = useState(false);
  const chip = "inline-flex h-9 items-center rounded-full px-3.5 text-[12.5px] font-medium whitespace-nowrap transition-all";
  return (
    <div className={cx(FRAME, "dot-grid")}>
      <div className="absolute inset-x-6 top-6 flex flex-col rounded-[16px] border border-zinc-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(9,9,11,.04),0_18px_40px_-22px_rgba(9,9,11,.22)]">
        <div className="flex items-center gap-3">
          <CompanyLogo c={f.company} size={32} />
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{f.meeting}</span>
          <FitPill score={f.fit} />
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[12px] text-zinc-500"><Sparkles className="size-3.5 text-rust" />{f.found}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {f.slots.map((x) => <button key={x.id} type="button" aria-pressed={slot === x.id} title={x.sub} onClick={() => { setSlot(x.id); setSent(false); }} className={cx(chip, slot === x.id ? "bg-ink text-white shadow-[0_6px_14px_-8px_rgba(9,9,11,.6)]" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:ring-zinc-300")}>{x.label}</button>)}
          <span className={cx(chip, "text-zinc-500 ring-1 ring-dashed ring-zinc-200")}>{f.other}</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex rounded-full bg-zinc-100 p-0.5">{f.durations.map((n) => <button key={n} type="button" aria-pressed={dur === n} onClick={() => setDur(n)} className={cx("tnum h-7 rounded-full px-2.5 text-[12px] font-medium transition-all", dur === n ? "bg-white text-ink shadow-[0_1px_2px_rgba(9,9,11,.1)]" : "text-zinc-500 hover:text-ink")}>{n}m</button>)}</span>
          <span className="inline-flex h-8 min-w-0 items-center gap-1.5 truncate rounded-full bg-zinc-50 px-2.5 font-mono text-[11px] text-zinc-600 ring-1 ring-zinc-200/70"><ToolLogo id="googlemeet" bare size={13} />{f.meetLink}</span>
          <span className="ml-auto flex -space-x-1.5">{f.people.map((p) => <span key={p.initials} title={`${p.name} · ${p.role}`} className="rounded-full ring-2 ring-white"><Avatar i={p.initials} size={26} tone="sand" /></span>)}</span>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-[12px] bg-[#fbf6f0] px-3 py-2.5 ring-1 ring-[#f1e2d2]">
          <span className="grid size-8 place-items-center rounded-full bg-white text-rust ring-1 ring-[#f1e2d2]"><FileText className="size-3.5" /></span>
          <span className="min-w-0 flex-1 leading-tight"><span className="block text-[12.5px] font-medium">{f.prep.label}</span><span className="block truncate text-[11.5px] text-zinc-500">{f.prep.sub}</span></span>
          <button type="button" onClick={() => setSent(true)} className={cx("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium transition-all", sent ? "bg-ok-50 text-ok ring-1 ring-ok-100" : "bg-ink text-white shadow-[0_6px_14px_-8px_rgba(9,9,11,.6)] hover:bg-zinc-800")}>{sent ? <><Check className="size-3.5" strokeWidth={2.5} />{f.sent}</> : f.send}</button>
        </div>
      </div>
    </div>
  );
}

const STEP_H = 46, STEP_GAP = 14, STEP_IN = 44, STEP_X = 24, STEP_Y = 54;
function AgentFragment({ f, moving }: { f: Feat<"agent">; moving: boolean }) {
  const t = useClock(moving);
  const cur = f.steps.findIndex((x) => x.state === "running");
  const done = f.steps.filter((x) => x.state === "done").length;
  const y = (i: number) => STEP_Y + i * (STEP_H + STEP_GAP), x = (i: number) => STEP_X + i * STEP_IN;
  // elbow from under step i's icon down into step i+1's left edge
  const elbow = (i: number) => { const x0 = x(i) + 24, y0 = y(i) + STEP_H, y1 = y(i + 1) + STEP_H / 2, x1 = x(i + 1); return `M${x0},${y0} V${y1 - 10} Q${x0},${y1} ${x0 + 10},${y1} H${x1}`; };
  const elbowAt = (i: number, u: number): P => {
    const x0 = x(i) + 24, y0 = y(i) + STEP_H, y1 = y(i + 1) + STEP_H / 2, x1 = x(i + 1), v = y1 - y0, h = x1 - x0, k = u * (v + h);
    return k < v ? [x0, y0 + k] : [x0 + (k - v), y1];
  };
  const u = t === null ? 0.7 : (t / 1.6) % 1;
  return (
    <div className={cx(FRAME, "dot-grid glow-sienna")}>
      <div className="absolute inset-x-6 top-5 flex items-center gap-2 text-[12px]">
        <Pulse className="bg-[#c2652b]" /><span className="font-medium text-ink">Live</span><span className="truncate text-zinc-500">{f.run}</span>
        <span className="tnum ml-auto shrink-0 text-zinc-400">{done} of {f.steps.length} · started {f.startedAt}</span>
      </div>
      <svg aria-hidden className="absolute inset-0 h-full w-full overflow-visible">
        {f.steps.slice(0, -1).map((_, i) => <path key={i} d={elbow(i)} fill="none" stroke={i < cur ? "#3f3f46" : "#d4d4d8"} strokeWidth={1.25} strokeDasharray={i < cur ? undefined : "3 4"} />)}
        {cur > 0 && (() => { const p = elbowAt(cur - 1, u); return <g><circle cx={p[0]} cy={p[1]} r={6} fill="rgba(194,101,43,.3)" style={{ filter: "blur(2px)" }} /><circle cx={p[0]} cy={p[1]} r={3} fill="#c2652b" /></g>; })()}
      </svg>
      {f.steps.map((st, i) => {
        const run = st.state === "running";
        return (
          <div key={st.id} className={cx("absolute flex w-[300px] items-center gap-3 rounded-full py-1.5 pr-2 pl-2 transition-all", run ? "bg-white shadow-[0_0_0_4px_rgba(194,101,43,.10),0_14px_28px_-14px_rgba(156,68,15,.45)] ring-1 ring-rust/30" : st.state === "done" ? "bg-white shadow-[0_1px_2px_rgba(9,9,11,.05)] ring-1 ring-zinc-200/80" : "bg-white/70 ring-1 ring-zinc-200/60")} style={{ left: x(i), top: y(i), height: STEP_H }}>
            <span className="grid size-8 shrink-0 place-items-center">
              {st.state === "done" && <span className="grid size-[22px] place-items-center rounded-full bg-ink text-white"><Check className="size-3" strokeWidth={3} /></span>}
              {run && <span className="relative grid size-[22px] place-items-center"><span className="absolute inset-0 rounded-full bg-[rgba(194,101,43,.18)] motion-safe:animate-ping" /><span className="size-[10px] rounded-full bg-[#c2652b] shadow-[0_0_10px_rgba(194,101,43,.6)]" /></span>}
              {st.state === "queued" && <span className="size-[9px] rounded-full border border-zinc-300 bg-white" />}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className={cx("block truncate text-[13px]", run ? "shimmer shimmer-sienna font-medium" : st.state === "done" ? "font-medium text-zinc-800" : "text-zinc-400")}>{st.label}{run ? "…" : ""}</span>
              <span className={cx("block truncate text-[11.5px]", st.state === "queued" ? "text-zinc-400" : "text-zinc-500")}>{st.sub}</span>
            </span>
            {st.tool ? <ToolLogo id={st.tool} size={30} className={cx("rounded-full", st.state === "queued" && "opacity-60")} /> : <span className="grid size-[30px] place-items-center rounded-full bg-rust-50 text-rust ring-1 ring-rust-100"><Sparkles className="size-3.5" /></span>}
          </div>
        );
      })}
      <div className="absolute right-5 bottom-4 flex items-center gap-2 rounded-full bg-white py-1.5 pr-3.5 pl-1.5 text-[12px] shadow-[0_6px_16px_-10px_rgba(9,9,11,.3)] ring-1 ring-zinc-200/80">
        <span className="grid size-6 place-items-center rounded-full bg-ink text-white"><Lock className="size-3" /></span><span className="font-medium">{f.gate.label}</span><span className="text-zinc-500">{f.gate.sub}</span>
      </div>
    </div>
  );
}

function Fragment({ f, moving }: { f: LandingFeature; moving: boolean }) {
  switch (f.kind) {
    case "triage": return <TriageFragment f={f} />;
    case "diligence": return <DiligenceFragment f={f} moving={moving} />;
    case "meetings": return <MeetingsFragment f={f} />;
    case "agent": return <AgentFragment f={f} moving={moving} />;
  }
}
const SPAN: Record<LandingFeature["kind"], string> = { triage: "col-span-5", diligence: "col-span-7", meetings: "col-span-6", agent: "col-span-6" };

function Features({ d, moving, show }: { d: LandingData["features"]; moving: boolean; show: boolean }) {
  return (
    <section className="mx-auto max-w-[1240px] px-6 pt-28">
      <div className="mx-auto max-w-[760px] text-center">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium tracking-[.08em] text-rust uppercase"><Sparkles className="size-3.5" />{d.eyebrow}</span>
        <h2 className="serif mt-4 text-[48px] leading-[1.02] tracking-[-0.03em]"><Accent l={d.title} className="text-rust" /></h2>
        <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-[1.6] text-zinc-500">{d.sub}</p>
      </div>
      <div className="mt-14 grid grid-cols-12 gap-5">
        {d.items.map((f, i) => (
          <motion.article key={f.id} id={f.id} className={cx(CARD, SPAN[f.kind], "scroll-mt-24 p-5")} initial={show ? { opacity: 0, y: 24 } : false} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6, delay: (i % 2) * 0.08, ease }}>
            <Fragment f={f} moving={moving} />
            <div className="mt-5 flex items-end gap-6 px-1 pb-1">
              <div className="min-w-0 flex-1">
                <h3 className="serif text-[24px] leading-tight tracking-[-0.015em]">{f.title}</h3>
                <p className="mt-1.5 max-w-[460px] text-[14px] leading-[1.55] text-zinc-500">{f.body}</p>
              </div>
              <Link href={f.link.href} className="group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium text-zinc-700 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 hover:text-ink">{f.link.label}<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></Link>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

/* ───────────── closing band ───────────── */
function Closing({ d, demo, moving, requested, onDemo, onRequest, inputRef }: { d: LandingData["closing"]; demo: string; moving: boolean; requested?: string; onDemo: () => void; onRequest: (email: string) => void; inputRef: React.RefObject<HTMLInputElement | null> }) {
  const [email, setEmail] = useState("");
  return (
    <section id="access" className="mx-auto max-w-[1240px] scroll-mt-10 px-6 pt-24 max-sm:px-3 max-sm:pt-12">
      <div className="relative overflow-hidden rounded-[28px] px-8 py-20 text-center max-sm:px-4 max-sm:py-14 shadow-[0_1px_2px_rgba(60,20,0,.05),0_30px_60px_-30px_rgba(120,48,10,.35)]">
        <Glow moving={moving} band />
        <div className="relative">
          <h2 className="serif text-[60px] leading-[1] max-sm:text-[44px] tracking-[-0.035em]"><Accent l={d.title} className="text-rust" /></h2>
          <p className="mx-auto mt-4 max-w-[480px] text-[15.5px] leading-[1.6] text-zinc-700">{d.sub}</p>
          {requested ? (
            <div role="status" className="mx-auto mt-8 inline-flex h-12 items-center gap-2.5 rounded-full bg-white/90 pr-5 pl-2 text-[14px] text-zinc-800 shadow-[0_8px_24px_-12px_rgba(60,20,0,.3)] ring-1 ring-black/[.04] backdrop-blur"><span className="grid size-8 place-items-center rounded-full bg-[#2f9a5c] text-white"><Check className="size-4" strokeWidth={2.6} /></span>{d.done.replace("{email}", requested)}</div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); if (email.includes("@")) onRequest(email); else inputRef.current?.focus(); }} className="mx-auto mt-8 flex max-w-[460px] items-center gap-1.5 rounded-full bg-white/90 p-1.5 shadow-[0_8px_24px_-12px_rgba(60,20,0,.3)] ring-1 ring-black/[.04] backdrop-blur">
              <input ref={inputRef} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-label={d.placeholder} placeholder={d.placeholder} className="h-10 min-w-0 flex-1 bg-transparent pl-4 text-[14px] outline-none placeholder:text-zinc-400" />
              <button type="submit" className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-ink px-5 text-[13.5px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12)] transition-colors hover:bg-zinc-800">{d.cta}<ArrowUpRight className="size-4 text-[#f0b48a]" /></button>
            </form>
          )}
          <button type="button" onClick={onDemo} className="mt-5 inline-flex items-center gap-2 text-[13.5px] font-medium text-zinc-700 hover:text-ink"><span className="grid size-7 place-items-center rounded-full bg-white/80 ring-1 ring-black/[.05]"><Play className="size-3 fill-current" /></span>{demo}</button>
        </div>
      </div>
    </section>
  );
}

/* ───────────── demo frame ───────────── */
function DemoFrame({ d, onClose, still }: { d: LandingData["demo"]; onClose: () => void; still?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <motion.div role="dialog" aria-modal aria-label={d.title} className="fixed inset-0 z-50 grid place-items-center bg-[rgba(30,14,4,.38)] p-6 backdrop-blur-md" initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div onClick={(e) => e.stopPropagation()} initial={still ? false : { opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.35, ease }} className="max-w-full overflow-hidden rounded-[22px] bg-white shadow-[0_40px_100px_-30px_rgba(30,10,0,.6)] ring-1 ring-black/10" style={{ width: 1152 }}>
        <div className="flex h-12 items-center gap-3 border-b border-zinc-100 px-4">
          <span className="flex gap-1.5">{["#f2b8a2", "#f3d39b", "#bfe0cb"].map((c) => <span key={c} className="size-2.5 rounded-full" style={{ background: c }} />)}</span>
          <span className="text-[13px] font-medium">{d.title}</span><span className="truncate text-[12.5px] text-zinc-500">{d.caption}</span>
          <Link href={d.src} className="ml-auto inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-medium text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-ink">Open<ArrowUpRight className="size-3.5" /></Link>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-ink"><X className="size-4" /></button>
        </div>
        <div className="relative overflow-hidden bg-canvas" style={{ height: 720 }}>
          <iframe title={d.title} src={d.src} className="absolute top-0 left-0 origin-top-left border-0" style={{ width: 1440, height: 900, transform: "scale(.8)" }} />
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ───────────── page ───────────── */
/** Entrance for the hero copy. Module-level so re-renders (question cycling) never remount it. */
function In({ i, show, children, className }: { i: number; show: boolean; children: ReactNode; className?: string }) {
  return <motion.div className={className} initial={show ? { opacity: 0, y: 18, filter: "blur(6px)" } : false} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.8, delay: 0.08 * i, ease }}>{children}</motion.div>;
}

function HeroCopy({ d, show, onDemo, onAccess }: { d: LandingData; show: boolean; onDemo: () => void; onAccess: () => void }) {
  return (
    <div className="relative z-10 flex flex-col items-center text-center">
      <In show={show} i={0}><span className="inline-flex h-7 items-center gap-2 rounded-full bg-white/60 pr-3 pl-1 text-[12.5px] text-zinc-700 ring-1 ring-black/[.05] backdrop-blur"><span className="grid size-5 place-items-center rounded-full bg-rust text-white"><Sparkles className="size-3" /></span>{d.hero.eyebrow}</span></In>
      <In show={show} i={1}><h1 className="serif mt-5 text-[clamp(68px,5.5vw,108px)] leading-[.94] max-sm:text-[52px] font-[420] tracking-[-0.045em] text-[#1b1008]" style={{ fontVariationSettings: '"opsz" 72' }}>
        {d.hero.headline.map((l, k) => <span key={k} className="block"><Accent l={l} className="bg-[linear-gradient(100deg,#8a3a0c,#c2652b)] bg-clip-text text-transparent" /></span>)}
      </h1></In>
      <In show={show} i={2}><p className="mt-5 max-w-[540px] px-4 text-[17px] leading-[1.55] text-zinc-700 max-sm:text-[15.5px]">{d.hero.sub}</p></In>
      <In show={show} i={3} className="mt-7 flex flex-wrap items-center justify-center gap-2.5 px-4">
        <button type="button" onClick={onDemo} className="flex h-12 items-center gap-2.5 rounded-full bg-ink pr-5 pl-1.5 text-[14px] font-medium text-white shadow-[0_12px_28px_-12px_rgba(9,9,11,.7),inset_0_1px_0_rgba(255,255,255,.12)] transition-transform hover:-translate-y-px"><span className="grid size-9 place-items-center rounded-full bg-white/12 ring-1 ring-white/15"><Play className="size-3.5 fill-[#f0b48a] text-[#f0b48a]" /></span>{d.hero.demo}</button>
        <button type="button" onClick={onAccess} className="flex h-12 items-center rounded-full bg-white/85 px-6 text-[14px] font-medium text-zinc-800 shadow-[0_8px_20px_-12px_rgba(60,20,0,.3)] ring-1 ring-black/[.05] backdrop-blur transition-colors hover:bg-white hover:text-ink">{d.hero.access}</button>
      </In>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="relative z-10 flex flex-col items-center gap-4" aria-busy>
      <Skeleton className="h-7 w-64 rounded-full bg-white/60" />
      <Skeleton className="h-20 w-[620px] rounded-2xl bg-white/50" />
      <Skeleton className="h-20 w-[460px] rounded-2xl bg-white/50" />
      <Skeleton className="mt-2 h-5 w-[480px] rounded-full bg-white/50" />
      <div className="mt-16 h-[420px] w-[480px] rounded-[24px] bg-white/60 ring-1 ring-white/70" />
    </div>
  );
}

export function LandingScreen(p: LandingScreenProps) {
  const { data: d, still = false, status = "ready" } = p;
  const rm = useReducedMotion();
  const moving = !still && !rm;
  const show = moving;
  const [q, setQState] = useState(p.question ?? d.assistant.questions[0]?.id ?? "");
  const [manual, setManual] = useState(!!p.question);
  const [demo, setDemo] = useState(!!p.demoOpen);
  const [requested, setRequested] = useState(p.requested);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setQ = (id: string, byHand: boolean) => { setQState(id); if (byHand) setManual(true); };
  // Walk through the questions until someone picks one.
  useEffect(() => {
    if (!moving || manual) return;
    const qs = d.assistant.questions; if (qs.length < 2) return;
    const h = setInterval(() => setQState((c) => qs[(qs.findIndex((x) => x.id === c) + 1) % qs.length].id), 6500);
    return () => clearInterval(h);
  }, [moving, manual, d.assistant.questions]);
  const toAccess = () => { document.getElementById("access")?.scrollIntoView({ behavior: rm ? "auto" : "smooth", block: "center" }); setTimeout(() => inputRef.current?.focus({ preventScroll: true }), rm ? 0 : 600); };
  const request = async (email: string) => {
    setRequested(email);
    try { await p.onRequestAccess?.(email); } catch { setRequested(undefined); }
  };
  const ready = status === "ready" || status === "empty";
  // Phones and tablets get the app itself; the framed preview only makes sense on a desktop-sized window.
  const openDemo = () => { if (typeof window !== "undefined" && window.innerWidth < 1024) window.location.assign(d.demo.src); else setDemo(true); };
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fcf8f3] pb-10 text-ink">
      <style>{KEYFRAMES}</style>
      <header className="relative m-3 overflow-hidden rounded-[28px] shadow-[0_1px_2px_rgba(60,20,0,.06),0_0_0_1px_rgba(120,50,10,.12)]">
        <Glow moving={moving} />
        <Nav d={d} onAccess={toAccess} />
        <div className="relative flex flex-col items-center pt-[clamp(112px,12.5vh,140px)] pb-10">
          {status === "loading" ? <HeroSkeleton /> : status === "error" ? <div className="relative z-10 w-[min(480px,calc(100vw-48px))] rounded-[20px] bg-white/90 p-2 backdrop-blur"><ErrorState message={p.error} onRetry={p.onRetry} /></div> : <>
            <HeroCopy d={d} show={show} onDemo={openDemo} onAccess={toAccess} />
            {status === "ready" && d.assistant.questions.length > 0 && <div className="relative mt-12"><Stage d={d} q={q} setQ={setQ} moving={moving} show={show} /></div>}
          </>}
        </div>
      </header>
      {ready && (status === "empty" || !d.features.items.length
        ? <div className="mx-auto mt-16 max-w-[560px] px-4 max-sm:mt-8"><EmptyState title="See it on real data" body="There is no recorded product tour. Open the app and research any company live on Crustdata." action={<button type="button" onClick={openDemo} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-medium text-white"><Video className="size-4" />{d.hero.demo}</button>} /></div>
        : <Features d={d.features} moving={moving} show={show} />)}
      {ready && <Closing d={d.closing} demo={d.hero.demo} moving={moving} requested={requested} onDemo={openDemo} onRequest={request} inputRef={inputRef} />}
      <footer className="mx-auto mt-10 flex max-w-[1240px] flex-wrap items-center gap-3 px-8 text-[12.5px] text-zinc-500 max-sm:px-5">
        <DeskMark size={22} /><span className="serif text-[15px] text-ink">{d.brand}</span>
        <span className="ml-auto flex items-center gap-5">{d.nav.map((n) => <a key={n.id} href={n.href} className="hover:text-ink max-md:hidden">{n.label}</a>)}<span className="text-zinc-400">{d.footer}</span></span>
      </footer>
      <AnimatePresence>{demo && <DemoFrame d={d.demo} still={!show} onClose={() => setDemo(false)} />}</AnimatePresence>
    </div>
  );
}
