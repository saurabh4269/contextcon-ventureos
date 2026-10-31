"use client";
/**
 * v3.2 · Just-in-time connect. There is no setup page up front: this appears only when a task needs a tool
 * (an agent goes to book a founder call and Calendar isn't connected) or when the user asks. Generic per tool.
 * "Not now" leaves the step waiting with a small <ConnectChip>.
 * v4 · ModalFrame traps focus, closes on Esc, scales in (fade only with reduced motion). The handshake art is our
 * mark joined to the tool by two dotted lines with a sienna dash flowing along them.
 */
import { motion } from "framer-motion";
import { Check, Loader2, Lock, X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import type { ConnectAsk, ToolId } from "../types";
import { useReducedMotion } from "./motion";
import { DeskMark, ToolLogo, TOOL_NAME } from "./tools";
import { cx } from "./ui";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea,select,[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

export function ModalFrame({ children, onClose, width = 440, label }: { children: ReactNode; onClose?: () => void; width?: number; label: string }) {
  const r = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const prev = document.activeElement as HTMLElement | null;
    // Focus the first field the user would act on (autofocus wins), else the dialog itself.
    (el.querySelector<HTMLElement>("[data-autofocus]") ?? el).focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); close.current?.(); return; }
      if (e.key !== "Tab") return;
      const f = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null && n.tabIndex !== -1);
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || a === el)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.({ preventScroll: true }); };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: r ? 0 : 0.2 }} className="absolute inset-0 bg-zinc-900/20 backdrop-blur-[6px]" onClick={onClose} />
      <motion.div ref={ref} tabIndex={-1} role="dialog" aria-modal aria-label={label} initial={r ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: r ? 0.12 : 0.26, ease: [0.2, 0.8, 0.2, 1] }}
        style={{ width }} className="relative max-h-[calc(100vh-32px)] overflow-y-auto overscroll-contain rounded-[20px] bg-white shadow-[0_0_0_1px_rgba(9,9,11,.07),0_2px_4px_rgba(9,9,11,.04),0_32px_64px_-24px_rgba(9,9,11,.32)] outline-none">
        {children}
      </motion.div>
    </div>
  );
}

/** Close button shared by the modals: 32px hairline square, like Today's expand button. */
export function ModalClose({ onClick, className }: { onClick?: () => void; className?: string }) {
  return <button type="button" aria-label="Close" onClick={onClick} className={cx("grid size-8 place-items-center rounded-[10px] bg-white text-zinc-500 ring-1 ring-zinc-200 transition-colors hover:text-ink hover:ring-zinc-300", className)}><X className="size-4" /></button>;
}

export type ConnectState = "ask" | "connecting" | "connected";

/** Two dotted rails between the tiles; a sienna dash flows out on the top one and back on the bottom one. */
function Handshake({ tool, state }: { tool: ToolId; state: ConnectState }) {
  const r = useReducedMotion(), id = useId().replace(/:/g, "");
  const done = state === "connected", busy = state === "connecting";
  const tile = (child: ReactNode) => (
    <span className="rounded-[26px] bg-white/70 p-1.5 ring-1 ring-zinc-200/70 backdrop-blur-sm">
      <span className="grid size-[76px] place-items-center rounded-[20px] bg-white shadow-[0_0_0_1px_rgba(9,9,11,.06),0_1px_2px_rgba(9,9,11,.05),0_8px_20px_-10px_rgba(9,9,11,.22)]">{child}</span>
    </span>
  );
  const W = 112;
  const rail = (y: number, back: boolean) => (
    <g>
      <line x1="0" x2={W} y1={y} y2={y} stroke="#c9c9cf" strokeWidth="2.5" strokeDasharray="0.1 6" strokeLinecap="round" />
      {!done && <line x1="0" x2={W} y1={y} y2={y} stroke={`url(#${id}${back ? "b" : "f"})`} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`34 ${W + 44}`}
        className={r ? undefined : back ? "dd-rail-back" : "dd-rail"} style={{ strokeDashoffset: r ? -40 : undefined, animationDuration: busy ? "0.9s" : "2.4s", animationDelay: back ? (busy ? "-0.45s" : "-1.2s") : undefined }} />}
    </g>
  );
  return (
    <div className="relative flex h-[200px] items-center justify-center">
      <div aria-hidden className="absolute inset-0 rounded-t-[20px] bg-[radial-gradient(#cdcdd4_1px,transparent_1.3px)] [background-size:14px_14px] [mask-image:radial-gradient(ellipse_62%_70%_at_50%_50%,#000_25%,transparent_80%)]" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-full rounded-t-[20px] bg-[radial-gradient(ellipse_40%_45%_at_50%_55%,rgba(240,180,138,.22),transparent_70%)]" />
      <div className="relative flex items-center">
        {tile(<DeskMark size={44} />)}
        <span className="relative -mx-1">
          <svg width={W} height="28" viewBox={`0 0 ${W} 28`} aria-hidden className="block">
            <defs>
              <linearGradient id={`${id}f`} gradientUnits="userSpaceOnUse" x1="0" x2={W} y1="0" y2="0"><stop offset="0" stopColor="#c2652b" stopOpacity=".25" /><stop offset="1" stopColor="#c2652b" /></linearGradient>
              <linearGradient id={`${id}b`} gradientUnits="userSpaceOnUse" x1={W} x2="0" y1="0" y2="0"><stop offset="0" stopColor="#c2652b" stopOpacity=".25" /><stop offset="1" stopColor="#c2652b" /></linearGradient>
            </defs>
            {done ? <motion.line x1="0" x2={W} y1="14" y2="14" stroke="#09090b" strokeWidth="2" strokeLinecap="round" initial={r ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35 }} />
              : <>{rail(7, false)}{rail(21, true)}</>}
          </svg>
          {done && <motion.span initial={r ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 420, damping: 20, delay: 0.25 }} className="absolute top-1/2 left-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-ink text-white ring-4 ring-white"><Check className="size-3.5" strokeWidth={3} /></motion.span>}
        </span>
        {tile(<ToolLogo id={tool} size={44} bare />)}
      </div>
    </div>
  );
}

