"use client";
/**
 * v3.3 · The assistant, docked (⌘K/⌘J on every page) and full page (/ask). One component set, two surfaces.
 * States: empty (orb, greeting, context chip, page-aware suggestions) → thinking (orb spins faster, shimmer steps)
 * → answer (right-aligned question bubble, inline [n] markers that light up their source pill, optional inline
 * visual) → follow-ups. One composer: attach, scope chip, mic, send. All copy and numbers come from AssistantData.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Square, Plus, Sparkles, X, SquarePen, Check, ChevronRight, ChevronDown, CornerDownRight, Maximize2, Mic, TrendingUp, Inbox, Mail, Hourglass, FileText, Users, Scale, Search, Workflow, History, CircleSlash, CalendarClock, MessageSquare } from "lucide-react";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import { ROUTES } from "../routes";
import { IconBtn, cx, CompanyLogo, srcIcon } from "./ui";
import { useAsk } from "./askctx";
import { ToolLogo, TOOL_NAME } from "./tools";
import type { AssistantData, AssistantIcon, AssistantMsg, AssistantThread, AssistantVisual, GrowthComparison, SourceRef } from "../types";

type Surface = "dock" | "page";
/** Sienna focus ring for every interactive element in the assistant (keyboard only). */
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-rust/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

/**
 * Stream timing for the newest answer: words reveal over ~0.8s, then the visual, then source chips, then Ask-next.
 * Pure function of the message so every part can schedule itself without shared state.
 */
const STREAM = { start: 0.12, text: 0.8, gap: 0.12, visual: 0.35, chip: 0.06 };
function streamPlan(m?: AssistantMsg) {
  const words = m ? m.text.replace(/\[\d+\]/g, "").split(/\s+/).filter(Boolean).length : 0;
  const step = words ? Math.min(0.045, STREAM.text / words) : 0;
  const textEnd = STREAM.start + words * step;
  const visualAt = textEnd + STREAM.gap;
  const chipsAt = visualAt + (m?.visual ? STREAM.visual : 0);
  const end = chipsAt + (m?.sources?.length ?? 0) * STREAM.chip + STREAM.gap;
  return { step, visualAt, chipsAt, end };
}
type Plan = ReturnType<typeof streamPlan>;
const ease: Transition["ease"] = [0.22, 1, 0.36, 1];

const ICON: Record<AssistantIcon, typeof Inbox> = {
  growth: TrendingUp, inbox: Inbox, mail: Mail, runway: Hourglass, memo: FileText, people: Users, valuation: Scale,
  search: Search, agent: Workflow, history: History, pass: CircleSlash, calendar: CalendarClock,
};
const Glyph = ({ k, className }: { k?: AssistantIcon; className?: string }) => { const I = k ? ICON[k] : Sparkles; return <I className={className} strokeWidth={1.75} />; };

/** The Deal Desk orb (CSS only, see .dd-orb in globals.css). `thinking` turns it faster. */
export function Orb({ size = 56, thinking }: { size?: number; thinking?: boolean }) {
  return (
    <span className="dd-orb" style={{ ["--orb" as string]: `${size}px` }} data-state={thinking ? "thinking" : undefined} aria-hidden>
      <i className="o-halo" />
      <i className="o-body"><i className="o-swirl" /><i className="o-swirl2" /><i className="o-fold" /><i className="o-core" /></i>
      <i className="o-rim" /><i className="o-spec" /><i className="o-glint" />
    </span>
  );
}

/* ───────────── citations ───────────── */
/** Provider tag (e.g. Crustdata) for live-signal sources: tiny mark + name. */
function ProviderTag({ s, tone = "light" }: { s: SourceRef; tone?: "light" | "dark" }) {
  if (!s.provider) return null;
  return <span className={cx("inline-flex shrink-0 items-center gap-1 border-l pl-1.5", tone === "dark" ? "border-white/20 text-zinc-300" : "border-zinc-200 text-zinc-500")}><ToolLogo id={s.provider} bare size={11} />{TOOL_NAME[s.provider]}</span>;
}
/** Hover card above a footnote marker: what the source is, and who it came from. */
function CiteTip({ s, x }: { s: SourceRef; /** left offset (px) clamped inside the thread; centred until measured */ x?: number }) {
  const I = srcIcon[s.kind];
  return (
    <span role="tooltip" style={x === undefined ? undefined : { left: x }} className={cx("pointer-events-none absolute bottom-[calc(100%+6px)] z-30 flex translate-y-0.5 items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] leading-none font-medium whitespace-nowrap text-white opacity-0 shadow-[0_8px_20px_-8px_rgba(9,9,11,.5)] transition-[opacity,translate] duration-150 group-focus-within/cite:translate-y-0 group-focus-within/cite:opacity-100 group-hover/cite:translate-y-0 group-hover/cite:opacity-100", x === undefined && "left-1/2 -translate-x-1/2")}>
      <I className="size-3 text-zinc-400" strokeWidth={1.75} />{s.label}<ProviderTag s={s} tone="dark" />{s.asOf && <span className="text-zinc-400">{s.asOf}</span>}
    </span>
  );
}
type CiteState = { on: number | null; set: (n: number | null) => void; hover: number | null; setHover: (n: number | null) => void };

/**
 * Text with inline [n] markers, set like footnotes: a 14px chip raised to cap height, hugging the word before it and
 * kept on one line with the punctuation after it. Clicking (or hovering) a marker lights up its source pill.
 */
