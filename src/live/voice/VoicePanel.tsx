"use client";
// Shared voice-agent UI: the orb (driven by real audio amplitude), captions synced to the speech, mute / replay /
// stop, push-to-talk (SpeechRecognition) or a text input, sources, and honest error/blocked states. Used by the
// /today dock (variant "dock") and the floating orb's popover (variant "popover").
import { useEffect, useRef, useState, type FormEvent, type MutableRefObject } from "react";
import { Mic, RotateCcw, Square, Volume2, VolumeX, X } from "lucide-react";
import { cx } from "@port/components/ui";
import type { VoiceAgent, VoicePhase } from "./useVoiceAgent";

const usePrefersReducedMotion = () => {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
};

/** The blob. Scale and glow follow `level` (0..1 RMS from the AnalyserNode); idles with a slow breath. */
export function VoiceOrb({ level, phase, size }: { level: MutableRefObject<number>; phase: VoicePhase | "rest"; size: number }) {
  const el = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    let id = 0, smooth = 0;
    const tick = (t: number) => {
      const active = phase === "speaking" || phase === "listening";
      smooth += ((active ? level.current : 0) - smooth) * 0.25;
      const breath = reduced || active ? 0 : Math.sin(t / 900) * 0.03;
      if (el.current) {
        el.current.style.transform = `scale(${reduced ? 1 : 1 + breath + smooth * 0.35})`;
        el.current.style.boxShadow = `0 0 ${12 + smooth * 40}px ${2 + smooth * 10}px rgba(214,120,60,${0.28 + smooth * 0.45}), inset 0 1px 0 rgba(255,255,255,.3)`;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [level, phase, reduced]);
  return (
    <span aria-hidden className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <span ref={el} data-phase={phase} className={cx("block size-full rounded-full", phase === "error" && "grayscale")}
        style={{ background: "radial-gradient(circle at 34% 30%, #ffd9bd 0%, #d27a3e 32%, #9c440f 68%, #6e2c07 100%)", transition: reduced ? undefined : "filter .3s" }} />
      {(phase === "preparing" || phase === "thinking") && !reduced && <span className="absolute inset-0 animate-ping rounded-full bg-[#d27a3e]/25" />}
    </span>
  );
}

const STATUS: Record<VoicePhase, string> = {
  idle: "Ready",
  preparing: "Preparing…",
  thinking: "Thinking…",
  blocked: "Your browser blocked autoplay",
  speaking: "Speaking",
  listening: "Listening…",
  error: "Something went wrong",
};

export function VoicePanel({ agent, variant, onClose, title = "Deal Desk assistant" }: { agent: VoiceAgent; variant: "dock" | "popover"; onClose?: () => void; title?: string }) {
  const a = agent;
  const [q, setQ] = useState("");
  const text = a.brief?.text ?? "";
  const send = (e: FormEvent) => { e.preventDefault(); const v = q.trim(); if (v) { setQ(""); void a.ask(v); } };
  const busy = a.phase === "preparing" || a.phase === "thinking";
  return (
    <div data-testid={`voice-${variant}`} data-phase={a.phase} className={cx("flex flex-col", variant === "dock" ? "h-full" : "max-h-[min(560px,80vh)]")}>
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
        <span className="text-[13.5px] font-semibold">{title}</span>
        <span className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => a.setMuted(!a.muted)} aria-pressed={a.muted} aria-label={a.muted ? "Unmute voice" : "Mute voice"} className="grid size-7 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-ink">{a.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}</button>
          {onClose && <button type="button" onClick={onClose} aria-label="Close assistant" className="grid size-7 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-ink"><X className="size-4" /></button>}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-4">
        <div className="flex flex-col items-center text-center">
          <VoiceOrb level={a.level} phase={a.phase} size={variant === "dock" ? 104 : 72} />
          <div className="mt-3 text-[11.5px] font-medium tracking-[.06em] text-zinc-400 uppercase" data-testid="voice-status">{STATUS[a.phase]}</div>
        </div>
        {a.heard && <p className="mt-4 rounded-xl bg-zinc-50 px-3 py-2 text-[12.5px] text-zinc-600"><span className="text-zinc-400">You: </span>{a.heard}</p>}
        {text && (
          <p data-testid="voice-caption" aria-live="polite" className="mt-4 text-[14px] leading-relaxed">
            <span className="text-ink">{text.slice(0, a.spoken)}</span><span className="text-zinc-400">{text.slice(a.spoken)}</span>
          </p>
        )}
        {a.phase === "error" && a.error && <div role="alert" data-testid="voice-error" className="mt-4 rounded-xl bg-rust-50/70 px-3 py-2.5 text-[12.5px] text-rust ring-1 ring-rust-100">{a.error}</div>}
        {a.brief && (
          <details className="mt-4 text-[11.5px] text-zinc-500">
            <summary className="cursor-pointer select-none">Where this comes from</summary>
            <p className="mt-1.5">{a.brief.composer === "llm" ? "Phrased by the configured AI model from the facts below." : "Composed from your data without an AI model (none is connected)."}{a.brief.llmError ? ` AI model failed: ${a.brief.llmError}` : ""}</p>
            <ul className="mt-1.5 space-y-1">{a.brief.sources.map((s, i) => <li key={i}><span className="text-zinc-700">{s.label}</span> · <span className="font-mono text-[10.5px]">{s.ref}</span></li>)}</ul>
          </details>
        )}
      </div>
      <div className="border-t border-zinc-100 px-4 py-3">
        <div className="mb-2 flex flex-wrap justify-center gap-1.5">
          {a.phase === "blocked" && <button type="button" onClick={() => void a.play()} data-testid="voice-tap" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[12.5px] font-medium text-white hover:bg-zinc-800"><Volume2 className="size-3.5" />Tap to hear</button>}
          {a.phase === "speaking" && <button type="button" onClick={a.stop} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[12.5px] ring-1 ring-zinc-200 hover:text-ink"><Square className="size-3" />Stop</button>}
          {(a.phase === "idle" || a.phase === "error") && <button type="button" onClick={() => void (a.brief && a.phase === "idle" ? a.replay() : a.start())} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[12.5px] ring-1 ring-zinc-200 hover:text-ink"><RotateCcw className="size-3.5" />{a.brief && a.phase === "idle" ? "Replay" : "Try again"}</button>}
        </div>
        {a.canListen ? (
          <button type="button" disabled={busy} aria-label="Hold to talk" aria-pressed={a.phase === "listening"}
            onPointerDown={() => void a.listenStart()} onPointerUp={a.listenStop} onPointerLeave={() => a.phase === "listening" && a.listenStop()}
            onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat && a.phase !== "listening") { e.preventDefault(); void a.listenStart(); } }}
            onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); a.listenStop(); } }}
            className={cx("flex h-9 w-full items-center justify-center gap-2 rounded-full text-[12.5px] font-medium", a.phase === "listening" ? "bg-rust text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200/70")}>
            <Mic className="size-4" />{a.phase === "listening" ? "Listening — release to send" : "Hold to talk"}
          </button>
        ) : (
          <form onSubmit={send} className="flex gap-2" data-testid="voice-text">
            <input aria-label="Ask the assistant" value={q} onChange={(e) => setQ(e.target.value)} disabled={busy} placeholder="Type a question (voice input isn’t supported in this browser)" className="h-9 min-w-0 flex-1 rounded-full bg-white px-3.5 text-[12.5px] ring-1 ring-zinc-200 outline-none focus:ring-zinc-400" />
            <button type="submit" disabled={busy} className="h-9 rounded-full bg-ink px-3.5 text-[12.5px] font-medium text-white hover:bg-zinc-800 disabled:opacity-50">Ask</button>
          </form>
        )}
      </div>
    </div>
  );
}
