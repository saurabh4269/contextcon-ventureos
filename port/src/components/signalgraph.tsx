"use client";
/**
 * v4 · Signal graph + Live research (deal page › Signals). Shows HOW Crustdata data drives the fit score.
 * Radial graph (C1): the company sits in a glass hub (via Crustdata); thin curved white lines draw out to one pill per real
 * API call on an ellipse, each ending in a glowing dot with ONE short result chip. Results stream back into the hub, then
 * each signal flows out of the dark panel's right edge into Deal Desk's sienna Fit tile (+/- weights) → recommendation.
 * Every field path, request body and raw response lives in the node popover and in the "Signals into fit" list.
 *
 * Every frame is a pure function of t (ms) over `data.timeline`: `freezeAt` pins a frame (?t= / ?graph=), Replay runs t
 * from 0, reduced motion shows the settled state. Crustdata purple (#5644ED / #8681F7) lives only inside the dark panel.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, RotateCcw, RefreshCw, ScanSearch, Sparkles, X, AlertTriangle, MessageSquareText, FileSearch } from "lucide-react";
import { CompanyLogo, Btn, IconBtn, HL, cx } from "./ui";
import { BAND } from "./dealbits";
import { useReducedMotion } from "./motion";
import { fitBand, type SignalGraphData, type SignalCall, type SignalChip, type SignalSpark, type SignalEvent, type ScreenStatus } from "../types";

const K = { line: "rgba(255,255,255,.3)", lilac: "#8681F7", t2: "#D4D4D4", t3: "#A3A3A3", t4: "#737373", green: "#86e0a6", rust: "#c2652b" };
const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (u: number) => 1 - Math.pow(1 - u, 3);

/** Shorten a dotted field path only between segments (fit list fallback; the full path is always in the title). */
export function abbrevPath(path: string, max: number) {
  if (path.length <= max) return path;
  const seg = path.split("."), last = seg[seg.length - 1];
  let head = seg[0], i = 1;
  for (; i < seg.length - 1; i++) { const next = `${head}.${seg[i]}`; if (`${next}…${last}`.length > max) break; head = next; }
  const out = `${head}…${last}`;
  return seg.length > 2 && out.length < path.length ? out : path;
}

/* ───────── timeline → schedule ───────── */
type Sched = ReturnType<typeof schedule>;
function schedule(d: SignalGraphData) {
  const ev = d.timeline;
  const at = (f: (e: SignalEvent) => boolean) => ev.find(f)?.at ?? Infinity;
  const callStart: Record<string, number> = {}, callDone: Record<string, number> = {}, chipAt: Record<string, number> = {}, scoreAt: Record<string, number> = {};
  for (const c of d.calls) {
    callStart[c.id] = at((e) => e.type === "call" && e.call === c.id);
    callDone[c.id] = at((e) => e.type === "done" && e.call === c.id);
    for (const ch of c.chips) chipAt[`${c.id}/${ch.id}`] = at((e) => e.type === "chip" && e.call === c.id && e.chip === ch.id);
  }
  for (const k of d.fit.contributions) scoreAt[k.id] = at((e) => e.type === "score" && e.contribution === k.id);
  const lastDone = Math.max(0, ...Object.values(callDone).filter(Number.isFinite));
  return {
    query: at((e) => e.type === "query"), fanout: at((e) => e.type === "fanout"), decide: at((e) => e.type === "decide"),
    callStart, callDone, chipAt, scoreAt, lastDone,
    streams: ev.filter((e): e is Extract<SignalEvent, { type: "stream" }> => e.type === "stream"),
    end: Math.max(0, ...ev.map((e) => e.at)) + 700,
  };
}
/** Progress 0..1 of a step starting at `a` lasting `dur` ms. t = Infinity is the settled final state. */
const prog = (t: number, a: number, dur: number) => (t === Infinity ? 1 : !Number.isFinite(a) ? 0 : clamp((t - a) / dur));
const SCORE_TRAVEL = 800, CALL_TRAVEL = 420, RESULT_TRAVEL = 520;

/* ───────── layout: slots on an ellipse around the hub (fractions of the graph area) ───────── */
type Slot = "tl" | "l" | "bl" | "tr" | "br" | "b";
const SLOTS: Slot[] = ["tl", "l", "bl", "tr", "br", "b"];
/** x/y = the glowing end dot; `side` = where the pill sits relative to the dot; `chip` = where the lead chip sits. */
const SLOT: Record<Slot, { x: number; y: number; side: "left" | "right" | "below"; chip: "above" | "below" }> = {
  tl: { x: 0.3, y: 0.23, side: "left", chip: "above" },
  l: { x: 0.26, y: 0.53, side: "left", chip: "below" },
  bl: { x: 0.3, y: 0.84, side: "left", chip: "below" },
  tr: { x: 0.665, y: 0.23, side: "right", chip: "above" },
  br: { x: 0.72, y: 0.84, side: "right", chip: "below" },
  b: { x: 0.56, y: 0.82, side: "below", chip: "below" },
};
const HUB = { x: 0.56, y: 0.51 };