function Cited({ text, sources, c, plan }: { text: string; sources?: SourceRef[]; c: CiteState; /** stream the words in */ plan?: Plan }) {
  const parts = text.split(/(\[\d+\])/g), out: ReactNode[] = [];
  const [tipX, setTipX] = useState<Record<number, number>>({});
  const isMark = (p?: string) => !!p && /^\[\d+\]$/.test(p);
  let k = 0; // word index, for the stream delay
  const word = (w: string, key: string) => plan
    ? <motion.span key={key} className="inline-block" initial={{ opacity: 0, y: 3, filter: "blur(3px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: STREAM.start + k++ * plan.step, duration: 0.28, ease }}>{w}</motion.span>
    : <span key={key}>{w}</span>;
  // Keep the hover card inside the thread: centre on the marker, then clamp to the scroll box.
  const place = (el: HTMLElement, n: number) => {
    const wrap = el.parentElement, tip = wrap?.querySelector<HTMLElement>("[role=tooltip]");
    if (!wrap || !tip) return;
    const box = (wrap.closest("[data-thread]") ?? document.documentElement).getBoundingClientRect(), b = el.getBoundingClientRect(), w = tip.offsetWidth;
    const left = Math.max(box.left + 8, Math.min(b.left + b.width / 2 - w / 2, box.right - 8 - w));
    setTipX((x) => ({ ...x, [n]: Math.round(left - wrap.getBoundingClientRect().left) }));
  };
  for (let i = 0; i < parts.length; i++) {
    let p = parts[i];
    if (!isMark(p)) {
      if (isMark(parts[i + 1])) p = p.trimEnd();
      if (isMark(parts[i - 1])) p = p.replace(/^[.,;:!?)’”]+/, ""); // punctuation already rendered with its marker
      if (!p) continue;
      if (!plan) { out.push(<span key={i}>{p}</span>); continue; }
      p.split(/(\s+)/).forEach((t, j) => out.push(/^\s+$/.test(t) || !t ? t : word(t, `${i}-${j}`)));
      continue;
    }
    const n = Number(p.slice(1, -1)), s = sources?.[n - 1], lit = c.on === n || c.hover === n;
    const punct = /^[.,;:!?)’”]+/.exec(parts[i + 1] ?? "")?.[0] ?? "";
    const delay = plan ? STREAM.start + Math.max(0, k - 1) * plan.step + 0.05 : 0;
    const inner = <>
      {s && <CiteTip s={s} x={tipX[n]} />}
      <button type="button" aria-label={s ? `Source ${n}: ${s.label}${s.provider ? ` · ${TOOL_NAME[s.provider]}` : ""}` : `Source ${n}`} aria-pressed={c.on === n}
        onClick={() => c.set(c.on === n ? null : n)} onMouseEnter={(e) => { place(e.currentTarget, n); c.setHover(n); }} onMouseLeave={() => c.setHover(null)} onFocus={(e) => place(e.currentTarget, n)}
        className={cx("tnum relative -top-[0.5em] ml-[2px] inline-flex h-[14px] min-w-[14px] cursor-pointer items-center justify-center rounded-full px-[3px] align-baseline text-[9.5px] leading-none font-semibold transition-colors", FOCUS, "focus-visible:ring-offset-1",
          lit ? "bg-rust text-white" : "bg-[#f3ede6] text-[#8a4a1c] ring-1 ring-[#e7d8c8] hover:bg-rust hover:text-white hover:ring-rust")}>{n}</button>{punct}
    </>;
    out.push(plan
      ? <motion.span key={i} className="group/cite relative whitespace-nowrap" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay, duration: 0.25, ease }}>{inner}</motion.span>
      : <span key={i} className="group/cite relative whitespace-nowrap">{inner}</span>);
  }
  return <>{out}</>;
}

/** A source as a pill: number, file-type icon, label. Lit when its marker is clicked or hovered. */
function SourcePill({ s, n, c, compact }: { s: SourceRef; n: number; c: CiteState; compact?: boolean }) {
  const I = srcIcon[s.kind], lit = c.on === n || c.hover === n;
  const cls = cx("group inline-flex min-w-0 items-center rounded-full border transition-all duration-150", FOCUS,
    compact ? cx("h-6 gap-1 pr-2 pl-[3px] text-[11px]", s.provider ? "max-w-full" : "max-w-[184px]") : "h-7 max-w-full gap-1.5 pr-2.5 pl-1 text-[11.5px]",
    lit ? "dd-cite-on border-rust/30 bg-rust-50 text-rust" : "border-zinc-200/90 bg-white text-zinc-600 shadow-[0_1px_2px_rgba(9,9,11,.04)] hover:-translate-y-px hover:border-zinc-300 hover:text-ink hover:shadow-[0_4px_12px_-6px_rgba(9,9,11,.2)]");
  const body = <>
    <span className={cx("tnum grid shrink-0 place-items-center rounded-full font-semibold transition-colors", compact ? "size-[18px] text-[9.5px]" : "size-5 text-[10px]", lit ? "bg-rust text-white" : "bg-zinc-100 text-zinc-500")}>{n}</span>
    <I className={cx(compact ? "size-3 shrink-0" : "size-3.5 shrink-0", lit ? "text-rust" : "text-zinc-400 group-hover:text-zinc-600")} strokeWidth={1.75} />
    <span className="min-w-0 truncate">{s.label}</span>
    <ProviderTag s={s} />
  </>;
  const ev = { onMouseEnter: () => c.setHover(n), onMouseLeave: () => c.setHover(null), title: [s.label, s.provider && TOOL_NAME[s.provider], s.asOf].filter(Boolean).join(" · ") };
  return s.href ? <a key={lit ? "on" : "off"} href={s.href} className={cls} {...ev}>{body}</a>
    : <button key={lit ? "on" : "off"} type="button" onClick={() => c.set(c.on === n ? null : n)} className={cls} {...ev}>{body}</button>;
}

