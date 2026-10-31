"use client";
// Gentle motion: cards settle in, counts tick up, checks pop, bars grow. Respects reduced motion.
import { motion, animate, useInView } from "framer-motion";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

// Hydration-safe reduced-motion flag: the server and the hydrating client both read `false`,
// then the client re-renders with the real preference. MotionConfig(reducedMotion="user")
// already strips transforms for reduced-motion users, so the first paint stays calm.
const RM_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeRM(cb: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const m = window.matchMedia(RM_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeRM, () => !!window.matchMedia?.(RM_QUERY).matches, () => false);
}

export function Rise({ children, i = 0, className }: { children: ReactNode; i?: number; className?: string }) {
  const r = useReducedMotion();
  return (
    <motion.div className={className} initial={r ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

export function Count({ to, from = 0, decimals = 0, prefix = "", suffix = "", comma = true, duration = 1.1 }: { to: number; from?: number; decimals?: number; prefix?: string; suffix?: string; comma?: boolean; duration?: number }) {
  const r = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const [v, setV] = useState(r ? to : from);
  useEffect(() => {
    if (r) { setV(to); return; }
    if (!seen) return;
    const c = animate(from, to, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: setV });
    return () => c.stop();
  }, [seen, r, from, to, duration]);
  const s = v.toFixed(decimals);
  const out = comma ? Number(s).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : s;
  return <span ref={ref} className="tnum">{prefix}{out}{suffix}</span>;
}

export function Pop({ children, delay = 0.3, className }: { children: ReactNode; delay?: number; className?: string }) {
  const r = useReducedMotion();
  return (
    <motion.span className={className} style={{ display: "inline-flex" }} initial={r ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 420, damping: 18, delay }}>
      {children}
    </motion.span>
  );
}

export function Grow({ w, className, delay = 0.1, style }: { w: string; className?: string; delay?: number; style?: React.CSSProperties }) {
  const r = useReducedMotion();
  return <motion.div className={className} style={{ ...style, width: w, transformOrigin: "left" }} initial={r ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }} />;
}

export function GrowUp({ h, className, delay = 0.1, style }: { h: number; className?: string; delay?: number; style?: React.CSSProperties }) {
  const r = useReducedMotion();
  return <motion.div className={className} style={{ ...style, height: h, transformOrigin: "bottom" }} initial={r ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }} />;
}

export function Pulse({ className = "bg-[#5a8f6c]" }: { className?: string }) {
  return (
    <span className="relative flex size-1.5">
      <span className={`absolute inline-flex size-full motion-safe:animate-ping rounded-full opacity-60 ${className}`} />
      <span className={`relative size-1.5 rounded-full ${className}`} />
    </span>
  );
}

/* ---- v2.1: planned motion, all reduced-motion aware ---- */
// Draws an SVG path (warm-intro line). Reduced motion: drawn instantly.
export function DrawPath({ d, delay = 0.2, ...p }: { d: string; delay?: number } & React.SVGProps<SVGPathElement>) {
  const r = useReducedMotion();
  const { stroke, strokeWidth, strokeDasharray, markerEnd, fill } = p;
  return <motion.path d={d} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray as string} markerEnd={markerEnd} fill={fill ?? "none"} initial={r ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }} />;
}

// Highlighter sweep behind a clause (data room). Reduced motion: static highlight.
export function Sweep({ children, delay = 0.4, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const r = useReducedMotion();
  return (
    <span className={`relative isolate block ${className}`}>
      <motion.span aria-hidden className="absolute inset-0 -z-10 rounded-md bg-[#fdf0c4]" style={{ transformOrigin: "left" }} initial={r ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.7, delay, ease: [0.65, 0, 0.35, 1] }} />
      {children}
    </span>
  );
}

// One-time attention pulse on a rust edge (Corvid runway row). Reduced motion: solid edge.
export function EdgePulse({ className = "" }: { className?: string }) {
  const r = useReducedMotion();
  return <motion.span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] bg-rust ${className}`} initial={r ? false : { opacity: 0.2, scaleY: 0.4 }} animate={r ? undefined : { opacity: [0.2, 1, 0.5, 1], scaleY: [0.4, 1, 1, 1] }} transition={{ duration: 1.4, delay: 0.5, times: [0, 0.35, 0.7, 1] }} />;
}

// ⌘K selected-row highlight that slides into place (shared layout feel). Reduced motion: no slide.
export function SlideHighlight({ to, rowH = 36, from = 0, className = "" }: { to: number; rowH?: number; from?: number; className?: string }) {
  const r = useReducedMotion();
  return <motion.span aria-hidden className={`absolute inset-x-0 rounded-lg bg-zinc-100 ${className}`} style={{ height: rowH }} initial={r ? false : { y: from * rowH }} animate={{ y: to * rowH }} transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.25 }} />;
}

// Slide-in for side panels (agent run). Reduced motion: appears in place.
export function SlideIn({ children, className }: { children: ReactNode; className?: string }) {
  const r = useReducedMotion();
  return <motion.div className={className} initial={r ? false : { x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 26 }}>{children}</motion.div>;
}