/** `error`: why the last Allow failed (live mode never fakes a connection). `demo`: the connection is simulated, say so. */
export function ConnectModal({ ask, state = "ask", onAllow, onLater, onClose, onDone, error, demo }: { ask: ConnectAsk; state?: ConnectState; onAllow?: () => void; onLater?: () => void; onClose?: () => void; onDone?: () => void; error?: string; demo?: boolean }) {
  const done = state === "connected", name = TOOL_NAME[ask.tool];
  const dismiss = onClose ?? onLater;
  return (
    <ModalFrame label={done ? `${name} connected` : ask.title} onClose={dismiss} width={460}>
      <ModalClose onClick={dismiss} className="absolute top-4 right-4 z-10" />
      <Handshake tool={ask.tool} state={state} />
      <div className="px-9 pb-8 text-center">
        <h2 className="serif text-[28px] leading-[1.1] tracking-[-0.01em]">{done ? `${name} connected` : ask.title}</h2>
        <p className="mx-auto mt-2.5 max-w-[340px] text-[14px] leading-[1.55] text-balance text-zinc-500">{done ? `Picking up where the agent left off${ask.step ? `: ${ask.step.charAt(0).toLowerCase()}${ask.step.slice(1)}` : ""}.` : ask.why}</p>
        {!!ask.scopes?.length && !done && (
          <ul aria-label="What the agent can do" className="mx-auto mt-5 divide-y divide-zinc-100 rounded-[14px] text-left ring-1 ring-zinc-200/80">
            {ask.scopes.map((s) => (
              <li key={s.label} className="flex items-center gap-3 px-4 py-2.5">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#f6efe7] text-rust"><Check className="size-3" strokeWidth={2.75} /></span>
                <span className="min-w-0 text-[13px]"><span className="font-medium text-ink">{s.label}</span>{s.detail && <span className="text-zinc-500"> · {s.detail}</span>}</span>
              </li>
            ))}
          </ul>
        )}
        {ask.scope && !done && <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-zinc-400"><Lock className="size-3" />{ask.scope}</p>}
        <button type="button" data-autofocus onClick={done ? onDone ?? dismiss : onAllow} disabled={state === "connecting"} aria-busy={state === "connecting"}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-[14px] font-medium text-white shadow-[0_1px_2px_rgba(9,9,11,.2),inset_0_1px_0_rgba(255,255,255,.12)] transition-colors hover:bg-zinc-800 disabled:cursor-progress disabled:opacity-90">
          {state === "connecting" ? <><Loader2 className="size-4 animate-spin" />Connecting {name}…</> : done ? <><Check className="size-4" />Continue</> : ask.allowLabel}
        </button>
        {error && !done && <p role="alert" className="mt-3 text-[12.5px] leading-snug text-rust">{error}</p>}
        {demo && done && <p className="mt-3 text-[12px] text-zinc-400">Demo data · nothing was actually connected</p>}
        {!done && <button type="button" onClick={onLater} disabled={state === "connecting"} className="mt-2 h-10 w-full rounded-full text-[13.5px] text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-ink disabled:opacity-40">Not now{ask.step && <span className="text-zinc-400"> · {ask.step} waits</span>}</button>}
      </div>
    </ModalFrame>
  );
}

/** What a step shows while it waits on a tool the user said "Not now" to. */
export function ConnectChip({ tool, onClick, className }: { tool: ToolId; onClick?: () => void; className?: string }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick?.(); }} title="Waiting on you · click to connect"
      className={cx("group/cc inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white pr-3 pl-1.5 text-[12.5px] font-medium whitespace-nowrap text-ink shadow-[0_1px_1px_rgba(9,9,11,.04)] ring-1 ring-[#ead9c6] transition-all hover:-translate-y-px hover:ring-[#d9b996]", className)}>
      <span className="relative grid size-5 place-items-center rounded-full bg-white ring-1 ring-zinc-200"><ToolLogo id={tool} size={12} bare /><span className="absolute -top-px -right-px size-1.5 rounded-full bg-rust ring-2 ring-white" /></span>
      Connect {TOOL_NAME[tool].replace("Google ", "")}
    </button>
  );
}