/* ───────────── inline growth chart ───────────── */
/** Measured width so the chart draws at real pixels: text stays 11px at any width. Starts at `initial` so SSR and hydration agree. */
function useWidth(initial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
/** Two decimals, as a string: identical on server and client (raw Math.pow output can differ in the last bit). */
const r2 = (v: number) => (Math.round(v * 100) / 100).toString();

/** Deck-vs-verified growth, drawn by hand at the container's pixel width. */
export function MiniGrowth({ g, h = 148, initialW = 300 }: { g: GrowthComparison; h?: number; initialW?: number }) {
  const [ref, w] = useWidth(initialW);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const n = g.verified.length, base = g.verified[0];
  const claimed = g.verified.map((_, i) => base * Math.pow(1 + g.claimedRate, i));
  const max = Math.ceil(Math.max(...claimed) / 20) * 20, L = 40, R = 66, T = 10, B = 24;
  const x = (i: number) => L + (i * (w - L - R)) / (n - 1), y = (v: number) => T + (1 - v / max) * (h - T - B);
  const line = (vs: number[]) => vs.map((v, i) => `${i ? "L" : "M"}${r2(x(i))},${r2(y(v))}`).join(" ");
  const gap = `${line(claimed)} ${[...g.verified].reverse().map((v, j) => `L${r2(x(n - 1 - j))},${r2(y(v))}`).join(" ")} Z`;
  const money = (v: number) => `$${Math.round(v)}${g.unit}`, d = claimed[n - 1] - g.verified[n - 1];
  const xe = x(n - 1), yc = y(claimed[n - 1]), yv = y(g.verified[n - 1]), pct = (r: number) => `${Math.round(r * 100)}%/mo`;
  const pill = `−${money(d)}`, pw = 10 + pill.length * 6.4;
  return (
    <div ref={ref} className="w-full">
      <svg width={w} height={h} role="img" aria-label={`${g.metric}: verified ${pct(g.verifiedRate)} vs deck ${pct(g.claimedRate)}`} className="block overflow-visible font-sans [font-feature-settings:'tnum']">
        <defs>
          <pattern id={`h${uid}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="rgba(156,68,15,.05)" /><line x1="0" y1="0" x2="0" y2="5" stroke="rgba(156,68,15,.38)" strokeWidth="1" /></pattern>
          <linearGradient id={`a${uid}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#09090b" stopOpacity=".12" /><stop offset="1" stopColor="#09090b" stopOpacity="0" /></linearGradient>
        </defs>
        {[0, max / 2, max].map((t) => <g key={t}><line x1={L} x2={r2(w - R + 8)} y1={r2(y(t))} y2={r2(y(t))} stroke={t ? "#f1f1f2" : "#e4e4e7"} strokeDasharray={t ? "3 3" : undefined} /><text x={L - 8} y={r2(y(t) + 3.5)} fontSize="11" fill="#a1a1aa" textAnchor="end">{t ? money(t) : "0"}</text></g>)}
        <path d={gap} fill={`url(#h${uid})`} />
        <path d={`${line(g.verified)} L${r2(xe)},${r2(y(0))} L${r2(x(0))},${r2(y(0))} Z`} fill={`url(#a${uid})`} />
        <path d={line(claimed)} fill="none" stroke="#9c440f" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />
        <path d={line(g.verified)} fill="none" stroke="#09090b" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={r2(xe)} cy={r2(yc)} r="3.5" fill="#fff" stroke="#9c440f" strokeWidth="1.5" />
        <circle cx={r2(xe)} cy={r2(yv)} r="4" fill="#09090b" stroke="#fff" strokeWidth="1.5" />
        <text x={r2(xe + 9)} y={r2(yc + 4)} fontSize="11" fill="#9c440f" fontWeight="600">{pct(g.claimedRate)}</text>
        <text x={r2(xe + 9)} y={r2(yv + 4)} fontSize="11" fill="#09090b" fontWeight="600">{pct(g.verifiedRate)}</text>
        <g transform={`translate(${r2(xe + 8)},${r2((yc + yv) / 2)})`}><rect x="0" y="-9" width={r2(pw)} height="18" rx="9" fill="#9c440f" /><text x={r2(pw / 2)} y="3.8" fontSize="11" fill="#fff" fontWeight="600" textAnchor="middle">{pill}</text></g>
        {g.months.map((m, i) => <text key={m} x={r2(x(i))} y={h - 5} fontSize="11" fill={i === n - 1 ? "#09090b" : "#a1a1aa"} fontWeight={i === n - 1 ? 600 : 400} textAnchor="middle">{m}</text>)}
      </svg>
    </div>
  );
}

const VCARD = "mt-3.5 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(9,9,11,.03),0_10px_28px_-20px_rgba(9,9,11,.18)]";
function Visual({ v, surface }: { v: AssistantVisual; surface: Surface }) {
  if (v.kind === "growth") {
    const g = v.growth;
    return (
      <div className={cx(VCARD, "px-4 pt-3 pb-2.5")}>
        <div className="mb-2 flex items-center gap-3 text-[12px] whitespace-nowrap">
          <span className="min-w-0 truncate font-medium text-ink">{g.metric}{surface === "page" && " · deck vs verified"}</span>
          <span className="ml-auto flex items-center gap-3 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5"><span className="h-0 w-3.5 border-t-[1.5px] border-dashed border-rust" />Deck</span>
            <span className="flex items-center gap-1.5"><span className="h-[2px] w-3.5 rounded bg-ink" />Verified</span>
            <span className="text-zinc-400">{g.months[0]}–{g.months[g.months.length - 1]}</span>
          </span>
        </div>
        <MiniGrowth g={g} h={surface === "page" ? 188 : 148} initialW={surface === "page" ? 640 : 290} />
      </div>
    );
  }
  if (v.kind === "companies") return (
    <div className={VCARD}>
      <div className="flex h-9 items-center px-3.5 text-[12px] font-medium text-zinc-500">{v.title}</div>
      {v.rows.map((r) => (
        <Link key={r.id} href={r.href ?? "#"} className="group grid h-12 grid-cols-[26px_minmax(0,1fr)_auto_12px] items-center gap-3 border-t border-zinc-100 px-3.5 transition-colors hover:bg-zinc-50/80">
          <CompanyLogo c={r} size={26} />
          <span className="min-w-0"><span className="block truncate text-[13px] font-medium text-ink">{r.name}</span><span className="block truncate text-[11.5px] text-zinc-500">{r.note}</span></span>
          <span className={cx("tnum text-right text-[13px] font-semibold", r.tone === "rust" ? "text-rust" : r.tone === "warn" ? "text-warn" : "text-ink")}>{r.value}</span>
          <ChevronRight className="size-3.5 text-zinc-300 transition-colors group-hover:text-ink" />
        </Link>
      ))}
    </div>
  );
  return (
    <Link href={v.href ?? "#"} className={cx(VCARD, "group block p-3.5 transition-colors hover:border-zinc-300")}>
      <div className="flex items-center gap-3"><CompanyLogo c={v} size={30} /><span className="min-w-0"><span className="block truncate text-[13px] font-medium">{v.name}</span><span className="block truncate text-[11.5px] text-zinc-500">{v.stage}</span></span><ChevronRight className="ml-auto size-3.5 text-zinc-300 transition-colors group-hover:text-ink" /></div>
      <div className="mt-3 grid grid-cols-3 gap-2">{v.facts.map((f) => <div key={f.k} className="rounded-xl bg-zinc-50 px-2.5 py-2 ring-1 ring-zinc-100"><div className="text-[11px] text-zinc-500">{f.k}</div><div className={cx("tnum mt-0.5 text-[13px] font-semibold", f.tone === "rust" ? "text-rust" : f.tone === "ok" ? "text-ok" : "text-ink")}>{f.v}</div></div>)}</div>
    </Link>
  );
}

/* ───────────── messages ───────────── */
function AgentHead({ meta, thinking }: { meta?: string; thinking?: boolean }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-[12px]">
      <Orb size={18} thinking={thinking} />
      <span className="font-medium text-ink">Deal Desk</span>
      {meta && <span className="text-zinc-400">· {meta}</span>}
    </div>
  );
}

function Thinking({ t, surface }: { t: NonNullable<AssistantMsg["thinking"]>; surface: Surface }) {
  const done = t.steps?.filter((s) => s.done).length ?? 0;
  return (
    <div aria-live="polite" aria-busy>
      <AgentHead thinking meta={t.steps ? `${done} of ${t.steps.length} steps` : undefined} />
      <div className={cx("shimmer shimmer-think font-medium", surface === "page" ? "text-[15px]" : "text-[13.5px]")}>{t.label}</div>
      {t.steps && <ol className="mt-3 ml-[8px] space-y-2.5 border-l border-zinc-200 pl-4">{t.steps.map((s, i) => (
        <li key={i} className="flex items-center gap-2.5 text-[12.5px]">
          {s.done ? <span className="grid size-4 place-items-center rounded-full bg-ink text-white"><Check className="size-2.5" strokeWidth={3} /></span>
            : <span className="relative grid size-4 place-items-center"><span className="absolute inset-0.5 rounded-full bg-rust/30 motion-safe:animate-ping" /><span className="relative size-2 rounded-full bg-rust shadow-[0_0_0_3px_rgba(156,68,15,.14)]" /></span>}
          <span className={s.done ? "text-zinc-500" : "shimmer shimmer-think font-medium"}>{s.label}</span>
        </li>))}</ol>}
      {/* the answer taking shape: three soft lines */}
      <div aria-hidden className={cx("space-y-2.5", surface === "page" ? "mt-7 max-w-[560px]" : "mt-5")}>
        {["w-[94%]", "w-[86%]", "w-[58%]"].map((w, i) => <div key={w} className={cx("dd-skel h-2.5 rounded-full", w)} style={{ animationDelay: `${i * 0.15}s` }} />)}
      </div>
    </div>
  );
}

function Msg({ m, surface, stream }: { m: AssistantMsg; surface: Surface; /** newest answer: stream it in */ stream?: boolean }) {
  const [on, set] = useState<number | null>(null), [hover, setHover] = useState<number | null>(null);
  const c: CiteState = { on, set, hover, setHover };
  if (m.from === "user") return (
    <div data-msg="user" className={cx("flex justify-end", surface === "page" ? "scroll-mt-20" : "scroll-mt-4")}>
      <div className={cx("max-w-[85%] rounded-[18px] rounded-br-[6px] bg-[#f3ede6] px-4 py-2.5 leading-snug text-ink ring-1 ring-[#ebe1d6] shadow-[0_1px_2px_rgba(120,60,20,.05)]", surface === "page" ? "text-[14px]" : "text-[13px]")}>{m.text}</div>
    </div>
  );
  if (m.thinking) return <Thinking t={m.thinking} surface={surface} />;
  const n = m.sources?.length ?? 0;
  // Same on server and client (hydration-safe); reduced motion is enforced in CSS via [data-stream].
  const plan = stream ? streamPlan(m) : undefined;
  const after = (delay: number) => plan ? { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.35, ease } } : {};
  return (
    <div data-stream={plan ? "" : undefined}>
      <AgentHead meta={n ? `${n} ${n === 1 ? "source" : "sources"}` : undefined} />
      <p className={cx("text-zinc-700", surface === "page" ? "text-[14.5px] leading-[1.65]" : "text-[13px] leading-[1.6]")}><Cited text={m.text} sources={m.sources} c={c} plan={plan} /></p>
      {m.visual && <motion.div {...after(plan?.visualAt ?? 0)}><Visual v={m.visual} surface={surface} /></motion.div>}
      {m.sources && <div className={cx("flex flex-wrap", surface === "dock" ? "mt-2.5 gap-1" : "mt-3 gap-1.5")} aria-label="Sources">{m.sources.map((s, i) => (
        <motion.span key={s.label} className="inline-flex min-w-0 max-w-full" {...after((plan?.chipsAt ?? 0) + i * STREAM.chip)}><SourcePill s={s} n={i + 1} c={c} compact={surface === "dock"} /></motion.span>
      ))}</div>}
    </div>
  );
}