/* ───────── geometry (offset-based, so entry transforms don't skew lines) ───────── */
type Box = { x: number; y: number; w: number; h: number };
type Pt = { x: number; y: number };
type Seg = [Pt, Pt, Pt, Pt];
const toD = (s: Seg) => `M${s[0].x},${s[0].y}C${s[1].x},${s[1].y} ${s[2].x},${s[2].y} ${s[3].x},${s[3].y}`;
function sample(s: Seg) {
  const pts: Pt[] = [];
  for (let i = 0; i <= 40; i++) {
    const u = i / 40, m = 1 - u;
    pts.push({ x: m * m * m * s[0].x + 3 * m * m * u * s[1].x + 3 * m * u * u * s[2].x + u * u * u * s[3].x, y: m * m * m * s[0].y + 3 * m * m * u * s[1].y + 3 * m * u * u * s[2].y + u * u * u * s[3].y });
  }
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, len, total: len[len.length - 1] };
}
function pointAt(s: ReturnType<typeof sample>, u: number): Pt {
  const L = s.total * clamp(u);
  let i = 1;
  while (i < s.len.length - 1 && s.len[i] < L) i++;
  const span = s.len[i] - s.len[i - 1] || 1, f = (L - s.len[i - 1]) / span;
  return { x: s.pts[i - 1].x + (s.pts[i].x - s.pts[i - 1].x) * f, y: s.pts[i - 1].y + (s.pts[i].y - s.pts[i - 1].y) * f };
}
function measure(root: HTMLElement) {
  const out: Record<string, Box> = {};
  root.querySelectorAll<HTMLElement>("[data-sg]").forEach((el) => {
    let x = 0, y = 0, n: HTMLElement | null = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent as HTMLElement | null; }
    out[el.dataset.sg!] = { x, y, w: el.offsetWidth, h: el.offsetHeight };
  });
  return out;
}
function mix(a: string, b: string, u: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * u)).join(",")})`;
}
/** Deterministic particle field (static atmosphere, identical on server and client). */
function particles(n: number) {
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => ({ x: r() * 100, y: r() * 100, r: r() < 0.85 ? 0.6 + r() * 0.6 : 1.3 + r() * 1.1, o: 0.06 + r() * 0.24 }));
}
const DUST = particles(60);
/** Middle ellipsis for long paths in narrow rows (the full path is in the row's title). */
const midEllipsis = (v: string, max: number) => (v.length <= max ? v : `${v.slice(0, Math.ceil((max - 1) * 0.55))}…${v.slice(v.length - Math.floor((max - 1) * 0.45))}`);
/** Latency label: "350 ms" / "4.8 s". */
const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);
/** Calls at or above this latency show it on the canvas (live web search takes 4–7 s). */
const SLOW_MS = 1000;
/** Honest field count: the response fields this graph actually reads (chips + sparklines), not the payload size. */
const usedFields = (c: SignalCall) => c.chips.length + (c.sparks?.length ?? 0);

/* ───────── small pieces ───────── */
function Mark({ url, size }: { url: string; size: number }) {
  return <img src={url} alt="" aria-hidden width={size} height={Math.round((size * 32) / 37)} style={{ width: size, height: Math.round((size * 32) / 37) }} className="block shrink-0" />;
}
/** The one chip on the canvas: short human label + value (real path in the title/popover). */
function LeadChip({ c, show, fed }: { c: SignalChip; show: number; fed?: boolean }) {
  return (
    <span title={`${c.path ?? c.field}: ${c.value}`}
      style={{ opacity: show, transform: `translateY(${(1 - ease(show)) * 4}px)`, background: fed ? "rgba(134,129,247,.14)" : "rgba(255,255,255,.05)", boxShadow: `inset 0 0 0 1px ${fed ? "rgba(134,129,247,.42)" : "rgba(255,255,255,.1)"}` }}
      className="inline-flex h-7 items-center gap-2 rounded-full pr-1 pl-3 text-[12px] whitespace-nowrap">
      <span style={{ color: K.t3 }}>{c.short ?? c.field}</span>
      <span className="rounded-full bg-white/10 px-2 py-[3px] leading-none font-semibold text-white">{c.value}</span>
    </span>
  );
}
function SparkRow({ s }: { s: SignalSpark }) {
  const W = 72, H = 16, v = s.points.map((p) => p.v), lo = Math.min(...v), hi = Math.max(...v);
  const pts = v.map((n, i) => [(i / (v.length - 1)) * W, H - 1.5 - ((n - lo) / (hi - lo || 1)) * (H - 3)]);
  const last = pts[pts.length - 1];
  return (
    <div title={s.field} className="grid grid-cols-[minmax(0,1fr)_72px_44px] items-center gap-3 font-mono text-[10.5px]">
      <span className="truncate" style={{ color: K.t3 }}>{s.label}</span>
      <svg width={W} height={H} className="overflow-visible" aria-hidden>
        <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#e8e8e8" strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last[0]} cy={last[1]} r={2} fill={K.lilac} />
      </svg>
      <span className="text-right text-white">{s.value}</span>
    </div>
  );
}
type CallState = "queued" | "running" | "done";

/** One endpoint on the ellipse: glowing end dot at the slot, pill on the outer side, one lead chip. */
function Endpoint({ c, slot, t, S, fed, open, onToggle }: { c: SignalCall; slot: Slot; t: number; S: Sched; fed: Set<string>; open: boolean; onToggle: () => void }) {
  const L = SLOT[slot], start = S.callStart[c.id], done = S.callDone[c.id];
  const state: CallState = t === Infinity || t >= done ? "done" : t >= start ? "running" : "queued";
  const lead = c.chips.find((x) => x.id === c.lead) ?? c.chips[0];
  const leadShow = lead ? prog(t, S.chipAt[`${c.id}/${lead.id}`], 260) : 0;
  const lit = state !== "queued";
  const dot = (
    <span data-sg={`dot-${c.id}`} className="size-[11px] shrink-0 rounded-full" style={{
      background: state === "done" ? "#fff" : state === "running" ? K.lilac : "#3a3a3a",
      boxShadow: state === "done" ? "0 0 0 3px rgba(255,255,255,.08), 0 0 14px 3px rgba(255,255,255,.5)" : state === "running" ? "0 0 16px 4px rgba(134,129,247,.7)" : "none",
    }} />
  );
  const pill = (
    <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`${c.method} ${c.path}: details`}
      className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-4 font-mono text-[12.5px] whitespace-nowrap text-white outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[#8681F7]/60"
      style={{ opacity: lit ? 1 : 0.32, background: "linear-gradient(180deg,#1d1d1f,#121213)", boxShadow: state === "running" ? "inset 0 0 0 1px rgba(134,129,247,.6), 0 0 22px -4px rgba(86,68,237,.75)" : open ? "inset 0 0 0 1px rgba(255,255,255,.4)" : "inset 0 0 0 1px rgba(255,255,255,.13), inset 0 1px 0 rgba(255,255,255,.06), 0 10px 24px -12px rgba(0,0,0,.9)" }}>
      {c.path}
      {state === "done" && c.ms >= SLOW_MS && <span className="text-[11px]" style={{ color: K.t4 }}>{fmtMs(c.ms)}</span>}
      {state === "running" && <span className="size-3 rounded-full border-[1.5px] motion-safe:animate-spin" style={{ borderColor: "rgba(134,129,247,.25)", borderTopColor: K.lilac }} />}
    </button>
  );
  const chip = lead && <LeadChip c={lead} show={leadShow} fed={fed.has(`${c.id}/${lead.id}`)} />;
  // running: one-line request preview where the chip will land
  const body = state === "running" && leadShow < 1 && (
    <span className="line-clamp-2 max-w-[220px] font-mono text-[10.5px] leading-[14px] break-all" style={{ opacity: 1 - leadShow, textAlign: L.side === "left" ? "right" : L.side === "right" ? "left" : "center" }}>
      <span className="shimmer" style={{ "--sh-a": "#8d8d8d", "--sh-b": "#ffffff" } as React.CSSProperties}>{c.method} {c.body}</span>
    </span>
  );
  const items = L.chip === "above" ? <>{chip}{body}</> : <>{body}{chip}</>;
  const stackAlign = L.side === "left" ? "items-end" : L.side === "right" ? "items-start" : "items-center";
  const pos: React.CSSProperties = { left: `${L.x * 100}%`, top: `${L.y * 100}%` };
  // anchor: the dot sits exactly on the slot point; the pill+chip stack grows away from the hub
  const tf = L.side === "left" ? "translate(calc(-100% + 5.5px), -50%)" : L.side === "right" ? "translate(-5.5px, -50%)" : "translate(-50%, -5.5px)";
  return (
    <div data-sg={`node-${c.id}`} className={cx("absolute", open ? "z-30" : "z-10")} style={{ ...pos, transform: tf }}>
      {L.side === "below" ? (
        <div className="flex flex-col items-center gap-2.5">{dot}{pill}<span className="relative flex h-7 items-center justify-center">{chip}{body && <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">{body}</span>}</span></div>
      ) : (
        <div className={cx("flex items-center gap-2.5", L.side === "right" && "flex-row-reverse")}>
          <div className={cx("relative flex flex-col", stackAlign)}>
            {pill}
            <div className={cx("absolute flex flex-col gap-1", stackAlign, L.chip === "above" ? "bottom-full mb-2" : "top-full mt-2", L.side === "left" ? "right-0" : "left-0")}>{items}</div>
          </div>
          {dot}
        </div>
      )}
      {open && <NodeDetail c={c} slot={slot} onClose={onToggle} state={state} />}
    </div>
  );
}

/** Request body, pretty-printed (exactly what is sent) and collapsed to 3 lines until expanded. */
function RequestBody({ body }: { body: string }) {
  const [open, setOpen] = useState(false);
  const lines = useMemo(() => { try { return JSON.stringify(JSON.parse(body), null, 2).split("\n"); } catch { return [body]; } }, [body]);
  const long = lines.length > 3;
  return (
    <div className="mt-2">
      <pre className={cx("overflow-x-auto font-mono text-[11px] leading-[16px] whitespace-pre", open && "max-h-[220px] overflow-y-auto")} style={{ color: K.t3 }}>{(open || !long ? lines : lines.slice(0, 3)).join("\n")}{!open && long && <span style={{ color: K.t4 }}>{"\n  …"}</span>}</pre>
      {long && <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-1 font-mono text-[10.5px] text-white/70 underline decoration-white/25 underline-offset-2 hover:text-white">{open ? "Hide body" : `Show body · ${lines.length} lines`}</button>}
    </div>
  );
}

function NodeDetail({ c, slot, onClose, state }: { c: SignalCall; slot: Slot; onClose: () => void; state: CallState }) {
  const L = SLOT[slot];
  const where = slot === "l" ? "top-1/2 left-full ml-4 -translate-y-1/2" : cx(L.y < 0.4 ? "top-full mt-12" : "bottom-full mb-3", L.side === "left" ? "left-0" : L.side === "right" ? "right-0" : "left-1/2 -translate-x-1/2");
  return (
    <div onClick={(e) => e.stopPropagation()} className={cx("absolute z-40 w-[320px] rounded-[16px] p-3.5 text-left", where)}
      style={{ background: "#0e0e0f", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14), 0 28px 56px -16px rgba(0,0,0,.95)" }}>
      <div className="flex items-center gap-2 font-mono text-[11px]" style={{ color: K.t2 }}>
        <span className="truncate"><span style={{ color: K.t4 }}>{c.method}</span> {c.path}</span>
        <span className="shrink-0" style={{ color: K.t4 }}>{state === "done" ? `${fmtMs(c.ms)} · ${usedFields(c)} fields used` : state}</span>
        <button type="button" aria-label="Close" onClick={onClose} className="ml-auto grid size-5 shrink-0 place-items-center rounded-md text-white/70 hover:bg-white/10"><X className="size-3" /></button>
      </div>
      <RequestBody body={c.body} />
      <div className="mt-3 space-y-1.5 border-t pt-3" style={{ borderColor: "rgba(255,255,255,.08)" }}>
        {c.chips.map((x) => (
          <div key={x.id} className="flex items-baseline gap-3 font-mono text-[10.5px]">
            <span className="min-w-0 flex-1 break-all" style={{ color: K.t3 }}>{x.path ?? x.field}</span>
            <span className="shrink-0 text-white">{x.value}</span>
          </div>
        ))}
      </div>
      {c.sparks && <div className="mt-3 space-y-1.5 border-t pt-3" style={{ borderColor: "rgba(255,255,255,.08)" }}>{c.sparks.map((s) => <SparkRow key={s.id} s={s} />)}</div>}
    </div>
  );
}

function Freshness({ mode, ago }: { mode: "stale" | "verifying" | "now" | "connecting"; ago: string }) {
  const base = "inline-flex h-7 items-center gap-2 rounded-full px-3 font-mono text-[11px]";
  if (mode === "now") return <span className={base} style={{ color: K.green, background: "rgba(40,90,60,.28)", boxShadow: "inset 0 0 0 1px rgba(134,224,166,.32)" }}><Check className="size-3" strokeWidth={2.5} />updated now</span>;
  if (mode === "verifying" || mode === "connecting") return (
    <span className={base} style={{ color: "#e4e4ff", background: "rgba(86,68,237,.14)", boxShadow: "inset 0 0 0 1px rgba(134,129,247,.45)" }}>
      {mode === "verifying" ? "Re-verifying…" : "Connecting…"}<RefreshCw className="size-3 motion-safe:animate-spin" style={{ animationDuration: "1.4s" }} />
    </span>
  );
  return <span className={base} style={{ color: K.t3, background: "#161616", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}><span style={{ color: K.t4 }}>requested</span>{ago}</span>;
}

function EventPill({ who, text, show }: { who: string; text: string; show: number }) {
  return (
    <span style={{ opacity: show, transform: `translateY(${(1 - ease(show)) * 6}px)`, background: "linear-gradient(180deg,#3a3a3a,#262626)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.16), inset 0 1px 0 rgba(255,255,255,.12), 0 8px 24px -8px rgba(0,0,0,.7)" }}
      className="inline-flex h-8 min-w-0 items-center gap-2 rounded-full py-1 pr-3.5 pl-1 text-[12px]">
      <span className="grid size-6 shrink-0 place-items-center rounded-full" style={{ background: "#4a4a4a", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)" }}><Sparkles className="size-3 text-white" /></span>
      <b className="font-semibold whitespace-nowrap text-white">{who}</b><span className="truncate" style={{ color: "#d4d4d4" }}>{text}</span>
    </span>
  );
}

/* ───────── main ───────── */
export interface SignalGraphProps extends ScreenStatus {
  data: SignalGraphData;
  /** Pin the animation at this time in ms (screenshots: ?t= / ?graph=). */
  freezeAt?: number;
  /** Autoplay once per browser session for this key (e.g. the deal id). */
  autoplayKey?: string;
  /** Bump to replay the live research from t = 0. */
  replayToken?: number;
  onAction?: (actionId: string) => void;
}
const seenKey = (k: string) => `dd.signals.played.${k}`;

export function SignalGraph(p: SignalGraphProps) {
  const d = p.data, status = p.status ?? "ready";
  const S = useMemo(() => schedule(d), [d]);
  const reduce = useReducedMotion();
  // Server renders the settled graph (returning visitors see it immediately); a first visit is hidden by the
  // pre-hydration script below until the layout effect starts the replay at t = 0.
  const [t, setT] = useState<number>(p.freezeAt ?? Infinity);
  const [played, setPlayed] = useState(p.freezeAt != null);
  const [run, setRun] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Record<string, Box>>({});

  const play = useCallback(() => {
    setOpen(null);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setT(Infinity); setPlayed(true); return; }
    setPlayed(false); setT(0); setRun((r) => r + 1);
  }, []);
  useEffect(() => {
    if (!run) return;
    const t0 = performance.now(); let id = 0;
    const tick = (now: number) => { const e = now - t0; if (e >= S.end) { setT(Infinity); setPlayed(true); return; } setT(e); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [run, S.end]);
  useEffect(() => { if (reduce && run) { setRun(0); setT(Infinity); setPlayed(true); } }, [reduce, run]);
  // Autoplay once per session; returning visitors settle before paint (the pre-hydration script below hides frame 0 meanwhile).
  useLayoutEffect(() => {
    if (p.freezeAt != null || !p.autoplayKey || status !== "ready") return;
    let fresh = false;
    try { const k = seenKey(p.autoplayKey); fresh = !sessionStorage.getItem(k); if (fresh) sessionStorage.setItem(k, "1"); } catch { /* storage blocked: no autoplay */ }
    if (fresh) play();
    document.getElementById("sg-first")?.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (p.freezeAt != null) { setT(p.freezeAt); setPlayed(true); } }, [p.freezeAt]);
  useEffect(() => { if (p.replayToken) play(); }, [p.replayToken, play]);
  useLayoutEffect(() => {
    const el = root.current; if (!el) return;
    const m = () => setGeo(measure(el));
    m();
    const ro = new ResizeObserver(m); ro.observe(el);
    el.querySelectorAll("[data-sg=graph],[data-sg=hub],[data-sg=fit],[data-sg=fit-list]").forEach((n) => ro.observe(n));
    document.fonts?.ready.then(m).catch(() => {});
    return () => ro.disconnect();
  }, [status, d]);

  const loading = status === "loading", failed = status === "error" || status === "empty";
  const T = loading ? S.fanout + 500 : failed ? 0 : t;
  const running = !failed && T !== Infinity && T >= S.query && T < S.lastDone + 150;
  const fresh = loading ? "connecting" : running ? "verifying" : !failed && ((played && T === Infinity) || (T !== Infinity && T >= S.lastDone)) ? "now" : "stale";

  const contribs = d.fit.contributions;
  const landed = (id: string) => (failed || loading ? 0 : prog(T, S.scoreAt[id] + SCORE_TRAVEL - 200, 400));
  const score = Math.round(d.fit.base.value + contribs.reduce((a, k) => a + k.weight * ease(landed(k.id)), 0));
  const decided = failed || loading ? 0 : prog(T, S.decide, 450);
  const fed = new Set(contribs.filter((k) => !failed && !loading && prog(T, S.scoreAt[k.id], 1) >= 1).map((k) => `${k.call}/${k.chip}`));
  if (hover) { const k = contribs.find((c) => c.id === hover); if (k) fed.add(`${k.call}/${k.chip}`); }
  const doneCalls = failed || loading ? [] : d.calls.filter((c) => T === Infinity || T >= S.callDone[c.id]);
  const fieldCount = doneCalls.reduce((a, c) => a + usedFields(c), 0);
  const live = T !== Infinity && T < S.end && !failed && !loading;
  // the event pill is a live-run element only; the settled state stays clean
  const stream = live ? [...S.streams].reverse().find((e) => e.at <= T) : undefined;

  const bySlot = useMemo(() => {
    const m: Partial<Record<Slot, SignalCall>> = {}, free = SLOTS.filter((x) => !d.calls.some((c) => c.place === x));
    d.calls.forEach((c) => { const k = c.place ?? free.shift(); if (k && !m[k]) m[k] = c; });
    return m;
  }, [d.calls]);

  // edges (graph-local coordinates are offset into the root by the graph box)
  const E = useMemo(() => {
    const g = geo.graph, hb = geo.hub, tile = geo.tile, panel = geo.panel;
    if (!g || !hb || !tile || !panel) return null;
    // nodes and hub are placed by slot fractions (CSS translate), so derive their points from the graph box
    const at = (fx: number, fy: number) => ({ x: g.x + fx * g.w, y: g.y + fy * g.h });
    const hc = at(HUB.x, HUB.y), h = { x: hc.x - hb.w / 2, y: hc.y - hb.h / 2, w: hb.w, h: hb.h };
    const br: Record<string, Seg> = {};
    (Object.keys(bySlot) as Slot[]).forEach((k) => {
      const c = bySlot[k]!, L = SLOT[k], e = at(L.x, L.y);
      if (L.side === "below") { const s = { x: hc.x, y: h.y + h.h }, m = (e.y - s.y) / 2; br[c.id] = [s, { x: s.x, y: s.y + m }, { x: e.x, y: e.y - m }, e]; return; }
      const dir = L.side === "left" ? -1 : 1;
      if (k === "l") { const s = { x: dir < 0 ? h.x : h.x + h.w, y: e.y }, m = (e.x - s.x) / 2; br[c.id] = [s, { x: s.x + m, y: s.y }, { x: e.x - m, y: e.y }, e]; return; }
      // diagonal slots leave the hub's top/bottom edge vertically and arrive at the dot horizontally (C1)
      const up = L.y < HUB.y;
      const s = { x: hc.x + dir * h.w * 0.3, y: up ? h.y : h.y + h.h };
      br[c.id] = [s, { x: s.x, y: s.y + (e.y - s.y) * 0.7 }, { x: e.x - dir * Math.abs(e.x - s.x) * 0.7, y: e.y }, e];
    });
    // hub → Fit tile: parallel lines out through the panel's right edge, landing inside the tile
    const n = contribs.length, gapS = 6, gapE = Math.min(9, (tile.h - 56) / Math.max(1, n - 1));
    const beside = tile.x > panel.x + panel.w - 4;
    const out = !beside ? [] : contribs.map((_, i) => {
      const s = { x: h.x + h.w, y: hc.y + (i - (n - 1) / 2) * gapS };
      const e = { x: tile.x, y: tile.y + tile.h / 2 + (i - (n - 1) / 2) * gapE };
      const k = (e.x - s.x) * 0.5;
      return [s, { x: s.x + k, y: s.y }, { x: e.x - k, y: e.y }, e] as Seg;
    });
    return { br, out, edge: panel.x + panel.w, hc, h };
  }, [geo, bySlot, contribs]);
  const samples = useMemo(() => E && { br: Object.fromEntries(Object.entries(E.br).map(([k, s]) => [k, sample(s)])), out: E.out.map(sample) }, [E]);

  const dots: { p: Pt; c: string; k: string; r: number }[] = [];
  if (samples && live) {
    for (const c of d.calls) {
      const s = samples.br[c.id]; if (!s) continue;
      const u = prog(T, S.callStart[c.id], CALL_TRAVEL);
      if (u > 0 && u < 1) dots.push({ p: pointAt(s, ease(u)), c: K.lilac, k: `c${c.id}`, r: 2.4 });
      c.chips.forEach((ch) => { const v = prog(T, S.chipAt[`${c.id}/${ch.id}`], RESULT_TRAVEL); if (v > 0 && v < 1) dots.push({ p: pointAt(s, 1 - ease(v)), c: "#ffffff", k: `r${c.id}${ch.id}`, r: 2 }); });
    }
    contribs.forEach((k, i) => {
      const u = prog(T, S.scoreAt[k.id], SCORE_TRAVEL); if (!(u > 0 && u < 1) || !samples.out[i]) return;
      const pt = pointAt(samples.out[i], ease(u));
      dots.push({ p: pt, c: mix(K.lilac, K.rust, clamp((pt.x - (E!.edge - 24)) / 48)), k: `o${k.id}`, r: 2.8 });
    });
  }
  // source chips drift down the empty top sector into the hub's top edge, then dissolve (max ~3 in flight)
  const drift = live && E ? d.provider.sources.map((label, i, a) => {
    const u = prog(T, S.fanout - 250 + i * 160, 1100); if (u <= 0 || u >= 1) return null;
    const lane = (i % 3) - 1, x = E.hc.x + lane * 40, y0 = E.h.y - 150, y1 = E.h.y - 18;
    return { label, x, y: y0 + (y1 - y0) * ease(u), o: Math.sin(Math.PI * u) * 0.8 };
  }).filter(Boolean) as { label: string; x: number; y: number; o: number }[] : [];

  const lineDraw = (i: number) => (loading ? 1 : failed ? 0 : ease(prog(T, S.fanout + i * 70, 560)));
  const hubActive = running || loading;
  const seen = p.autoplayKey && p.freezeAt == null && status === "ready" ? seenKey(p.autoplayKey) : null;

  return (
    <div ref={root} className="sg-root relative grid grid-cols-1 items-stretch gap-4 @[880px]/sg:grid-cols-[minmax(0,1fr)_276px]">
      {/* First visit: hide the server-rendered settled graph until the replay starts (no flash of the ending). */}
      {seen && <script dangerouslySetInnerHTML={{ __html: `try{if(!sessionStorage.getItem(${JSON.stringify(seen)})&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&!document.getElementById("sg-first")){var s=document.createElement("style");s.id="sg-first";s.textContent=".sg-root{visibility:hidden}";document.head.appendChild(s)}}catch(e){}` }} />}
      {/* ── Crustdata panel ── */}
      <div data-sg="panel" className="relative flex min-w-0 flex-col overflow-hidden rounded-[20px] px-4 pt-4 pb-3.5 text-white"
        style={{ background: "radial-gradient(34% 40% at 56% 50%, rgba(86,68,237,.17), transparent 70%), radial-gradient(80% 60% at 90% -10%, rgba(255,255,255,.07), transparent 60%), #050505", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07), 0 24px 48px -24px rgba(9,9,11,.45), 0 2px 6px rgba(9,9,11,.14)" }}>
        <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>{DUST.map((q, i) => <circle key={i} cx={`${q.x}%`} cy={`${q.y}%`} r={q.r} fill="#fff" opacity={q.o * (q.r > 1.3 ? 0.35 : 1)} />)}</svg>

        <div className="relative flex items-center gap-3 px-1">
          <span className="flex items-center gap-1.5 text-[11.5px]" style={{ color: K.t3 }}>Powered by<Mark url={d.provider.markUrl} size={15} /><b className="font-semibold text-white">{d.provider.name}</b></span>
          <span className="font-mono text-[10px]" style={{ color: K.t4 }}>x-api-version: {d.provider.apiVersion}</span>
          <span className="ml-auto"><Freshness mode={fresh} ago={d.requestedAgo} /></span>
        </div>

        <div data-sg="graph" className="relative mt-1 min-h-[500px] flex-1">
          {failed ? (
            <div className="absolute inset-0 grid place-items-center">
              <div className="max-w-[420px] rounded-[18px] p-6 text-center" style={{ background: "#141414", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
                <span className="mx-auto grid size-9 place-items-center rounded-full" style={{ background: "rgba(86,68,237,.18)", boxShadow: "0 0 18px rgba(86,68,237,.35)" }}>{status === "error" ? <AlertTriangle className="size-4" style={{ color: K.t2 }} /> : <ScanSearch className="size-4" style={{ color: K.t2 }} />}</span>
                <div className="mt-3 text-[14px] font-medium">{status === "error" ? "Crustdata didn’t answer" : `No Crustdata match for ${d.company.domain}`}</div>
                <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: K.t3 }}>{status === "error" ? `${p.error ?? "The request timed out."} The fit score keeps its thesis prior until signals arrive.` : `${d.calls[0]?.method ?? ""} ${d.calls[0]?.path ?? ""} returned no match. Try the company name or its profile URL instead of the domain.`}</p>
                {p.onRetry && <button type="button" onClick={p.onRetry} className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[12.5px] font-medium text-[#09090b] hover:bg-zinc-200"><RotateCcw className="size-3.5" />{status === "error" ? "Retry" : "Identify by name"}</button>}
              </div>
            </div>
          ) : (
            <>
              {(Object.keys(bySlot) as Slot[]).map((k) => { const c = bySlot[k]!; return <Endpoint key={c.id} c={c} slot={k} t={T} S={S} fed={fed} open={open === c.id} onToggle={() => setOpen((o) => (o === c.id ? null : c.id))} />; })}
              {/* hub = the company, via Crustdata */}
              <div data-sg="hub" className="absolute z-10 w-[176px] -translate-x-1/2 -translate-y-1/2 rounded-[22px] px-4 pt-5 pb-4 text-center transition-shadow duration-500"
                style={{ left: `${HUB.x * 100}%`, top: `${HUB.y * 100}%`, background: "linear-gradient(180deg,rgba(40,40,44,.9),rgba(19,19,21,.94))", backdropFilter: "blur(8px)", boxShadow: `inset 0 0 0 1px ${hubActive ? "rgba(134,129,247,.45)" : "rgba(255,255,255,.12)"}, inset 0 1px 0 rgba(255,255,255,.08), 0 30px 60px -20px rgba(0,0,0,.9)${hubActive ? ", 0 0 56px -10px rgba(86,68,237,.6)" : ""}` }}>
                <span className="relative mx-auto grid size-[64px] place-items-center rounded-[20px]" style={{ background: "radial-gradient(circle at 50% 40%, rgba(134,129,247,.35), rgba(86,68,237,.1) 62%, transparent 74%)", boxShadow: `0 0 ${hubActive ? 44 : 30}px rgba(86,68,237,${hubActive ? 0.6 : 0.4})` }}>
                  <CompanyLogo c={d.company} size={44} />
                </span>
                <div className="mt-3 text-[15px] leading-[20px] font-medium tracking-[-0.01em]">{d.company.name}</div>
                <div className="font-mono text-[11px] leading-[16px]" style={{ color: K.t3 }}>{d.company.domain}</div>
                <div className="mt-2.5 inline-flex items-center gap-1.5 text-[10.5px]" style={{ color: K.t4 }}>via<Mark url={d.provider.markUrl} size={12} /><span style={{ color: K.t3 }}>{d.provider.name}</span></div>
              </div>
            </>
          )}
        </div>

        <div className="relative mt-auto flex h-8 items-center justify-end gap-3 px-1">
          {stream && <EventPill key={stream.at} who={stream.who} text={stream.text} show={prog(T, stream.at, 320)} />}
          <span className="tnum shrink-0 font-mono text-[11px]" style={{ color: K.t2 }}>
            {failed || loading ? `0 of ${d.calls.length} calls` : doneCalls.length === d.calls.length ? `${d.calls.length} calls · ${fieldCount} fields used` : `${doneCalls.length} of ${d.calls.length} calls · ${fieldCount} fields used`}
          </span>
        </div>
      </div>

      <FitCard align={E && geo["fit-list"] ? E.hc.y - (geo["fit-list"].y + geo["fit-list"].h) : undefined} d={d} T={T} S={S} score={score} decided={decided} failed={failed} loading={loading} hover={hover} setHover={setHover} landed={landed} onAction={p.onAction} />

      {/* ── wires, drifting source chips and travelling dots ── */}
      {E && samples && !failed && (
        <svg className="pointer-events-none absolute inset-0 z-[5] overflow-visible" width="100%" height="100%" aria-hidden>
          <defs>
            <linearGradient id="sg-out" gradientUnits="userSpaceOnUse" x1={E.edge - 60} x2={E.edge + 24} y1={0} y2={0}><stop offset="0" stopColor="#ffffff" stopOpacity=".28" /><stop offset="1" stopColor={K.rust} stopOpacity=".8" /></linearGradient>
            <radialGradient id="sg-glow"><stop offset="0" stopColor="#fff" stopOpacity=".9" /><stop offset=".35" stopColor="#fff" stopOpacity=".35" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
          </defs>
          {d.calls.map((c, i) => {
            const s = E.br[c.id]; if (!s) return null;
            const on = T !== Infinity && T >= S.callStart[c.id] && T < S.callDone[c.id];
            return <path key={c.id} d={toD(s)} fill="none" stroke={on ? K.lilac : K.line} strokeWidth={on ? 1.3 : 1} style={on ? { filter: "drop-shadow(0 0 4px rgba(134,129,247,.9))" } : undefined} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - lineDraw(i)} />;
          })}
          {!loading && E.out.map((s, i) => {
            const k = contribs[i], u = ease(prog(T, S.scoreAt[k.id], SCORE_TRAVEL)), hot = hover === k.id;
            return <path key={k.id} d={toD(s)} fill="none" stroke="url(#sg-out)" strokeWidth={hot ? 1.75 : 1} strokeOpacity={hot ? 1 : hover ? 0.3 : 0.9} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - u} />;
          })}
          {drift.map((c) => (
            <g key={c.label} transform={`translate(${c.x},${c.y})`} opacity={c.o}>
              <rect x={-c.label.length * 3.3 - 10} y={-10} width={c.label.length * 6.6 + 20} height={20} rx={10} fill="#141414" stroke="rgba(255,255,255,.14)" />
              <text textAnchor="middle" y={3.5} fontSize={10} fontFamily="var(--font-mono)" fill="#bdbdbd">{c.label}</text>
            </g>
          ))}
          {dots.map((o) => <g key={o.k} transform={`translate(${o.p.x},${o.p.y})`}><circle r={o.r * 3.4} fill={o.c} opacity={0.25} /><circle r={o.r * 3.4} fill="url(#sg-glow)" opacity={0.45} /><circle r={o.r} fill="#fff" /></g>)}
        </svg>
      )}
    </div>
  );
}

const pathOf = (d: SignalGraphData, call: string, chip: string) => { const c = d.calls.find((x) => x.id === call)?.chips.find((x) => x.id === chip); return c ? (c.path ?? c.field) : ""; };

function FitCard({ d, T, S, score, decided, failed, loading, hover, setHover, landed, onAction, align }: {
  d: SignalGraphData; T: number; S: Sched; score: number; decided: number; failed: boolean; loading: boolean; hover: string | null; setHover: (id: string | null) => void; landed: (id: string) => number; onAction?: (id: string) => void;
  /** Distance from the bottom of the signals list to the hub's centre line: the tile centres on it so the bundle runs level. */
  align?: number;
}) {
  const f = d.fit, delta = score - f.base.value, pct = (v: number) => `${Math.max(0, Math.min(100, v))}%`;
  const rec = f.recommendation;
  const pending = !failed && !loading && T !== Infinity && T < S.decide;
  const tileRef = useRef<HTMLDivElement>(null);
  const [tileH, setTileH] = useState(0);
  useLayoutEffect(() => { if (tileRef.current) setTileH(tileRef.current.offsetHeight); }, []);
  // Centre the tile on the hub line when there is room, but never grow the card (the panel stretches to it: no feedback loop).
  const shift = align != null && tileH ? Math.min(28, Math.max(12, Math.round(align - tileH / 2))) : 12;
  const [done, setDone] = useState<string[]>([]);
  const heat = failed || loading ? 0 : f.contributions.reduce((a, k) => a + landed(k.id), 0) / Math.max(1, f.contributions.length);
  return (
    <div data-sg="fit" className="relative flex flex-col rounded-[20px] bg-white px-4 pt-3.5 pb-4" style={{ boxShadow: "var(--dd-e2)" }}>
      <div data-sg="fit-list">
        <div className="flex items-baseline justify-between"><span className="text-[14px] font-medium text-ink">Signals into fit</span><span className="tnum text-[12px] text-zinc-500">{f.contributions.filter((k) => landed(k.id) > 0).length}/{f.contributions.length}</span></div>
        <div className="mt-1.5 flex items-center justify-between border-b border-zinc-100 pb-1 text-[11.5px] text-zinc-500"><span className="truncate">{f.base.label}</span><span className="tnum ml-3 w-9 shrink-0 text-center font-medium text-zinc-700">{f.base.value}</span></div>
        {f.contributions.map((k) => {
          const u = landed(k.id), up = k.weight > 0, ev = k.source ?? pathOf(d, k.call, k.chip);
          return (
            <div key={k.id} data-sg={`fit-${k.id}`} title={ev} onMouseEnter={() => setHover(k.id)} onMouseLeave={() => setHover(null)} className={cx("-mx-2 grid grid-cols-[6px_minmax(0,1fr)_40px] items-center gap-x-2 rounded-lg px-2 py-[2px] transition-colors", hover === k.id && "bg-zinc-50")}>
              <span className="size-1.5 rounded-full" style={{ background: u > 0 ? (up ? "var(--color-ok)" : "var(--color-rust)") : "#e4e4e7" }} />
              <span className="min-w-0 leading-tight" style={{ opacity: 0.35 + 0.65 * u }}>
                <span className="block truncate text-[12.5px] leading-[16px] text-ink">{k.label}</span>
                <span className="mt-[2px] block font-mono text-[10.5px] leading-[13px] whitespace-nowrap text-zinc-400">{midEllipsis(ev, 30)}</span>
              </span>
              <span className={cx("tnum inline-flex h-6 items-center justify-center rounded-full text-[12px] font-medium", up ? "bg-[#eaf5ee] text-[#1d6b3e]" : "bg-rust-50 text-rust")} style={{ opacity: u, transform: `scale(${0.8 + 0.2 * ease(u)})` }}>{up ? "+" : "−"}{Math.abs(k.weight)}</span>
            </div>
          );
        })}
      </div>

      <div ref={tileRef} data-sg="tile" className="relative overflow-hidden rounded-[16px] px-4 pt-3 pb-2.5 text-white"
        style={{ marginTop: shift, background: "linear-gradient(150deg,#c46a2e 0%,#9c440f 48%,#6e2c07 100%)", boxShadow: `inset 0 1px 0 rgba(255,255,255,.25), inset 0 0 0 1px rgba(255,255,255,.08), 0 14px 32px -12px rgba(156,68,15,${0.35 + heat * 0.35}), 0 0 ${16 + heat * 22}px -6px rgba(214,120,60,${0.25 + heat * 0.4})` }}>
        <span aria-hidden className="absolute -top-10 -right-8 size-32 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(255,214,170,.45), transparent)" }} />
        <div className="relative flex items-center justify-between"><span className="text-[11px] font-medium tracking-[.08em] text-[#ffd9bd] uppercase">{f.label}</span>{decided > 0 && <span style={{ opacity: decided }} className={cx("inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium", BAND[fitBand(score)])}>{f.bands[fitBand(score)]}</span>}</div>
        <div className="relative mt-1 flex items-end gap-1.5">
          <span className="numeral text-[46px] leading-[0.95]">{score}</span>
          <span className="mb-1.5 text-[12px] text-white/60">/ 100</span>
          {delta !== 0 && <span className="tnum mb-2 ml-auto rounded-full bg-white/12 px-2 py-[2px] text-[10.5px] font-medium ring-1 ring-white/20">{delta > 0 ? "+" : "−"}{Math.abs(delta)} from signals</span>}
        </div>
        <div className="relative mt-2 flex items-center gap-2.5">
          <div className="relative h-1 flex-1 rounded-full bg-white/20">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: pct(score) }} />
            <span className="absolute -top-1 h-3 w-px bg-white/80" style={{ left: pct(f.threshold.value) }} />
          </div>
          <span className="tnum shrink-0 text-[10.5px] whitespace-nowrap text-white/70">{f.threshold.label} {f.threshold.value}</span>
        </div>
      </div>

      <div className="mt-auto pt-3">
        {decided > 0 ? (
          <div className="rounded-[14px] bg-rust-50/70 p-3 ring-1 ring-rust-100" style={{ opacity: decided, transform: `translateY(${(1 - ease(decided)) * 8}px)` }}>
            <div className="flex items-center gap-1.5 text-[14.5px] font-medium tracking-[-0.01em] text-ink"><Sparkles className="size-3.5 text-rust" aria-label="Recommendation" />{rec.label}</div>
            <p className="mt-0.5 text-[11.5px] leading-[16px] text-zinc-600">{rec.why}</p>
            <div className="mt-2.5 flex gap-2">
              {rec.actions.map((a) => {
                const isDone = done.includes(a.id), I = a.primary ? MessageSquareText : FileSearch, act = () => { setDone((x) => [...x, a.id]); onAction?.(a.id); };
                if (a.primary) return isDone
                  ? <span key={a.id} role="status" className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white text-[12px] font-medium text-ok ring-1 ring-ok-100"><Check className="size-3.5" />{a.done}</span>
                  : <Btn key={a.id} variant="primary" className="flex-1 justify-center text-[12px]" icon={<I className="size-3.5" />} onClick={act}>{a.label}</Btn>;
                return <IconBtn key={a.id} className={cx("bg-white", isDone && "text-ok ring-ok-100")} icon={isDone ? <Check /> : <I />} label={isDone ? a.done : a.label} onClick={isDone ? undefined : act} />;
              })}
            </div>
          </div>
        ) : (
          <div className="flex h-[52px] items-center gap-2 rounded-[14px] border border-dashed border-zinc-200 px-3.5 text-[12px] text-zinc-500">
            {pending || loading ? <span className="shimmer shimmer-ink">Weighing signals against your thesis…</span> : <span>Recommendation appears once signals arrive.</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Deal page section: compact title row, Replay, and the graph. */
export function SignalSection({ aside, ...p }: SignalGraphProps & { aside?: ReactNode }) {
  const [tok, setTok] = useState(0);
  return (
    <section className="min-w-0 px-8 pt-4 pb-6">
      <div className="flex items-end gap-4">
        <div className="min-w-0">
          <h2 className="serif text-[26px] leading-tight">{!p.status || p.status === "ready" ? <HL h={p.data.headline} /> : p.status === "loading" ? `Researching ${p.data.company.name}…` : `No signals for ${p.data.company.name} yet`}</h2>
        </div>
        <div className="ml-auto flex items-center gap-3 pb-1">
          <span className="eyebrow">{p.data.eyebrow}</span>
          {aside}
          <Btn icon={<RotateCcw className="size-3.5" />} onClick={() => setTok((n) => n + 1)} disabled={p.status === "loading"}>Replay research</Btn>
        </div>
      </div>
      <div className="@container/sg mt-3"><SignalGraph {...p} replayToken={tok} /></div>
    </section>
  );
}