function FollowUps({ items, onSend, surface = "page", delay }: { items: string[]; onSend?: (t: string) => void; surface?: Surface; /** stream: appear after the answer */ delay?: number }) {
  const enter = (i: number) => delay !== undefined ? { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, transition: { delay: delay + i * 0.07, duration: 0.3, ease } } : {};
  // Dock: a compact list of single-line rows (full text in the tooltip). Page: wrapping pills.
  if (surface === "dock") return (
    <div data-stream className="-mx-1.5 pt-1" aria-label="Follow-up questions">
      <motion.div className="px-1.5 pb-1 text-[11px] text-zinc-400" {...enter(0)}>Ask next</motion.div>
      {items.map((f, i) => <motion.button key={f} {...enter(i + 1)} type="button" title={f} onClick={() => onSend?.(f)} className={cx("group flex h-8 w-full items-center gap-2 rounded-lg px-1.5 text-left text-[12.5px] text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-ink", FOCUS, "focus-visible:ring-offset-0")}><CornerDownRight className="size-3.5 shrink-0 text-rust/60" /><span className="min-w-0 flex-1 truncate">{f}</span><ArrowUp className="size-3 shrink-0 rotate-45 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100" /></motion.button>)}
    </div>
  );
  return (
    <div data-stream className="flex flex-wrap gap-1.5 pt-1" aria-label="Follow-up questions">
      {items.map((f, i) => <motion.button key={f} {...enter(i)} type="button" onClick={() => onSend?.(f)} className={cx("inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-white px-3 text-[12.5px] text-zinc-600 ring-1 ring-zinc-200/90 transition-[box-shadow,color,translate] hover:-translate-y-px hover:text-ink hover:shadow-[0_4px_12px_-6px_rgba(9,9,11,.2)] hover:ring-zinc-300", FOCUS)}><CornerDownRight className="size-3.5 shrink-0 text-rust/60" /><span className="truncate">{f}</span></motion.button>)}
    </div>
  );
}

/* ───────────── composer ───────────── */
function ScopeChip({ value, scopes }: { value: string; scopes?: string[] }) {
  const [open, setOpen] = useState(false), [v, setV] = useState(value);
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLSpanElement>(null);
  useEffect(() => setV(value), [value]);
  const list = scopes && scopes.length ? (scopes.includes(value) ? scopes : [value, ...scopes]) : [value];
  // Opening moves focus to the selected option; arrows move, Escape closes back to the chip.
  useEffect(() => { if (open) menu.current?.querySelector<HTMLButtonElement>("[aria-selected=true]")?.focus(); }, [open]);
  const onKey = (e: React.KeyboardEvent) => {
    const opts = [...(menu.current?.querySelectorAll<HTMLButtonElement>("[role=option]") ?? [])], at = opts.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); opts[(at + (e.key === "ArrowDown" ? 1 : opts.length - 1)) % opts.length]?.focus(); }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); trigger.current?.focus(); }
  };
  // one scope only: a label, not a menu with nothing to choose
  if (list.length < 2) return <span className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full bg-zinc-50 px-2.5 text-[12px] text-zinc-600 ring-1 ring-zinc-200/80"><span className="size-1.5 shrink-0 rounded-full bg-rust" /><span className="truncate">{value}</span></span>;
  return (
    <span className="relative min-w-0" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <button ref={trigger} type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} onKeyDown={(e) => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); setOpen(true); } }} title="What to search"
        className={cx("inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full bg-zinc-50 pr-2 pl-2.5 text-[12px] text-zinc-600 ring-1 ring-zinc-200/80 transition-colors hover:bg-white hover:text-ink", FOCUS)}>
        <span className="size-1.5 shrink-0 rounded-full bg-rust" /><span className="truncate">{v}</span><ChevronDown className={cx("size-3 shrink-0 text-zinc-400 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.span ref={menu} role="listbox" aria-label="Scope" onKeyDown={onKey} initial={{ opacity: 0, y: 4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }} transition={{ duration: 0.18, ease }}
            className="absolute bottom-full left-0 z-30 mb-2 w-[200px] origin-bottom-left rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_16px_40px_-16px_rgba(9,9,11,.3)]">
            {list.map((s) => <button key={s} type="button" role="option" aria-selected={s === v} onClick={() => { setV(s); setOpen(false); trigger.current?.focus(); }} className={cx("flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[12.5px] text-zinc-700 hover:bg-zinc-50 focus-visible:bg-rust-50 focus-visible:text-rust", FOCUS, "focus-visible:ring-offset-0")}>{s}{s === v && <Check className="ml-auto size-3.5 text-ink" />}</button>)}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function Composer({ data, onSend, onStop, variant, running, onAttach, onDictate }: { /** buttons render only when wired: no dead controls */ onAttach?: () => void; onDictate?: () => void; data: AssistantData; onSend?: (text: string) => void; onStop?: () => void; variant: "dock" | "page" | "hero"; /** an answer is being written: send becomes Stop */ running?: boolean }) {
  const hero = variant === "hero", dock = variant === "dock";
  return (
    <form onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get("q"); if (typeof v === "string" && v.trim()) onSend?.(v.trim()); }}
      className={cx("border border-zinc-200/90 bg-white transition-shadow focus-within:border-zinc-300",
        hero ? "rounded-[22px] p-3.5 shadow-[0_1px_2px_rgba(9,9,11,.04),0_0_0_5px_rgba(244,240,235,.9),0_24px_48px_-28px_rgba(120,60,20,.35)] focus-within:shadow-[0_1px_2px_rgba(9,9,11,.04),0_0_0_5px_rgba(156,68,15,.08),0_24px_48px_-28px_rgba(120,60,20,.4)]"
          : dock ? "rounded-[18px] p-2.5 shadow-[0_1px_2px_rgba(9,9,11,.04),0_10px_28px_-18px_rgba(9,9,11,.25)]"
          : "rounded-[20px] p-3 shadow-[0_1px_2px_rgba(9,9,11,.04),0_18px_40px_-26px_rgba(9,9,11,.3)]")}>
      <textarea name="q" rows={hero ? 3 : 1} aria-label={data.placeholder} placeholder={data.placeholder}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
        className={cx("block w-full resize-none bg-transparent px-1.5 leading-relaxed outline-none placeholder:text-zinc-400", hero ? "min-h-[4.5rem] pt-0.5 text-[15px]" : "min-h-[1.75rem] pt-1 text-[13.5px]")} />
      <div className={cx("flex items-center gap-1.5", hero ? "mt-2" : "mt-1.5")}>
        {onAttach && <button type="button" onClick={onAttach} aria-label="Attach a file or deal" title="Attach a file or deal" className={cx("grid size-8 shrink-0 place-items-center rounded-full text-zinc-500 ring-1 ring-zinc-200/90 transition-colors hover:bg-zinc-50 hover:text-ink", FOCUS)}><Plus className="size-4" /></button>}
        <ScopeChip value={data.context} scopes={data.scopes} />
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {onDictate && <button type="button" onClick={onDictate} aria-label="Dictate" title="Dictate" className={cx("grid place-items-center rounded-full bg-white text-zinc-600 ring-1 ring-zinc-200/90 shadow-[0_1px_2px_rgba(9,9,11,.05)] transition-colors hover:text-ink hover:ring-zinc-300", dock ? "size-8" : "size-9")}><Mic className="size-4" strokeWidth={1.75} /></button>}
          {running
            ? <button type="button" onClick={onStop} aria-label="Stop" title="Stop" className={cx("relative grid place-items-center rounded-full bg-ink text-white shadow-[0_1px_2px_rgba(9,9,11,.2),inset_0_1px_0_rgba(255,255,255,.14)] transition-colors hover:bg-zinc-800", dock ? "size-8" : "size-9")}><span className="absolute -inset-[3px] rounded-full border-2 border-rust/25 border-t-rust motion-safe:animate-spin" /><Square className="size-3 fill-current" /></button>
            : <button type="submit" aria-label="Send" title="Send" className={cx("grid place-items-center rounded-full bg-ink text-white shadow-[0_1px_2px_rgba(9,9,11,.2),inset_0_1px_0_rgba(255,255,255,.14)] transition-colors hover:bg-zinc-800", dock ? "size-8" : "size-9")}><ArrowUp className="size-4" /></button>}
        </span>
      </div>
    </form>
  );
}

/* ───────────── dock ───────────── */
/** Dock heading: a two-sentence greeting becomes a small italic lead over a one-line question (designed, not wrapped). */
function Greeting({ title }: { title: string }) {
  const m = /^(.+?[.!])\s+(.+)$/.exec(title);
  return (
    <h2 className="serif mt-5 tracking-[-0.01em]">
      {m && <span className="block text-[15px] leading-none text-rust/80 italic">{m[1]}</span>}
      <span className={cx("block text-[22px] leading-tight text-balance", m && "mt-1.5")}>{m ? m[2] : title}</span>
    </h2>
  );
}

/** The newest agent answer (streams in) and when its follow-ups should appear. */
function useStream(data: AssistantData) {
  const lastMsg = data.messages[data.messages.length - 1];
  const live = lastMsg && lastMsg.from === "agent" && !lastMsg.thinking ? lastMsg : undefined;
  return { liveId: live?.id, followDelay: live ? streamPlan(live).end : 0 };
}
/** Scroll a thread so the latest question sits at the top (the answer reads downward from it). */
function anchorLastQuestion(root: HTMLElement | null, scroller?: HTMLElement | null) {
  const qs = root?.querySelectorAll<HTMLElement>("[data-msg=user]"), q = qs?.[qs.length - 1];
  if (!q) return;
  if (scroller) scroller.scrollTop = Math.max(0, q.offsetTop - 16);
  else q.scrollIntoView({ block: "start" });
}
export function AssistantDock({ data, onSuggestion: onSuggestionProp, onSend: onSendProp, onClose, onNewChat, top, expandHref }: { data: AssistantData; /** only shown when the host can really start a new chat */ onNewChat?: () => void; expandHref?: string; onSuggestion?: (action: string) => void; onSend?: (text: string) => void; onClose?: () => void; /** v3.2 · optional block under the header, e.g. LiveRail */ top?: ReactNode }) {
  const ask = useAsk();
  // Default (host passes no handler): a question (or suggestion) opens the research agent at /ask?q=…, which runs it.
  const router = useRouter();
  const toAsk = (t: string) => { ask?.setOpen(false); router.push(`/ask?q=${encodeURIComponent(t)}`); };
  const onSend = onSendProp ?? toAsk;
  const onSuggestion = onSuggestionProp ?? toAsk;
  const empty = data.messages.length === 0;
  const thinking = data.messages[data.messages.length - 1]?.thinking;
  const { liveId, followDelay } = useStream(data);
  // Open with the latest question at the top of the thread.
  const scroller = useRef<HTMLDivElement>(null), last = data.messages[data.messages.length - 1]?.id;
  useEffect(() => { if (last) anchorLastQuestion(scroller.current, scroller.current); }, [last]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[52px] shrink-0 items-center gap-2.5 border-b border-zinc-100 px-4">
        <Orb size={20} thinking={!!thinking} />
        <span className="text-[13px] font-medium">{data.title}</span>
        <span className="ml-auto flex items-center gap-0.5">
          {onNewChat && <IconBtn icon={<SquarePen />} label="New chat" tone="bare" size="sm" onClick={onNewChat} />}
          <Link href={expandHref ?? ROUTES.ask()} aria-label="Open full page" title="Open full page" className="grid size-7 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-ink"><Maximize2 className="size-3.5" /></Link>
          <IconBtn icon={<X />} label="Close" tone="bare" size="sm" onClick={onClose ?? (() => ask?.setOpen(false))} />
        </span>
      </div>
      {top}
      <div ref={scroller} data-thread className="relative min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-14">
        <AnimatePresence mode="wait">
        {empty ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex min-h-full flex-col items-center pt-5 text-center">
            <Orb size={56} />
            <Greeting title={data.greeting?.title ?? ""} />
            {data.greeting?.body && <p className="mt-2 max-w-[290px] text-[12.5px] leading-snug text-zinc-500">{data.greeting.body}</p>}
            <div className="mt-5 w-full space-y-2 text-left">
              {data.suggestions.map((s) => (
                <button key={s.id} type="button" onClick={() => onSuggestion?.(s.action)} className={cx("group flex w-full items-center gap-3 rounded-2xl border border-zinc-200/90 bg-white py-2.5 pr-3 pl-2.5 text-left shadow-[0_1px_2px_rgba(9,9,11,.03)] transition-all hover:-translate-y-px hover:border-zinc-300 hover:shadow-[0_8px_20px_-14px_rgba(9,9,11,.3)]", FOCUS)}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#faf3ec] text-rust/80 ring-1 ring-[#f1e2d2]"><Glyph k={s.icon} className="size-3.5" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[12.5px] leading-snug font-medium text-ink">{s.title}</span><span className="mt-0.5 block truncate text-[11.5px] text-zinc-500">{s.desc}</span></span>
                  <ArrowUp className="size-3.5 shrink-0 rotate-45 text-zinc-300 transition-colors group-hover:text-ink" />
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div key="thread" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-5">
            <AnimatePresence>{data.messages.map((m) => <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}><Msg m={m} surface="dock" stream={m.id === liveId} /></motion.div>)}</AnimatePresence>
            {!thinking && data.followups && data.followups.length > 0 && <FollowUps items={data.followups} onSend={onSend} surface="dock" delay={liveId ? followDelay : undefined} />}
            {!thinking && data.suggestions.length > 0 && (
              <div className="space-y-2 pt-1">
                {data.suggestions.map((s) => (
                  <button key={s.id} type="button" onClick={() => onSuggestion?.(s.action)} className="group block w-full rounded-2xl border border-zinc-200/90 bg-white px-3.5 py-3 text-left shadow-[0_1px_2px_rgba(9,9,11,.03)] transition-all hover:-translate-y-px hover:border-zinc-300 hover:shadow-[0_8px_20px_-14px_rgba(9,9,11,.3)]">
                    <span className="block text-[12.5px] font-medium text-ink">{s.title}</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-zinc-500">{s.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </div>
      <div className="relative shrink-0 px-3 pb-3">
        {/* soft fade so the thread never collides with the input as it scrolls under */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-white to-white/0" />
        <Composer data={data} onSend={onSend} variant="dock" running={!!thinking} />
      </div>
    </div>
  );
}

/* ───────────── full page ───────────── */
function Recent({ items }: { items: AssistantThread[] }) {
  return (
    <div className="w-full">
      <div className="mb-2.5 flex items-center gap-2 px-1 text-[12px] text-zinc-400"><History className="size-3.5" />Recent</div>
      <div className="grid grid-cols-3 gap-2.5">
        {items.map((t) => (
          <Link key={t.id} href={t.href ?? "#"} className="group relative flex min-w-0 items-start gap-2.5 rounded-2xl bg-white/60 py-3 pr-8 pl-3.5 ring-1 ring-zinc-200/70 transition-all duration-150 hover:-translate-y-px hover:bg-white hover:shadow-[0_10px_24px_-14px_rgba(120,60,20,.3)] hover:ring-zinc-300/80 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-rust/45 focus-visible:outline-none">
            <ArrowUp className="absolute top-3 right-3 size-3.5 rotate-45 text-zinc-300 opacity-0 transition-all group-hover:text-rust group-hover:opacity-100" />
            <span className="mt-[1px] text-zinc-400 transition-colors group-hover:text-rust/80">{t.icon ? <Glyph k={t.icon} className="size-3.5" /> : <MessageSquare className="size-3.5" strokeWidth={1.75} />}</span>
            <span className="min-w-0"><span className="line-clamp-2 text-[12.5px] leading-snug text-zinc-700 group-hover:text-ink">{t.title}</span><span className="mt-0.5 block truncate text-[11.5px] text-zinc-400">{t.meta}</span></span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * The assistant as a full page (chat-first, inspo 27707751): orb, one question, a roomy prompt box, three chips,
 * a quiet Recent row. With messages it becomes a centred 720px thread with the composer pinned to the bottom.
 */
export function AssistantFull({ data, onSuggestion, onSend }: { data: AssistantData; onSuggestion?: (action: string) => void; onSend?: (text: string) => void }) {
  const empty = data.messages.length === 0;
  const thinking = data.messages[data.messages.length - 1]?.thinking;
  const { liveId, followDelay } = useStream(data);
  // Open with the latest question at the top (after the router's own scroll handling on first paint).
  const thread = useRef<HTMLDivElement>(null), last = data.messages[data.messages.length - 1]?.id;
  useEffect(() => {
    if (!last) return;
    const t = setTimeout(() => anchorLastQuestion(thread.current), 60);
    return () => clearTimeout(t);
  }, [last]);
  return (
    <div className="flex min-h-[calc(100vh-52px)] flex-col overflow-x-clip">
      <AnimatePresence mode="wait">
      {empty ? (
        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="relative isolate mx-auto flex w-full max-w-[700px] flex-1 flex-col items-center justify-center px-6 pt-8 pb-12 text-center">
          {/* faint warm focal glow behind the orb */}
          <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[760px] -translate-x-1/2 -translate-y-[64%] rounded-full bg-[radial-gradient(circle,rgba(232,150,90,.16),rgba(240,190,140,.07)_38%,transparent_66%)]" />
          <span className="relative"><Orb size={108} /></span>
          <h1 className="serif relative mt-9 text-[34px] leading-tight tracking-[-0.02em]">{data.greeting?.title}</h1>
          {data.greeting?.body && <p className="mt-2 text-[14px] text-zinc-500">{data.greeting.body}</p>}
          <div className="mt-9 w-full text-left"><Composer data={data} onSend={onSend} variant="hero" /></div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {data.suggestions.slice(0, 3).map((s) => (
              <button key={s.id} type="button" onClick={() => onSuggestion?.(s.action)} title={s.title}
                className="group inline-flex h-9 items-center gap-2 rounded-full bg-white px-3.5 text-[13px] text-zinc-700 ring-1 ring-zinc-200/90 shadow-[0_1px_2px_rgba(9,9,11,.04)] transition-all hover:-translate-y-px hover:text-ink hover:shadow-[0_8px_18px_-10px_rgba(120,60,20,.35)] hover:ring-zinc-300 focus-visible:ring-2 focus-visible:ring-rust/45 focus-visible:outline-none">
                <Glyph k={s.icon} className="size-3.5 text-rust/70 transition-colors group-hover:text-rust" />{s.short ?? s.title}
              </button>
            ))}
          </div>
          {data.recent && data.recent.length > 0 && <div className="mt-16 w-full text-left"><Recent items={data.recent} /></div>}
        </motion.div>
      ) : (
        <motion.div key="thread" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="flex flex-1 flex-col">
          {/* soft fade under the sticky top bar so earlier answers don't peek at its edge */}
          <div aria-hidden className="pointer-events-none sticky top-[52px] z-10 -mb-12 h-12 bg-gradient-to-b from-[#f8f8f7] via-[#f8f8f7]/80 to-transparent" />
          {/* min-height lets the latest question scroll to the top even when its answer is short */}
          <div ref={thread} data-thread className="mx-auto w-full max-w-[720px] flex-1 space-y-7 px-6 pt-8 pb-8">
            <AnimatePresence>{data.messages.map((m) => <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}><Msg m={m} surface="page" stream={m.id === liveId} /></motion.div>)}</AnimatePresence>
            {!thinking && data.followups && data.followups.length > 0 && <FollowUps items={data.followups} onSend={onSend} delay={liveId ? followDelay : undefined} />}
          </div>
          <div className="sticky bottom-0 bg-gradient-to-t from-[#f8f8f7] from-60% to-transparent pt-8 pb-6"><div className="mx-auto max-w-[720px] px-6"><Composer data={data} onSend={onSend} variant="page" running={!!thinking} /></div></div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
